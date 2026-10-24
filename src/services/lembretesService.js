import { dataBrasil, horaBrasil, resumirAgendaDia } from './agendaService.js';
const chave = uid => `maonagua_lembretes:${uid}`;
export function lerLembretes(uid, storage = localStorage) {
  try { return { ativo: false, horario: '07:00', ...JSON.parse(storage.getItem(chave(uid)) || '{}') }; }
  catch { return { ativo: false, horario: '07:00' }; }
}
export function salvarLembretes(uid, valor, storage = localStorage) {
  if (!uid || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor.horario)) throw new Error('Escolha um horário válido.');
  storage.setItem(chave(uid), JSON.stringify({ ativo: valor.ativo === true, horario: valor.horario, ...(valor.modo ? { modo: valor.modo, antecedencia: Number(valor.antecedencia || 30), fuso: valor.fuso || 'America/Sao_Paulo' } : {}) }));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('maonagua-lembretes'));
}
export function resumoLembrete(clientes, adiamentos, configuracao, agora = new Date(), antecipacoes = []) {
  if (!configuracao.ativo || configuracao.modo === 'individual') return null;
  let dia = dataBrasil(agora), hora = horaBrasil(agora).slice(0, 5);
  if (configuracao.fuso) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: configuracao.fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(agora).map(p => [p.type, p.value]));
    dia = `${partes.year}-${partes.month}-${partes.day}`; hora = `${partes.hour}:${partes.minute}`;
  }
  if (hora < configuracao.horario) return null;
  const quantidade = resumirAgendaDia(clientes, adiamentos, dia, antecipacoes).totalPendentes;
  return quantidade ? { dia, titulo: 'Lembrete de limpeza', texto: `Você tem ${quantidade} piscina(s) pendente(s) na agenda de hoje. Abra o Mão Na Água para conferir.` } : null;
}
export async function solicitarPermissaoLembretes() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Este navegador não oferece notificações. Use o Chrome no celular com HTTPS.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Notificações não autorizadas. Você pode permitir nas configurações do navegador.');
}
export function observarLembretes({ uid, obterAgenda, storage = localStorage, notificar, agora = () => new Date() }) {
  let ocupado = false, encerrado = false;
  const verificar = async () => {
    if (ocupado || encerrado) return;
    ocupado = true;
    try {
      const configuracao = lerLembretes(uid, storage);
      const { clientes, adiamentos, antecipacoes = [] } = obterAgenda();
      const aviso = resumoLembrete(clientes, adiamentos, configuracao, agora(), antecipacoes);
      if (!aviso || storage.getItem(`${chave(uid)}:ultimo`) === aviso.dia) return;
      if (await notificar(aviso) !== false && !encerrado) storage.setItem(`${chave(uid)}:ultimo`, aviso.dia);
    } catch (e) { console.error('Não foi possível mostrar o lembrete:', e.message); }
    finally { ocupado = false; }
  };
  const timer = setInterval(verificar, 30000);
  window.addEventListener('focus', verificar);
  window.addEventListener('maonagua-lembretes', verificar);
  verificar();
  return () => { encerrado = true; clearInterval(timer); window.removeEventListener('focus', verificar); window.removeEventListener('maonagua-lembretes', verificar); };
}
