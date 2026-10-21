// Documentos e rascunhos independentes dos clientes e da fila de visitas.
let fila = Promise.resolve();
export function chaveArquivoLocal(userId, grupo, id) {
  if (!userId || !grupo || !id) throw new Error('Entre na sua conta para salvar este documento.');
  return JSON.stringify([String(userId), String(grupo), String(id)]);
}
function operar(modo, acao) {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open('MaoNaAguaDocumentos', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('arquivos');
    pedido.onerror = () => reject(pedido.error);
    pedido.onsuccess = () => {
      const banco = pedido.result;
      const tx = banco.transaction('arquivos', modo);
      const resultado = acao(tx.objectStore('arquivos'));
      tx.oncomplete = () => { banco.close(); resolve(resultado.result); };
      tx.onerror = tx.onabort = () => { banco.close(); reject(tx.error || new Error('Não foi possível salvar no aparelho.')); };
    };
  });
}
function executar(acao) {
  const pedido = fila.then(acao);
  fila = pedido.catch(() => {});
  return pedido;
}
export const lerArquivoLocal = (uid, grupo, id) => executar(() => operar('readonly', s => s.get(chaveArquivoLocal(uid, grupo, id))));
export const salvarArquivoLocal = (uid, grupo, id, valor) => executar(() => operar('readwrite', s => s.put(valor, chaveArquivoLocal(uid, grupo, id))));
