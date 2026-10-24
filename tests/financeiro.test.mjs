import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { criarBancoSupabaseTeste, owner, other } from './helpers/supabaseFixture.mjs';
import { calcularResumo, centavos, crc16Pix, gerarPixCopiaECola, mensagemCobranca, statusCobranca, vencimentoMensal } from '../src/services/financeiro.js';
import { adicionarNaFilaFinanceira, estadoFinanceiroVazio, sincronizarFilaFinanceira } from '../src/services/financeiroSync.js';
import { salvarContaRecebimento } from '../src/services/financeiroService.js';

test('Checkout automático da InfinitePay permanece bloqueado', async () => {
  await assert.rejects(
    () => salvarContaRecebimento({}, owner, { instituicao: 'InfinitePay', nome_titular: 'Teste', tipo_integracao: 'infinitepay_checkout' }, estadoFinanceiroVazio()),
    /Checkout automático ainda não foi habilitado/
  );
});

const MIGRACAO = '../supabase/migrations/20261024015307_financeiro_base.sql';

test('valores em centavos, status, parciais e vencimento de fim do mÃªs', () => {
  assert.equal(centavos('R$ 1.234,56'), 123456);
  assert.equal(centavos('1000.50'), 100050);
  assert.equal(vencimentoMensal('2028-02-01', 31), '2028-02-29');
  assert.equal(vencimentoMensal('2027-02-01', 30), '2027-02-28');
  assert.equal(vencimentoMensal('2027-04-01', 31), '2027-04-30');
  const c = { id: 'c1', valor: '100.00', vencimento: '2026-10-10', competencia: '2026-10-01', status: 'aberta' };
  assert.equal(statusCobranca(c, [{ cobranca_id: 'c1', valor: '35.00' }], '2026-10-23'), 'parcial');
  assert.equal(statusCobranca(c, [{ cobranca_id: 'c1', valor: '100.00' }], '2026-10-23'), 'pago');
  assert.equal(calcularResumo([c], [{ cobranca_id: 'c1', valor: '35.00', pago_em: '2026-10-23' }], '2026-10', '2026-10-23').aReceber, 6500);
});

test('Pix Copia e Cola aplica CRC16 e a mensagem leva dados do profissional e cliente', () => {
  const code = gerarPixCopiaECola({ chave: 'email@example.com', nome: 'Piscinas Azul', cidade: 'GoiÃ¢nia', valor: 120.50, referencia: 'mensalidade-123' });
  assert.match(code, /6304[0-9A-F]{4}$/);
  assert.equal(code.slice(-4), crc16Pix(code.slice(0, -4)));
  const mensagem = mensagemCobranca({ cliente: { nome: 'Raquel' }, cobranca: { valor: '120.50', vencimento: '2026-10-31', descricao: 'ManutenÃ§Ã£o mensal' }, conta: { tipo_chave_pix: 'email', chave_pix: 'email@example.com' }, perfil: { empresa: 'Piscinas Azul' }, codigoPix: code });
  assert.match(mensagem, /Raquel/);
  assert.match(mensagem, /R\$\s?120,50/);
  assert.match(mensagem, /Piscinas Azul/);
  assert.match(mensagem, new RegExp(code));
});

test('fila offline preserva operaÃ§Ãµes repetidas por id sem duplicar chave', () => {
  const uid = owner;
  const inicio = { ...estadoFinanceiroVazio(), user_id: uid };
  const uma = adicionarNaFilaFinanceira(inicio, 'contas_recebimento', { id: 'a', user_id: uid, nome_titular: 'A' });
  const duas = adicionarNaFilaFinanceira(uma, 'contas_recebimento', { id: 'b', user_id: uid, nome_titular: 'B' });
  assert.equal(duas.fila.length, 2);
  assert.throws(() => adicionarNaFilaFinanceira(inicio, 'contas_recebimento', { id: 'x', user_id: other }), /outra conta/);
});

