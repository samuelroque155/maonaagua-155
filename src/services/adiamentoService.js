import { dataBrasil, dataValida, formatarDataAgenda, horaBrasil } from './agendaService.js';

export async function enviarFotoAdiamento(client, userId, arquivo) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user?.id !== userId) throw new Error('Sua sessão mudou. Entre novamente.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) || arquivo.size > 250000) throw new Error('A foto de comprovação precisa ser uma imagem compactada.');
  const extensao = arquivo.type === 'image/png' ? 'png' : arquivo.type === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${userId}/adiamentos/${crypto.randomUUID()}.${extensao}`;
  const { error: erroUpload } = await client.storage.from('fotos-visitas').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (erroUpload) throw erroUpload;
  return caminho;
}

export function migracaoAdiamentosAusente(erro) { return ['42P01', 'PGRST205'].includes(erro?.code); }

export async function listarAdiamentos(client, ownerId, clienteId = null, permitirAusente = false) {
  const registros = [];
  for (let inicio = 0; ; inicio += 500) {
    let consulta = client.from('adiamentos_visitas').select('*').eq('user_id', ownerId);
    if (clienteId != null) consulta = consulta.eq('cliente_id', clienteId);
    const { data, error } = await consulta.order('criado_em', { ascending: false }).order('id').range(inicio, inicio + 499);
    if (error) {
      if (permitirAusente && migracaoAdiamentosAusente(error)) return [];
      throw error;
    }
    registros.push(...(data || []));
    if ((data || []).length < 500) return registros;
  }
}

export async function paginaConclusoesAgenda(client, ownerId, inicio, tamanho = 500) {
  const resultado = await client.rpc('conclusoes_agenda', { dono: ownerId }).order('id').range(inicio, inicio + tamanho - 1);
  if (resultado.error?.code === 'PGRST202') {
    return client.from('visitas').select('id,cliente_id,data_visita,created_at').eq('tipo', 'visita')
      .eq('user_id', ownerId).order('id').range(inicio, inicio + tamanho - 1);
  }
  return resultado;
}

export async function salvarAdiamento(client, { id, userId, ownerId, clienteId, dataOriginal, novaData, motivo, compareceu, fotoCaminho = null }) {
  const { data: usuario, error: erroUsuario } = await client.auth.getUser();
  if (erroUsuario) throw erroUsuario;
  if (usuario.user?.id !== userId) throw new Error('Sua sessão mudou. Entre novamente.');
  if (!dataValida(dataOriginal) || dataOriginal !== dataBrasil() || !dataValida(novaData) || novaData <= dataOriginal || !motivo?.trim()) {
    throw new Error('Informe o motivo e uma data posterior ao atendimento de hoje.');
  }
  const registro = { id, user_id: ownerId, criado_por: userId, cliente_id: clienteId,
    data_original: dataOriginal, nova_data: novaData, motivo: motivo.trim(),
    comparecimento_em: compareceu ? new Date().toISOString() : null, foto_caminho: fotoCaminho };
  const { error } = await client.from('adiamentos_visitas').insert(registro);
  if (error && error.code !== '23505') throw error;
  const { data, error: erroLeitura } = await client.from('adiamentos_visitas').select('*').eq('id', id).eq('user_id', ownerId).single();
  if (erroLeitura || !data) throw new Error(error?.code === '23505' ? 'Esta visita já foi adiada. Atualize a agenda.' : 'Não foi possível confirmar o adiamento. Tente novamente.');
  if (String(data.cliente_id) !== String(clienteId) || data.nova_data !== novaData || data.motivo !== motivo.trim()) throw new Error('Este adiamento já foi registrado com outros dados. Atualize a agenda.');
  return data;
}

export function adiamentoParaRelatorio(registro, fotoUrl = '') {
  return { id: `adiamento:${registro.id}`, clienteId: registro.cliente_id, tipo: 'adiamento',
    d: formatarDataAgenda(registro.data_original), dataISO: registro.data_original,
    h: horaBrasil(registro.criado_em), ts: new Date(registro.criado_em).getTime(),
    dataOriginal: registro.data_original, horarioOriginal: registro.horario_original,
    novaData: registro.nova_data, motivo: registro.motivo, comparecimentoEm: registro.comparecimento_em,
    criadoEm: registro.criado_em, criadoPor: registro.criado_por,
    fotos: fotoUrl ? [fotoUrl] : [], fotosA: [], prods: [] };
}
