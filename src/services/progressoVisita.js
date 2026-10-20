// Banco separado da fila antiga do Firebase. Arquivos e previews sobrevivem
// ao fechamento do app, sem depender de blob URLs ou da cota do localStorage.
let fila = Promise.resolve();

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open('MaoNaAguaRascunhos', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('visitas');
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function executar(modo, acao) {
  const banco = await abrirBanco();
  try {
    return await new Promise((resolve, reject) => {
      const tx = banco.transaction('visitas', modo);
      const pedido = acao(tx.objectStore('visitas'));
      tx.oncomplete = () => resolve(pedido.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Rascunho não salvo.'));
    });
  } finally {
    banco.close();
  }
}

function enfileirar(acao) {
  const resultado = fila.then(acao);
  fila = resultado.catch(() => {});
  return resultado;
}

export function salvarProgresso(userId, progresso) {
  return enfileirar(() => executar('readwrite', store => store.put(progresso, userId)));
}

export function removerProgresso(userId) {
  // Marca o rascunho como encerrado para não ressuscitar o legado.
  return enfileirar(() => executar('readwrite', store => store.put({ finalizado: true }, userId)));
}

export async function lerProgresso(userId) {
  await fila;
  const atual = await executar('readonly', store => store.get(userId));
  if (atual) return atual.finalizado ? null : atual;
  // Compatibilidade: não remove nem modifica o rascunho da versão anterior.
  const legado = JSON.parse(localStorage.getItem('maonagua_visita_progresso') || 'null');
  if (!legado) return null;
  if (legado.userId) return legado.userId === userId ? legado : null;
  const fotos = [...(legado.fotosVisita || []), ...(legado.fotosAlerta || [])];
  // Rascunhos antigos não identificavam a conta. Quando há caminhos,
  // só restaura aqueles que pertencem ao usuário conectado.
  if (fotos.some(foto => foto.caminho && !foto.caminho.startsWith(`${userId}/`))) return null;
  return legado;
}
