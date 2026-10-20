export function caminhoImagemPerfilValido(caminho, userId) {
  return typeof caminho === 'string' && caminho.startsWith(`${userId}/perfil/`)
    && !caminho.includes('..') && !caminho.includes('?');
}

export async function enviarImagemPerfil(client, userId, arquivo) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user?.id !== userId) throw new Error('Sua sessão mudou. Entre novamente antes de salvar a foto.');
  if (!(arquivo instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) || arquivo.size > 200 * 1024) {
    throw new Error('Selecione uma imagem JPEG, PNG ou WebP de até 200 KB após a preparação.');
  }
  const extensao = arquivo.type === 'image/png' ? 'png' : arquivo.type === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${userId}/perfil/${crypto.randomUUID()}.${extensao}`;
  const { error: erroEnvio } = await client.storage.from('fotos-visitas').upload(caminho, arquivo, {
    contentType: arquivo.type, upsert: false
  });
  if (erroEnvio) throw erroEnvio;
  return caminho;
}

export async function resolverImagemPerfil(client, perfil, estrito = false) {
  if (!perfil?.fotoPerfilCaminho) return '';
  const { data, error } = await client.storage.from('fotos-visitas').createSignedUrl(perfil.fotoPerfilCaminho, 3600);
  if (error || !data?.signedUrl) {
    if (estrito) throw new Error('Não foi possível carregar sua foto ou logo. Confira a conexão e tente novamente.');
    return '';
  }
  return data.signedUrl;
}
