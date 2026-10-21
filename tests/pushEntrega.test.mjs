import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('reentrega simultânea ou após reiniciar o worker mostra um único aviso por dispositivo e dia', async () => {
  const registros = new Set();
  const avisos = [];
  let recusar = false;
  const indexedDB = { open() {
    const pedido = {};
    queueMicrotask(() => {
      pedido.result = { close() {}, transaction() {
        const tx = {};
        tx.objectStore = () => ({
          add(_valor, chave) { queueMicrotask(() => {
            if (registros.has(chave)) { tx.error = { name: 'ConstraintError' }; tx.onabort(); }
            else { registros.add(chave); tx.oncomplete(); }
          }); },
          delete(chave) { queueMicrotask(() => { registros.delete(chave); tx.oncomplete(); }); }
        });
        return tx;
      } };
      pedido.onsuccess();
    });
    return pedido;
  } };
  const fonte = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const iniciar = () => {
    const eventos = {};
    vm.runInNewContext(fonte, { indexedDB, self: {
      addEventListener: (nome, fn) => { eventos[nome] = fn; },
      registration: { showNotification: async (_titulo, dados) => { if (recusar) throw new Error('Permissão revogada'); avisos.push(dados); } }
    } });
    return id => new Promise((resolve, reject) => eventos.push({ data: { json: () => ({ id, body: '1 piscina pendente' }) }, waitUntil: p => p.then(resolve, reject) }));
  };
  const entregar = iniciar();
  await Promise.all([entregar('aparelho1:2026-10-21'), entregar('aparelho1:2026-10-21')]);
  await iniciar()('aparelho1:2026-10-21');
  assert.equal(avisos.length, 1);
  await entregar('aparelho1:2026-10-22');
  assert.equal(avisos.length, 2);
  recusar = true;
  await assert.rejects(entregar('aparelho2:2026-10-22'), /Permissão revogada/);
  recusar = false;
  await entregar('aparelho2:2026-10-22');
  assert.equal(avisos.length, 3);
  assert.equal(avisos[0].renotify, false);
});
