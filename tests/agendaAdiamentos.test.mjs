import test from 'node:test';
import assert from 'node:assert/strict';
import { dataBrasil, dataValida, estadoAgendaCliente, observarDiaBrasil, resumirAgendaDia } from '../src/services/agendaService.js';
import { mensagemProdutosSimples, mensagemProdutos } from '../src/services/whatsappService.js';
import { adiamentoParaRelatorio, salvarAdiamento, enviarFotoAdiamento } from '../src/services/adiamentoService.js';

const segunda = { id: 1, nome: 'Ana', diasVisita: [1], ultimaVisita: '2026-10-19T10:00:00-03:00' };

test('quarta sem cadastro não herda conclusão, pausa nem adiamento semanal legado da segunda', () => {
  const resumo = resumirAgendaDia([{ ...segunda, adiadoPara: 3, visitaEmAndamentoData: 'Wed Oct 21 2026' }], [], '2026-10-21');
  assert.deepEqual(resumo.pendentes, []); assert.equal(resumo.totalPendentes, 0);
  assert.equal(estadoAgendaCliente(segunda, '2026-10-21').concluida, false);
});

test('contador e lista seguem exatamente os mesmos clientes, inclusive após finalizar e cadastrar', () => {
  let clientes = [1, 2, 3].map(id => ({ id, diasVisita: ['3'], datasConcluidas: [] }));
  for (const total of [3, 2, 1, 0]) {
    const resumo = resumirAgendaDia(clientes, [], '2026-10-21');
    assert.equal(resumo.totalPendentes, total); assert.equal(resumo.pendentes.length, total);
    clientes = clientes.map((c, i) => i === 3 - total ? { ...c, datasConcluidas: ['2026-10-21'] } : c);
  }
  clientes.push({ id: 4, diasVisita: [3] });
  assert.equal(resumirAgendaDia(clientes, [], '2026-10-21').totalPendentes, 1);
});

test('adiamento tira apenas a ocorrência original, aparece na nova data e preserva a recorrência', () => {
  const dados = structuredClone(segunda);
  const adiamentos = [{ cliente_id: 1, data_original: '2026-10-19', nova_data: '2026-10-21' }];
  assert.equal(resumirAgendaDia([{ ...dados, ultimaVisita: null }], adiamentos, '2026-10-19').totalPendentes, 0);
  assert.equal(resumirAgendaDia([dados], adiamentos, '2026-10-21').totalPendentes, 1);
  assert.equal(resumirAgendaDia([dados], adiamentos, '2026-10-26').totalPendentes, 1);
  const realizado = { ...dados, datasConcluidas: ['2026-10-21'] };
  assert.equal(resumirAgendaDia([realizado], adiamentos, '2026-10-21').totalPendentes, 0);
  assert.equal(adiamentos.length, 1); assert.deepEqual(dados, segunda);
});

test('reagendamento em cadeia e colisão com dia fixo geram uma única pendência por cliente', () => {
  const adiamentos = [{ cliente_id: 1, data_original: '2026-10-19', nova_data: '2026-10-21' },
    { cliente_id: 1, data_original: '2026-10-21', nova_data: '2026-10-26' }];
  assert.equal(resumirAgendaDia([segunda], adiamentos, '2026-10-21').totalPendentes, 0);
  assert.equal(resumirAgendaDia([segunda], adiamentos, '2026-10-26').totalPendentes, 1);
  assert.equal(resumirAgendaDia([segunda], adiamentos, '2026-11-02').totalPendentes, 1);
});

test('virada brasileira às 03:00 UTC atualiza a lista sem reiniciar; foco recupera suspensão', () => {
  assert.equal(dataBrasil('2026-10-21T02:59:59.999Z'), '2026-10-20');
  assert.equal(dataBrasil('2026-10-21T03:00:00.000Z'), '2026-10-21');
  let agora = new Date('2026-10-21T02:59:59.900Z'), disparar, atraso;
  const eventosJanela = new Map(), eventosDocumento = new Map(), datas = [];
  const janela = { addEventListener: (e, f) => eventosJanela.set(e, f), removeEventListener: e => eventosJanela.delete(e) };
  const documento = { hidden: false, addEventListener: (e, f) => eventosDocumento.set(e, f), removeEventListener: e => eventosDocumento.delete(e) };
  const parar = observarDiaBrasil({ atualizar: d => datas.push(dataBrasil(d)), janela, documento, agora: () => agora,
    agendar: (f, ms) => { disparar = f; atraso = ms; return 1; }, cancelar: () => {} });
  assert.equal(atraso, 150);
  agora = new Date('2026-10-21T03:00:00.050Z'); disparar();
  assert.deepEqual(datas, ['2026-10-20', '2026-10-21']);
  agora = new Date('2026-10-23T14:00:00Z'); eventosDocumento.get('visibilitychange')();
  assert.equal(datas.at(-1), '2026-10-23'); parar();
  assert.equal(eventosJanela.size, 0); assert.equal(eventosDocumento.size, 0);
  assert.equal(dataValida('2026-02-30'), false); assert.equal(dataValida('2028-02-29'), true);
});

