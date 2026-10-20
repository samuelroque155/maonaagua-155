const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pendenciasDaConta(pendentes, userId) {
  return pendentes.filter(p => p.userId === userId);
}

export function prepararVisitaPendente(p, fotos, fotosAlerta) {
  if (!p.userId || !p.ownerId || !UUID.test(p.supabaseId || '')) {
    throw new Error('Registro antigo sem identificação segura. A fila foi preservada.');
  }
  return {
    id: p.supabaseId, user_id: p.ownerId, criado_por: p.userId, cliente_id: p.clienteId,
    tipo: p.tipo === 'problema' ? 'problema' : 'visita',
    data_visita: new Date(p.ts).toISOString(), horario: p.h || '',
    cloro: p.c || '', ph: p.p || '', alcalinidade: p.al || '', temperatura: p.t || '',
    aspecto: p.asp || '', observacoes: p.txtA || '', produtos: p.prods || [],
    fotos, fotos_alerta: fotosAlerta
  };
}

export async function sincronizarPendencia({ client, pendente, userId, salvar, remover, aindaAtual = () => true }) {
  if (pendente.userId !== userId || !aindaAtual()) throw new Error('A pendência pertence a outra conta.');
  prepararVisitaPendente(pendente, [], []);
  const conferirSessao = async () => {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (data.user?.id !== userId || !aindaAtual()) throw new Error('Sua sessão mudou. A fila foi preservada.');
  };
  await conferirSessao();
  // Cada upload confirmado é guardado antes do próximo passo, inclusive em caso de falha.
  const enviar = async (fontes, campo) => {
    pendente[campo] ||= [];
    for (let i = 0; i < fontes.length; i++) {
      if (pendente[campo][i]) continue;
      await conferirSessao();
      const fonte = fontes[i];
      if (!(fonte instanceof Blob) && !(typeof fonte === 'string' && fonte.startsWith('data:image/'))) {
        throw new Error('Foto local inválida. A fila foi preservada.');
      }
      const blob = fonte instanceof Blob ? fonte : await fetch(fonte).then(r => r.blob());
      const caminho = `${userId}/visitas/${pendente.supabaseId}/${campo}-${i}`;
      const { error } = await client.storage.from('fotos-visitas').upload(caminho, blob,
        { contentType: blob.type || 'image/jpeg', upsert: false });
      // Caminho determinístico: uma repetição após queda não gera outra foto.
      if (error && String(error.statusCode) !== '409' && error.error !== 'Duplicate') throw error;
      pendente[campo][i] = caminho;
      await salvar(pendente);
    }
    return pendente[campo];
  };
  const fotos = await enviar(pendente.fotosArquivos?.length ? pendente.fotosArquivos : pendente.fotosBase64 || [], 'caminhosFotos');
  const alertas = await enviar(pendente.fotosAlertaArquivos?.length ? pendente.fotosAlertaArquivos : pendente.fotosAlertaBase64 || [], 'caminhosAlertas');
  await conferirSessao();
  const registro = prepararVisitaPendente(pendente, [...(pendente.fotosExistentes || []), ...fotos],
    [...(pendente.fotosAlertaExistentes || []), ...alertas]);
  const { error } = await client.from('visitas').upsert(registro, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  // A resposta de gravação pode se perder. Confirma a identidade persistida antes de remover a cópia local.
  const { data, error: erroLeitura } = await client.from('visitas').select('id, user_id, cliente_id, criado_por')
    .eq('id', registro.id).eq('user_id', registro.user_id).single();
  if (erroLeitura) throw erroLeitura;
  if (data.criado_por !== userId || String(data.cliente_id) !== String(registro.cliente_id)) {
    throw new Error('Não foi possível confirmar a visita enviada.');
  }
  await conferirSessao();
  await remover(pendente.id);
  return registro;
}
