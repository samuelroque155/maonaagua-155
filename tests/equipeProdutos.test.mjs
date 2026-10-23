import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { criarBancoSupabaseTeste, owner, worker } from './helpers/supabaseFixture.mjs';
import { listarAlertas, preencherProdutosDaEmpresa, salvarProdutosEquipe } from '../src/services/equipeService.js';

test('alertas ignoram registros de visitas do proprietÃ¡rio e mostram somente autoria de funcionÃ¡rio', async () => {
  const client = { from: tabela => {
    assert.equal(tabela, 'alertas_produtos');
    return { select: colunas => {
      assert.match(colunas, /visitas!inner\(criado_por,user_id\)/);
      return { eq: () => ({ order: async () => ({ data: [
        { id: 1, user_id: 'owner', visitas: { criado_por: 'owner', user_id: 'owner' }, produtos: [{ nome: 'Cloro' }] },
        { id: 2, user_id: 'owner', visitas: { criado_por: 'worker', user_id: 'owner' }, produtos: [{ nome: 'Algicida' }] }
      ] }) }) };
    } };
  } };
  const alertas = await listarAlertas(client, 'owner');
  assert.deepEqual(alertas.map(a => a.id), [2]);
  assert.equal(alertas[0].funcionarioAtivo, 'Respons\u00e1vel');
});

test('relatório da empresa recupera itens privados sem alterar visitas do autônomo', async () => {
  const visitas = [{ id: 'a', user_id: 'empresa', criado_por: 'funcionario', produtos: [] },
    { id: 'b', user_id: 'empresa', criado_por: 'empresa', produtos: [{ nome: 'Original' }] }];
  const client = { from: tabela => {
    assert.equal(tabela, 'alertas_produtos');
    return { select: () => ({ eq: (campo, uid) => {
      assert.equal(campo, 'user_id'); assert.equal(uid, 'empresa');
      return { in: async (chave, ids) => {
        assert.equal(chave, 'visita_id'); assert.deepEqual(ids, ['a']);
        return { data: [{ visita_id: 'a', produtos: [{ nome: 'Revisado', qtd: 2, preco: 50 }] }] };
      } };
    } }) };
  } };
  const resultado = await preencherProdutosDaEmpresa(client, 'empresa', visitas);
  assert.equal(resultado[0].produtos[0].preco, 50);
  assert.equal(resultado[1], visitas[1]);
  assert.deepEqual(visitas[0].produtos, []);
});

test('revisão altera somente produtos da visita pertencente à empresa e propaga recusa', async () => {
  const filtros = [];
  const consulta = { eq: (campo, valor) => { filtros.push([campo, valor]); return consulta; },
    select: () => ({ single: async () => ({ error: new Error('Sem permissão') }) }) };
  const client = { from: tabela => {
    assert.equal(tabela, 'visitas');
    return { update: dados => { assert.deepEqual(dados, { produtos: [{ nome: 'Cloro', qtd: 2, preco: 30 }] }); return consulta; } };
  } };
  await assert.rejects(salvarProdutosEquipe(client, 'empresa', 'visita', [{ nome: 'Cloro', qtd: '2', preco: '30' }]), /Sem permissão/);
  assert.deepEqual(filtros, [['id', 'visita'], ['user_id', 'empresa']]);
  await assert.rejects(salvarProdutosEquipe(client, 'empresa', 'visita', [{ nome: 'Cloro', qtd: -1 }]), /quantidade válida/);
});

test('gatilho atualizado nao alerta visita propria e preserva alerta identificado de funcionario', async()=>{
  const db=await criarBancoSupabaseTeste();
  try {
    await db.exec('create role service_role bypassrls;');
    await db.exec("insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('Funcionaria','worker@example.test','11111111-1111-4111-8111-111111111111','[\"1\"]')");
    await db.exec(await readFile(new URL('../supabase/migrations/20261023233223_alertas_somente_equipe.sql',import.meta.url),'utf8'));
    const executar=async(uid,sql)=>{await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true);`);try{const r=await db.query(sql);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}};
    const propria=await executar(owner,"insert into visitas(user_id,cliente_id,tipo,data_visita,produtos) values('11111111-1111-4111-8111-111111111111',1,'visita',now(),'[{\"nome\":\"Cloro\",\"qtd\":2}]') returning produtos");
    assert.equal(propria[0].produtos[0].nome,'Cloro');
    assert.equal((await db.query('select count(*)::int n from alertas_produtos')).rows[0].n,0);
    await executar(worker,"insert into visitas(user_id,cliente_id,tipo,data_visita,produtos) values('11111111-1111-4111-8111-111111111111',1,'visita',now(),'[{\"nome\":\"Algicida\",\"qtd\":1}]')");
    const alertas=(await db.query('select funcionario_nome,produtos from alertas_produtos')).rows;
    assert.equal(alertas.length,1); assert.equal(alertas[0].funcionario_nome,'Funcionaria'); assert.equal(alertas[0].produtos[0].nome,'Algicida');
  } finally { await db.close(); }
});
