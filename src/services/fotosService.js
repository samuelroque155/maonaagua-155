
import { supabase } from '../supabase';

export async function enviarFotoVisita(arquivo) {
  const { data: { user }, error: erroUsuario } =
    await supabase.auth.getUser();

  if (erroUsuario || !user) {
    throw new Error('Você precisa estar conectado.');
  }

  const extensao = arquivo.type === 'image/png'
    ? 'png'
    : arquivo.type === 'image/webp'
      ? 'webp'
      : 'jpg';

  const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;
  const caminho = `${user.id}/visitas/${nomeArquivo}`;

  const { data, error } = await supabase.storage
    .from('fotos-visitas')
    .upload(caminho, arquivo, {
      contentType: arquivo.type,
      upsert: false
    });

  if (error) {
    throw new Error(`Erro ao enviar foto: ${error.message}`);
  }

  return data.path;
}
