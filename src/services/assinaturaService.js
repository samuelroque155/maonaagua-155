export function temAcessoAoApp(usuario, perfil) {
  return Boolean(usuario) && (perfil?.assinaturaAtiva === true || usuario.app_metadata?.role === 'admin');
}

// Consulta apenas o direito de acesso da própria conta; não grava pagamentos.
export async function consultarAssinatura(client, userId) {
  const { data: sessao, error: erroSessao } = await client.auth.getUser();
  if (erroSessao) throw erroSessao;
  if (!sessao.user || sessao.user.id !== userId) throw new Error('Sua sessão mudou. Entre novamente.');
  const { data, error } = await client.from('perfis')
    .select('id, assinatura_ativa').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data || data.id !== userId || typeof data.assinatura_ativa !== 'boolean') {
    throw new Error('Não foi possível confirmar a assinatura desta conta.');
  }
  return data.assinatura_ativa;
}

export function checkoutKiwify(endereco) {
  if (!endereco) return null;
  try {
    const url = new URL(endereco);
    if (url.protocol !== 'https:' || url.hostname !== 'pay.kiwify.com.br' || url.username || url.password || url.pathname === '/') return null;
    return url.href;
  } catch { return null; }
}
