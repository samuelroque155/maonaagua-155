import { dataBrasil, dataValida } from './agendaService.js';

export async function listarAntecipacoes(client, dono, clienteId = null, permitirAusente = false) {
  const registros = [];
  for (let inicio = 0; ; inicio += 500) {
    let query = client.from('antecipacoes_visitas').select('*').eq('user_id', dono).order('id').range(inicio, inicio + 499);
    if (clienteId != null) query = query.eq('cliente_id', clienteId);
    const { data, error } = await query;
    if (error) { if (permitirAusente && ['42P01', 'PGRST205'].includes(error.code)) return []; throw error; }
    registros.push(...data);
    if (data.length < 500) return registros;
  }
}

export async function anteciparVisita(client, { id, dono, clienteId, dataOriginal, novaData, motivo = '' }) {
  if (!dataValida(dataOriginal) || !dataValida(novaData) || novaData < dataBrasil() || novaData >= dataOriginal) throw new Error('Escolha uma data entre hoje e o dia anterior à visita original.');
  const { data, error } = await client.from('antecipacoes_visitas').insert({ id, user_id: dono, cliente_id: clienteId, data_original: dataOriginal, nova_data: novaData, motivo: motivo.trim() }).select().single();
  if (error) {
    // Repetir uma requisição após perda de conexão não cria outra ocorrência.
    if (error.code === '23505') {
      const resultado = await client.from('antecipacoes_visitas').select('*').eq('id', id).single();
      const r = resultado.data;
      if (!resultado.error && r && !r.cancelado_em && r.user_id === dono && String(r.cliente_id) === String(clienteId) && r.data_original === dataOriginal && r.nova_data === novaData && r.motivo === motivo.trim()) return r;
    }
    throw error;
  }
  return data;
}

export async function cancelarAntecipacao(client, id) {
  const { error } = await client.from('antecipacoes_visitas').update({ cancelado_em: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
}

export function descricaoAntecipacao(a) {
  return `Visita prevista: ${a.data_original.split('-').reverse().join('/')} · antecipada para ${a.nova_data.split('-').reverse().join('/')}${a.motivo ? ` · Motivo: ${a.motivo}` : ''}${a.cancelado_em ? ' · Antecipação cancelada' : ''}`;
}
