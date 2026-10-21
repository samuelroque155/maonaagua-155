import test from 'node:test';
import assert from 'node:assert/strict';
import { compartilharDocumento } from '../src/services/documentoPdfService.js';

test('PDF pronto mantém conteúdo e nome ao compartilhar e ao baixar', async t => {
  const navegadorAnterior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const documentoAnterior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    Object.defineProperty(globalThis, 'navigator', navegadorAnterior);
    if (documentoAnterior) Object.defineProperty(globalThis, 'document', documentoAnterior);
    else delete globalThis.document;
  });
  const original = new Blob(['PDF de exemplo'], { type: 'application/pdf' });
  let enviado;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => true, share: async dados => { enviado = dados; } } });
  await compartilharDocumento(original, 'Proposta pronta.pdf', 'Orçamento', 'Mensagem da empresa');
  assert.equal(enviado.files[0].name, 'Proposta pronta.pdf');
  assert.equal(await enviado.files[0].text(), await original.text());
  assert.equal(enviado.text, 'Mensagem da empresa');

  let baixado;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => false } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => {
    const link = { click() { baixado = { href: this.href, nome: this.download }; } };
    return link;
  } } });
  t.mock.method(URL, 'createObjectURL', arquivo => { assert.equal(arquivo, original); return 'blob:pdf-exemplo'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const agendar = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (...args) => {
    const timer = agendar(...args); timer.unref(); return timer;
  });
  await compartilharDocumento(original, 'Proposta pronta.pdf', 'Orçamento', 'Mensagem da empresa');
  assert.deepEqual(baixado, { href: 'blob:pdf-exemplo', nome: 'Proposta pronta.pdf' });
});
