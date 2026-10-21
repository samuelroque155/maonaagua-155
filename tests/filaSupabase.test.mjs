import test from 'node:test';
import assert from 'node:assert/strict';
import { pendenciasDaConta, prepararVisitaPendente, sincronizarPendencia } from '../src/services/filaSupabase.js';
import { aplicarContextoEquipe, carregarContextoEquipe } from '../src/services/equipeService.js';

const nova = () => ({ id: 123, supabaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'worker', ownerId: 'owner', clienteId: 7, ts: 1792500000000, tipo: 'problema',
  txtA: 'Vazamento', fotosAlertaBase64: ['data:image/jpeg;base64,YQ=='] });

function ambiente({ falharInsert = false, trocarConta = false, confirmar = true, erroUpload = null } = {}) {
  const chamadas = { uploads: [], salvos: [], removidos: [], inserts: [] };
  const p = nova();
  let atual = 'worker';
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: atual } } }) },
    storage: { from: () => ({ upload: async caminho => {
      chamadas.uploads.push(caminho);
      if (trocarConta) atual = 'other';
      return { error: erroUpload };
    } }) },
    from: () => ({
      upsert: async (registro, options) => {
        chamadas.inserts.push({ registro, options });
        return { error: falharInsert ? new Error('Sem rede') : null };
      },
      select() { return this; }, eq() { return this; },
      single: async () => ({ data: { id: p.supabaseId, criado_por: confirmar ? 'worker' : 'other', cliente_id: 7 } })
    })
  };
  const executar = () => sincronizarPendencia({ client, pendente: p, userId: 'worker',
    salvar: async v => chamadas.salvos.push(structuredClone(v)),
    remover: async id => chamadas.removidos.push(id) });
  return { p, chamadas, executar };
}

test('fila ignora contas diferentes e registros sem autoria; não inventa UUID legado', () => {
  assert.deepEqual(pendenciasDaConta([nova(), { id: 1 }, { userId: 'other' }], 'worker'), [nova()]);
  assert.throws(() => prepararVisitaPendente({ ...nova(), supabaseId: '123' }, [], []), /preservada/);
});
test('envia foto privada, persiste checkpoint e confirma visita antes de remover', async () => {
  const a = ambiente(); await a.executar();
  assert.equal(a.chamadas.uploads.length, 1);
  assert.equal(a.chamadas.salvos.length, 1);
  assert.deepEqual(a.chamadas.removidos, [123]);
  const { registro, options } = a.chamadas.inserts[0];
  assert.equal(registro.user_id, 'owner'); assert.equal(registro.criado_por, 'worker');
  assert.equal(registro.tipo, 'problema'); assert.equal(registro.observacoes, 'Vazamento');
  assert.deepEqual(options, { onConflict: 'id', ignoreDuplicates: true });
  assert.match(registro.fotos_alerta[0], /^worker\/visitas\/aaaaaaaa/);
});
test('falha de rede mantém cópia local e nova tentativa reutiliza upload', async () => {
  const a = ambiente({ falharInsert: true });
  await assert.rejects(a.executar(), /Sem rede/);
  await assert.rejects(a.executar(), /Sem rede/);
  assert.equal(a.chamadas.uploads.length, 1);
  assert.equal(a.chamadas.removidos.length, 0);
});
test('troca de conta durante upload impede gravar/remover visita', async () => {
  const a = ambiente({ trocarConta: true });
  await assert.rejects(a.executar(), /sessão mudou/);
  assert.equal(a.chamadas.inserts.length, 0); assert.equal(a.chamadas.removidos.length, 0);
});
test('upload já recebido permite repetição; acesso negado mantém a fila', async () => {
  const repetido = ambiente({ erroUpload: { statusCode: '409' } });
  await repetido.executar();
  assert.deepEqual(repetido.chamadas.removidos, [123]);
  const negado = ambiente({ erroUpload: new Error('Acesso negado') });
  await assert.rejects(negado.executar(), /Acesso negado/);
  assert.equal(negado.chamadas.inserts.length, 0);
  assert.equal(negado.chamadas.removidos.length, 0);
});
test('visita com outra autoria não confirma remoção da fila', async () => {
  const a = ambiente({ confirmar: false });
  await assert.rejects(a.executar(), /confirmar/);
  assert.equal(a.chamadas.removidos.length, 0);
});
test('contexto confirmado substitui vínculo do perfil; remoção revoga tipo e rotas', async () => {
  const perfil = { tipoConta: 'autonomo', vinculoEmpresa: 'forjada', rotas: [99], assinaturaAtiva: false };
  const efetivo = aplicarContextoEquipe(perfil, { employer_uid: 'owner', rotas: ['7'], assinatura_ativa: true, empresa: { cidade: 'JATAÍ-GO' } });
  assert.equal(efetivo.cidadeEmpresa, 'JATAÍ-GO');
  assert.equal(efetivo.tipoConta, 'funcionario'); assert.equal(efetivo.vinculoEmpresa, 'owner');
  assert.equal(aplicarContextoEquipe(efetivo, null).tipoConta, null);
  assert.equal(aplicarContextoEquipe(perfil, null).vinculoEmpresa, null);
  await assert.rejects(carregarContextoEquipe({ rpc: async () => ({ data: [{}, {}] }) }), /mais de um vínculo/);
});
