import { dataValida, dataBrasil } from './agendaService.js';
import { fotosDaVisita } from './visitaEstado.js';

export function prepararRascunhoCancelamento(dados, userId, clienteId) {
  const fotos = [...(dados.fotosVisita || []), ...(dados.fotosAlerta || [])];
  if (!fotosDaVisita(fotos, userId, clienteId)) throw new Error('Há fotos de outro atendimento neste rascunho.');
  if (fotos.some(f => f.status !== 'ready' || !f.caminho)) throw new Error('Aguarde o envio das fotos antes de preservar o rascunho ou escolha descartá-lo.');
  return { ph: dados.ph || '', cloro: dados.cloro || '', alcalinidade: dados.alcalinidade || '', temperatura: dados.temperatura || '', aspecto: dados.aspecto || '', observacoes: dados.textoAlerta || '', produtos: dados.produtosFaltando || [], fotos: (dados.fotosVisita || []).map(f => f.caminho), fotos_alerta: (dados.fotosAlerta || []).map(f => f.caminho) };
}

export async function cancelarAtendimento(client, { id, userId, ownerId, clienteId, iniciadoEm, dataOriginal, novaData = null, motivo, rascunho = {} }) {
  if (!id || !dataValida(dataOriginal) || !Number.isFinite(Date.parse(iniciadoEm)) || !motivo?.trim()) throw new Error('Informe o motivo e identifique o atendimento iniciado.');
  if (novaData && (!dataValida(novaData) || novaData <= dataOriginal || novaData <= dataBrasil())) throw new Error('Escolha uma nova data futura, após a ocorrência original.');
  const { data: auth, error: erroAuth } = await client.auth.getUser();
  if (erroAuth || auth?.user?.id !== userId) throw new Error('Sua sessão mudou. Entre novamente.');
  const registro = { id, user_id: ownerId, cliente_id: clienteId, iniciado_em: iniciadoEm, data_original: dataOriginal, nova_data: novaData || null, motivo: motivo.trim(), rascunho };
  const { error } = await client.from('cancelamentos_visitas').insert(registro);
  if (error && error.code !== '23505') {
    if (['42P01','PGRST205'].includes(error.code)) throw new Error('O cancelamento ainda precisa da migração de banco neste ambiente. O atendimento e seu rascunho foram mantidos.');
    throw error;
  }
  const { data, error: leitura } = await client.from('cancelamentos_visitas').select('*').eq('id', id).single();
  const canonico = valor => JSON.stringify(valor, function(k,v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v; });
  if (leitura || !data || data.id !== id || data.user_id !== ownerId || data.criado_por !== userId || String(data.cliente_id) !== String(clienteId) || data.data_original !== dataOriginal || data.nova_data !== (novaData || null) || data.motivo !== motivo.trim() || Date.parse(data.iniciado_em) !== Date.parse(iniciadoEm) || canonico(data.rascunho) !== canonico(rascunho)) throw new Error('Não foi possível confirmar este cancelamento. O rascunho foi mantido; atualize e tente novamente.');
  return data;
}

export async function atendimentoJaCancelado(client, id, userId) {
  if (!id) return false;
  const { data, error } = await client.from('cancelamentos_visitas').select('id').eq('id', id).eq('criado_por', userId).maybeSingle();
  if (error && !['42P01','PGRST205'].includes(error.code)) throw error;
  return Boolean(data);
}

export async function listarCancelamentos(client, dono, clienteId) {
  const registros = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await client.from('cancelamentos_visitas').select('*').eq('user_id', dono).eq('cliente_id', clienteId).order('id').range(inicio, inicio + 499);
    if (error) { if (['42P01','PGRST205'].includes(error.code)) return []; throw error; }
    registros.push(...data);
    if (data.length < 500) return registros;
  }
}