test('relatório identifica adiamento e foto sem gerar parâmetros ou produtos de limpeza', () => {
  const registro = { id: 'a', cliente_id: 1, data_original: '2026-10-21', nova_data: '2026-10-23', criado_em: '2026-10-21T13:00:00Z', motivo: 'Portão fechado', horario_original: '09:00', comparecimento_em: '2026-10-21T13:00:00Z' };
  const relatorio = adiamentoParaRelatorio(registro, 'foto-privada');
  assert.equal(relatorio.tipo, 'adiamento'); assert.equal(relatorio.dataISO, '2026-10-21');
  assert.deepEqual(relatorio.fotos, ['foto-privada']); assert.equal(relatorio.p, undefined); assert.deepEqual(relatorio.prods, []);
});

test('lista simples após finalizar usa somente itens da visita, sem preços nem dados técnicos', () => {
  const produtos = [{ nome: 'Cloro', qtd: 2, preco: 80 }, { nome: 'Peneira', qtd: 1, preco: 35 }];
  const antes = structuredClone(produtos);
  const mensagem = mensagemProdutosSimples({ cliente: { nome: 'Ana' }, perfil: { empresa: 'Água Clara' }, produtos });
  assert.equal(mensagem, 'Olá, Ana!\n\n🛒 *Produtos a repor:*\n\n• Cloro\n• Peneira\n\nObrigado pela atenção!\n\n*Água Clara*');
  assert.doesNotMatch(mensagem, /R\$|80|35|total|pH|Cloro:|foto|2x/i);
  assert.deepEqual(produtos, antes);
  assert.match(mensagemProdutos({ cliente: { nome: 'Ana' }, perfil: { empresa: 'Autônomo João' }, produtos, comValores: true }), /Total da lista/);
  assert.throws(() => mensagemProdutosSimples({ cliente: { nome: 'Ana' }, perfil: { empresa: 'João' } }), /não tem produtos/);
});

test('tentativa de gravar adiamento com outra sessão não escreve no banco', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'outro' } } }) }, from: () => assert.fail('Não deve gravar') };
  await assert.rejects(salvarAdiamento(client, { userId: 'eu' }), /sessão mudou/);
});

test('foto de comparecimento usa armazenamento privado da própria conta sem sobrescrever arquivos', async () => {
  let pedido;
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'eu' } } }) },
    storage: { from: bucket => { assert.equal(bucket, 'fotos-visitas'); return { upload: async (caminho, arquivo, opcoes) => { pedido = { caminho, arquivo, opcoes }; return {}; } }; } } };
  const foto = new Blob(['fixture'], { type: 'image/jpeg' });
  const caminho = await enviarFotoAdiamento(client, 'eu', foto);
  assert.match(caminho, /^eu\/adiamentos\/[0-9a-f-]+\.jpg$/);
  assert.equal(pedido.arquivo, foto); assert.equal(pedido.opcoes.upsert, false);
  await assert.rejects(enviarFotoAdiamento(client, 'outro', foto), /sessão mudou/);
  await assert.rejects(enviarFotoAdiamento(client, 'eu', new Blob(['x'], { type: 'text/plain' })), /imagem compactada/);
});

test('repetir salvamento após resposta perdida confirma o mesmo adiamento sem criar outro', async () => {
  const data = dataBrasil();
  const nova = new Date(`${data}T12:00:00Z`); nova.setUTCDate(nova.getUTCDate() + 2);
  const registro = { id: 'adiamento', user_id: 'empresa', cliente_id: 1, data_original: data, nova_data: nova.toISOString().slice(0, 10), motivo: 'Portão fechado' };
  let inseridos = 0;
  const consulta = { eq: () => consulta, single: async () => ({ data: registro }) };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'eu' } } }) }, from: () => ({
    insert: async payload => { inseridos++; assert.equal(payload.id, registro.id); return { error: { code: '23505' } }; }, select: () => consulta
  }) };
  const salvo = await salvarAdiamento(client, { id: registro.id, userId: 'eu', ownerId: 'empresa', clienteId: 1, dataOriginal: data, novaData: registro.nova_data, motivo: registro.motivo, compareceu: true });
  assert.equal(salvo, registro); assert.equal(inseridos, 1);
});
