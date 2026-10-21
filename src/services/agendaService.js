export const FUSO_AGENDA = 'America/Sao_Paulo';
const dataFormato = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit' });
const horaFormato = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO_AGENDA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

export function dataValida(data) {
  return /^\d{4}-\d{2}-\d{2}$/.test(data || '') && !Number.isNaN(Date.parse(`${data}T12:00:00Z`)) && new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) === data;
}

export function dataBrasil(valor = new Date()) {
  if (typeof valor === 'string' && dataValida(valor)) return valor;
  const data = new Date(valor);
  if (valor == null || Number.isNaN(data.getTime())) return '';
  const partes = Object.fromEntries(dataFormato.formatToParts(data).map(p => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export const horaBrasil = (valor = new Date()) => horaFormato.format(new Date(valor));
export const formatarDataAgenda = data => dataValida(data) ? data.split('-').reverse().join('/') : 'Não informada';
export const diaSemanaAgenda = data => new Date(`${data}T12:00:00Z`).getUTCDay();
export function somarDiasAgenda(data, quantidade) {
  const nova = new Date(`${data}T12:00:00Z`);
  nova.setUTCDate(nova.getUTCDate() + quantidade);
  return nova.toISOString().slice(0, 10);
}

export function estadoAgendaCliente(cliente, data, adiamentos = []) {
  if (!dataValida(data)) return { programada: false, reagendada: false, adiada: false, concluida: false, pendente: false };
  const registros = adiamentos.filter(a => String(a.cliente_id) === String(cliente.id));
  const adiada = registros.some(a => a.data_original === data);
  const reagendada = registros.some(a => a.nova_data === data);
  const recorrente = (cliente.diasVisita || cliente.dias_visita || []).map(Number).includes(diaSemanaAgenda(data));
  const concluida = Array.isArray(cliente.datasConcluidas)
    ? cliente.datasConcluidas.includes(data)
    : Boolean(cliente.ultimaVisita) && dataBrasil(cliente.ultimaVisita) === data;
  const programada = !adiada && (recorrente || reagendada);
  return { programada, reagendada, adiada, concluida, pendente: programada && !concluida };
}

export function resumirAgendaDia(clientes, adiamentos = [], data = dataBrasil()) {
  const programadas = clientes.filter(c => estadoAgendaCliente(c, data, adiamentos).programada);
  const pendentes = programadas.filter(c => !estadoAgendaCliente(c, data, adiamentos).concluida);
  return { programadas, pendentes, totalPendentes: pendentes.length };
}

// O timer usa o relógio brasileiro e é rearmado ao voltar do segundo plano.
export function observarDiaBrasil({ atualizar, janela, documento, agora = () => new Date(), agendar = setTimeout, cancelar = clearTimeout }) {
  let timer;
  const verificar = () => {
    cancelar(timer);
    const data = agora();
    atualizar(data);
    const [h, m, s] = horaBrasil(data).split(':').map(Number);
    const restante = (86400 - h * 3600 - m * 60 - s) * 1000 - data.getMilliseconds() + 50;
    timer = agendar(verificar, Math.max(50, restante));
  };
  const aoFicarVisivel = () => { if (!documento.hidden) verificar(); };
  verificar();
  janela.addEventListener('focus', verificar);
  documento.addEventListener('visibilitychange', aoFicarVisivel);
  return () => {
    cancelar(timer);
    janela.removeEventListener('focus', verificar);
    documento.removeEventListener('visibilitychange', aoFicarVisivel);
  };
}