test('fila de pagamentos usa insert imutÃ¡vel e confirma replay idempotente pela chave original', async () => {
  const uid = owner;
  const registro = { id: 'p1', user_id: uid, cobranca_id: 'c1', valor: 25, tipo: 'pagamento', corrige_pagamento_id: null, sync_status: 'pendente' };
  const estado = adicionarNaFilaFinanceira({ ...estadoFinanceiroVazio(), user_id: uid }, 'pagamentos_financeiros', registro);
  let insercoes = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: uid } }, error: null }) },
    from: () => ({
      insert: async () => { insercoes++; return { error: { code: '23505' } }; },
      select: () => ({ eq() { return this; }, maybeSingle: async () => ({ data: { ...registro, sync_status: undefined }, error: null }) })
    })
  };
  const resultado = await sincronizarFilaFinanceira(client, estado, uid, { salvar: async () => {} });
  assert.equal(insercoes, 1);
  assert.equal(resultado.fila.length, 0);
  assert.equal(resultado.pagamentos[0].sync_status, 'sincronizado');
});

test('migraÃ§Ã£o isolada gera cobranÃ§a mensal imutÃ¡vel, idempotente e respeita RLS', async () => {
  const db = await criarBancoSupabaseTeste();
  await db.exec('create role service_role bypassrls;');
  try {
    await db.exec(await readFile(new URL(MIGRACAO, import.meta.url), 'utf8'));
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true);
      insert into contas_recebimento(user_id,instituicao,nome_titular,tipo_chave_pix,chave_pix,principal)
        values('${owner}','InfinitePay','Titular Teste','email','teste@example.test',true);
      insert into clientes_financeiro(user_id,cliente_id,valor_mensal,dia_vencimento,recorrencia_ativa,descricao,conta_recebimento_id)
        select '${owner}',1,125.50,31,true,'Plano antigo',id from contas_recebimento where user_id='${owner}';
      commit;`);
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true); select gerar_cobrancas_financeiras('2026-02-01'); select gerar_cobrancas_financeiras('2026-02-01'); commit;`);
    let rows = await db.query(`select valor::text,vencimento::text,descricao from cobrancas_financeiras where user_id='${owner}' and competencia='2026-02-01'`);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].valor, '125.50');
    assert.equal(rows.rows[0].vencimento, '2026-02-28');
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true); update clientes_financeiro set valor_mensal=200,descricao='Novo plano' where user_id='${owner}' and cliente_id=1; select gerar_cobrancas_financeiras('2026-03-01'); commit;`);
    rows = await db.query(`select competencia::text,valor::text,descricao from cobrancas_financeiras where user_id='${owner}' order by competencia`);
    assert.deepEqual(rows.rows.map(r => [r.competencia,r.valor,r.descricao]), [['2026-02-01','125.50','Plano antigo'],['2026-03-01','200.00','Novo plano']]);
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true); insert into pagamentos_financeiros(user_id,cobranca_id,valor,tipo,forma_pagamento,origem_confirmacao,criado_por,observacao) select '${owner}',id,20,'pagamento','infinitepay','manual','${owner}','Assinatura existente conferida no app InfinitePay' from cobrancas_financeiras where user_id='${owner}' and competencia='2026-02-01'; commit;`);
    rows = await db.query(`select forma_pagamento,origem_confirmacao,observacao from pagamentos_financeiros where user_id='${owner}'`);
    assert.deepEqual(rows.rows, [{ forma_pagamento: 'infinitepay', origem_confirmacao: 'manual', observacao: 'Assinatura existente conferida no app InfinitePay' }]);
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true);`);
    await assert.rejects(() => db.exec(`insert into pagamentos_financeiros(user_id,cobranca_id,valor,tipo,forma_pagamento,origem_confirmacao,criado_por) select '${owner}',id,106,'pagamento','pix_manual','manual','${owner}' from cobrancas_financeiras where user_id='${owner}' and competencia='2026-02-01'`));
    await db.exec('rollback');
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${other}',true);`);
    rows = await db.query('select * from cobrancas_financeiras');
    assert.equal(rows.rows.length, 0);
    await db.exec('rollback');
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${other}',true);`);
    await assert.rejects(() => db.exec(`insert into cobrancas_financeiras(user_id,cliente_id,competencia,valor,vencimento,descricao,forma_pagamento) values('${owner}',1,'2026-04-01',10,'2026-04-10','Tentativa cruzada','pix')`));
    await db.exec('rollback');
    const existentes = await db.query('select count(*)::int as clientes from clientes;');
    assert.equal(existentes.rows[0].clientes, 3);
  } finally { await db.close(); }
});
