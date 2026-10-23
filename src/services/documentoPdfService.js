import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function compartilharDocumento(blob, nome, titulo, texto) {
  if (Capacitor.isNativePlatform()) {
    const dados = await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result.split(',')[1]);
      leitor.onerror = reject;
      leitor.readAsDataURL(blob);
    });
    const arquivo = await Filesystem.writeFile({ path: nome, data: dados, directory: Directory.Cache });
    await Share.share({ title: titulo, text: texto, url: arquivo.uri, dialogTitle: 'Compartilhar PDF' });
    return;
  }
  const arquivo = new File([blob], nome, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [arquivo] }) && navigator.share) {
    try { await navigator.share({ files: [arquivo], title: titulo, text: texto }); return; }
    catch (erro) { if (erro.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = nome; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function imagemDocumento(fonte) {
  if (!fonte) return null;
  let blob = fonte;
  if (!(fonte instanceof Blob)) {
    const resposta = await fetch(fonte, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!resposta.ok) throw new Error('Não foi possível carregar a foto para o PDF. Tente novamente.');
    blob = await resposta.blob();
  }
  // JPEG/PNG são nativos no jsPDF. WebP e SVG são decodificados pelo navegador,
  // evitando a dependência de conversores diferentes no Android e no computador.
  if (/^image\/(png|jpeg)$/.test(blob.type)) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binario = '';
    for (const byte of bytes) binario += String.fromCharCode(byte);
    return `data:${blob.type};base64,${btoa(binario)}`;
  }
  if (typeof document === 'undefined') throw new Error('Formato de imagem não suportado neste ambiente.');
  const url = URL.createObjectURL(blob);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const escala = Math.min(1, 1800 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
