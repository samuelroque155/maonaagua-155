import test from 'node:test';
import assert from 'node:assert/strict';
import { limpezaConcluida, criarControleBusca, visitasDoCliente, fotosDaVisita } from '../src/services/visitaEstado.js';

const cliente = { ultimaVisita: '2026-10-19T15:00:00-03:00', diasVisita: [1, 4] };

test('conclusão dura até o início da próxima quinta, inclusive após reabrir', () => {
  const reaberto = JSON.parse(JSON.stringify(cliente));
  for (const dia of [19, 20, 21]) {
    assert.equal(limpezaConcluida(reaberto, new Date(2026, 9, dia, 23, 59)), true);
  }
  assert.equal(limpezaConcluida(reaberto, new Date(2026, 9, 22)), false);
  assert.equal(limpezaConcluida(reaberto, new Date(2026, 9, 26)), false);
});

test('agenda semanal, fim de semana, conclusão fora da agenda e dias em texto', () => {
  assert.equal(limpezaConcluida({ ...cliente, diasVisita: ['1'] }, new Date(2026, 9, 25)), true);
  assert.equal(limpezaConcluida({ ...cliente, diasVisita: [1] }, new Date(2026, 9, 26)), false);
  const domingo = { ultimaVisita: '2026-10-18T10:00:00-03:00', diasVisita: [1, 4] };
  assert.equal(limpezaConcluida(domingo, new Date(2026, 9, 19)), false);
  assert.equal(limpezaConcluida({ ...cliente, diasVisita: [0] }, new Date(2026, 9, 24)), true);
  assert.equal(limpezaConcluida({ ...cliente, diasVisita: [0] }, new Date(2026, 9, 25)), false);
});

test('datas ausentes, inválidas ou futuras não marcam conclusão; sem agenda preserva', () => {
  for (const ultimaVisita of [null, '', 'inválida', '2027-01-01']) {
    assert.equal(limpezaConcluida({ ...cliente, ultimaVisita }, new Date(2026, 9, 20)), false);
  }
  assert.equal(limpezaConcluida({ ...cliente, diasVisita: [] }, new Date(2027, 0, 1)), true);
});

test('resposta atrasada de A não substitui B nem o carregamento atual', async () => {
  const controle = criarControleBusca();
  let concluirA;
  const respostaA = new Promise(resolve => { concluirA = resolve; });
  let exibido;
  let carregando = true;
  const pedidoA = controle.iniciar();
  const tarefaA = respostaA.then(() => {
    if (controle.atual(pedidoA)) { exibido = 'A'; carregando = false; }
  });
  const pedidoB = controle.iniciar();
  concluirA();
  await tarefaA;
  assert.equal(carregando, true);
  if (controle.atual(pedidoB)) { exibido = 'B'; carregando = false; }
  assert.equal(exibido, 'B');
  assert.equal(carregando, false);
  controle.invalidar();
  assert.equal(controle.atual(pedidoB), false);
});

test('relatório preserva fotos de cada visita e exclui outro cliente', () => {
  const historico = [
    { id: 'v1', clienteId: 'A', fotos: ['foto-A1'] },
    { id: 'v2', clienteId: 'B', fotos: ['foto-B'] },
    { id: 'v3', clienteId: 'A', fotos: ['foto-A2'] }
  ];
  assert.deepEqual(visitasDoCliente(historico, 'A').map(v => [v.id, ...v.fotos]), [
    ['v1', 'foto-A1'], ['v3', 'foto-A2']
  ]);
});

test('gravação rejeita fotos de outra conta, cliente ou visita; aceita legado', () => {
  const foto = { userId: 'u', clienteId: 'A', visitaId: 'v1' };
  assert.equal(fotosDaVisita([foto], 'u', 'A', 'v1'), true);
  assert.equal(fotosDaVisita([foto], 'outro', 'A', 'v1'), false);
  assert.equal(fotosDaVisita([foto], 'u', 'B', 'v1'), false);
  assert.equal(fotosDaVisita([foto], 'u', 'A', 'v2'), false);
  assert.equal(fotosDaVisita([foto], 'u', 'A'), false);
  assert.equal(fotosDaVisita([{ caminho: 'legado.jpg' }], 'u', 'A'), true);
});
