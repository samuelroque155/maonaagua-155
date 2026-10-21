import test from 'node:test';
import assert from 'node:assert/strict';
import { lerArquivoLocal, salvarArquivoLocal } from '../src/services/arquivoLocalService.js';

const dados = new Map();
let falha = false;
globalThis.indexedDB = { open() {
  const pedido = {};
  queueMicrotask(() => {
    pedido.result = { close() {}, transaction(_nome, modo) {
      const tx = {}; let acao;
      tx.objectStore = () => ({
        get(chave) { const r = {}; acao = () => { r.result = structuredClone(dados.get(chave)); }; return r; },
        put(valor, chave) { const r = {}; const copia = structuredClone(valor); acao = () => { dados.set(chave, copia); r.result = chave; }; return r; }
      });
      setTimeout(() => { if (falha && modo === 'readwrite') { tx.error = new Error('Falha de disco'); tx.onabort(); } else { acao(); tx.oncomplete(); } }, 1);
      return tx;
    } }; pedido.onsuccess();
  }); return pedido;
} };

test('ocorrência persiste foto e texto por conta e cliente, sem contaminar visita', async () => {
  const rascunho = { foto: { base64: 'data:image/jpeg;base64,YQ==', url: 'data:image/jpeg;base64,YQ==' }, texto: 'Vazamento' };
  await salvarArquivoLocal('u1', 'ocorrencia', 'empresa:cliente1', rascunho);
  assert.deepEqual(await lerArquivoLocal('u1', 'ocorrencia', 'empresa:cliente1'), rascunho);
  assert.equal(await lerArquivoLocal('u2', 'ocorrencia', 'empresa:cliente1'), undefined);
  assert.equal(await lerArquivoLocal('u1', 'ocorrencia', 'empresa:cliente2'), undefined);
  assert.equal(await lerArquivoLocal('u1', 'orcamentos', 'empresa:cliente1'), undefined);
});
test('orçamento preserva PDF e falha de armazenamento não vira sucesso', async () => {
  const pdf = new Blob(['PDF'], { type: 'application/pdf' });
  await salvarArquivoLocal('u1', 'orcamentos', 'lista', [{ nome: 'Avulso', pdf }]);
  assert.equal(await (await lerArquivoLocal('u1', 'orcamentos', 'lista'))[0].pdf.text(), 'PDF');
  falha = true;
  await assert.rejects(salvarArquivoLocal('u1', 'orcamentos', 'lista', []), /Falha de disco/);
  falha = false;
  assert.equal((await lerArquivoLocal('u1', 'orcamentos', 'lista')).length, 1);
});
