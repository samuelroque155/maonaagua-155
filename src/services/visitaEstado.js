// Usa datas locais: a próxima visita vence no início do dia agendado.
export function limpezaConcluida(cliente, hoje = new Date()) {
  if (!cliente.ultimaVisita) return false;
  const ultima = new Date(cliente.ultimaVisita);
  if (Number.isNaN(ultima.getTime())) return false;
  ultima.setHours(0, 0, 0, 0);
  const diaHoje = new Date(hoje);
  diaHoje.setHours(0, 0, 0, 0);
  if (diaHoje < ultima) return false;
  const dias = (cliente.diasVisita || []).map(Number);
  for (let offset = 1; offset <= 7; offset += 1) {
    const proxima = new Date(ultima);
    proxima.setDate(proxima.getDate() + offset);
    if (dias.includes(proxima.getDay())) return diaHoje < proxima;
  }
  // Sem agenda, não há próxima visita para vencer a conclusão.
  return true;
}

export function criarControleBusca() {
  let versao = 0;
  return {
    iniciar: () => ++versao,
    invalidar: () => { versao += 1; },
    atual: id => id === versao
  };
}

export function visitasDoCliente(historico, clienteId) {
  return historico.filter(visita => String(visita.clienteId) === String(clienteId));
}

export function fotosDaVisita(fotos, userId, clienteId, visitaId = null) {
  return fotos.every(foto =>
    (!foto.userId || foto.userId === userId) &&
    (!foto.clienteId || String(foto.clienteId) === String(clienteId)) &&
    (!foto.visitaId || foto.visitaId === visitaId)
  );
}
