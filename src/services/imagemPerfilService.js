import { imagemDocumento } from './documentoPdfService.js';

export function caminhoImagemPerfilValido(caminho, userId) {
  return typeof caminho === 'string' && caminho.startsWith(`${userId}/perfil/`)
    && !caminho.includes('..') && !caminho.includes('?');
}

export async function imagemProfissionalPDF(client, perfil) {
  try {
    if (perfil?.fotoPerfilCaminho) {
      // Obtém bytes novos com a sessão atual, não a URL assinada de horas atrás.
      const { data, error } = await client.storage.from('fotos-visitas').download(perfil.fotoPerfilCaminho);
      if (error || !data) throw error || new Error('Imagem não encontrada.');
      return { imagem: await imagemDocumento(data), aviso: '' };
    }
    return { imagem: await imagemDocumento(perfil?.fotoPerfilUrl), aviso: '' };
  } catch {
    return { imagem: null, aviso: 'A imagem do perfil não pôde ser carregada. O PDF foi gerado com a identidade padrão; confira a conexão e a imagem salva no perfil.' };
  }
}

export async function imagensRelatorioPDF(client, historico) {
  return Promise.all(historico.map(async v => {
    let falhas = 0;
    const carregar = async (caminhos, fontes) => {
      const itens = caminhos?.length ? caminhos : fontes || [];
      return (await Promise.all(itens.map(async fonte => {
        try {
          if (caminhos?.length) {
            const { data, error } = await client.storage.from('fotos-visitas').download(fonte);
            if (error || !data) throw error || new Error('Imagem ausente');
            return await imagemDocumento(data);
          }
          return await imagemDocumento(fonte);
        } catch { falhas++; return null; }
      }))).filter(Boolean);
    };
    const fotosBase64 = await carregar(v.fotosCaminhos, v.fotosBase64?.length ? v.fotosBase64 : v.fotos);
    const fotosAlertaBase64 = await carregar(v.fotosAlertaCaminhos, v.fotosAlertaBase64?.length ? v.fotosAlertaBase64 : v.fotosA);
    return { ...v, fotosBase64, fotosAlertaBase64, fotos: fotosBase64, fotosA: fotosAlertaBase64, fotosMiniaturas: [], fotosAlertaMiniaturas: [], fotosIndisponiveis: falhas };
  }));
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
