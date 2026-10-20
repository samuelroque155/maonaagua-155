import test from 'node:test';
import assert from 'node:assert/strict';
import { lerProgresso, salvarProgresso, removerProgresso } from '../src/services/progressoVisita.js';

// Adaptador em memória para testar o contrato do IndexedDB sem dependências.
// Não substitui o teste manual de fechar/reabrir o navegador ou Android.
const registros = new Map();
const legado = new Map();
let falharGravacao = false;
globalThis.localStorage = { getItem: chave => legado.get(chave) || null };
globalThis.indexedDB = {
  open() {
    const pedido = {};
    queueMicrotask(() => {
      pedido.result = {
        close() {},
        transaction(_nome, modo) {
          const tx = {};
          let operacao;
          tx.objectStore = () => ({
            get(chave) {
              const resultado = {};
              operacao = () => { resultado.result = structuredClone(registros.get(chave)); };
              return resultado;
            },
            put(valor, chave) {
              const resultado = {};
              const copia = structuredClone(valor);
              operacao = () => { registros.set(chave, copia); resultado.result = chave; };
              return resultado;
            }
          });
          setTimeout(() => {
            if (falharGravacao && modo === 'readwrite') {
              tx.error = new Error('Falha simulada de armazenamento');
              tx.onabort();
            } else {
              operacao();
              tx.oncomplete();
            }
          }, 1);
          return tx;
        }
      };
      pedido.onsuccess();
    });
    return pedido;
  }
};

test('rascunho mantém fotos, dados, tempo e isolamento por conta', async () => {
  const progresso = {
    userId: 'u1', clienteId: 'cliente-A', ph: '7.4', textoAlerta: 'Observação',
    tempoTrabalhadoAcumulado: 125, inicioOriginalMs: 1000,
    produtosFaltando: [{ nome: 'Cloro', qtd: 2 }],
    fotosVisita: [{ id: 'foto-1', arquivo: new Blob(['imagem-pendente'], { type: 'image/jpeg' }), status: 'compressing' }],
    fotosAlerta: [{ id: 'alerta', base64: 'data:image/jpeg;base64,YQ==', caminho: 'u1/visitas/alerta.jpg', status: 'ready' }]
  };
  const gravacao = salvarProgresso('u1', progresso);
  const leitura = lerProgresso('u1'); // Não precisa aguardar manualmente a gravação.
  await gravacao;
  const recuperado = await leitura;
  assert.equal(recuperado.clienteId, 'cliente-A');
  assert.equal(recuperado.ph, '7.4');
  assert.equal(recuperado.textoAlerta, 'Observação');
  assert.equal(recuperado.tempoTrabalhadoAcumulado, 125);
  assert.deepEqual(recuperado.produtosFaltando, progresso.produtosFaltando);
  assert.equal(await recuperado.fotosVisita[0].arquivo.text(), 'imagem-pendente');
  assert.deepEqual(recuperado.fotosAlerta, progresso.fotosAlerta);
  assert.equal(await lerProgresso('u2'), null);
});

test('gravações rápidas preservam a pausa mais recente', async () => {
  await Promise.all([
    salvarProgresso('u1', { ph: '7', horaInicioVisita: 100 }),
    salvarProgresso('u1', { ph: '7.4', horaInicioVisita: null, tempoTrabalhadoAcumulado: 120 })
  ]);
  assert.deepEqual(await lerProgresso('u1'), { ph: '7.4', horaInicioVisita: null, tempoTrabalhadoAcumulado: 120 });
});

test('lê legado sem apagar, rejeita outra conta e não ressuscita visita finalizada', async () => {
  const chave = 'maonagua_visita_progresso';
  const antigo = JSON.stringify({ clienteId: 'A', fotosVisita: [{ caminho: 'legado/visitas/1.jpg' }] });
  legado.set(chave, antigo);
  assert.equal((await lerProgresso('legado')).clienteId, 'A');
  assert.equal(await lerProgresso('outra'), null);
  await removerProgresso('legado');
  assert.equal(await lerProgresso('legado'), null);
  assert.equal(legado.get(chave), antigo);
});

test('falha de armazenamento é informada e não bloqueia a próxima tentativa', async () => {
  falharGravacao = true;
  await assert.rejects(salvarProgresso('falha', { ph: '7' }), /Falha simulada/);
  falharGravacao = false;
  await salvarProgresso('falha', { ph: '7.2' });
  assert.equal((await lerProgresso('falha')).ph, '7.2');
});
