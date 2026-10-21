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
  if (fonte.startsWith('data:')) return fonte;
  const resposta = await fetch(fonte);
  if (!resposta.ok) throw new Error('Não foi possível carregar a foto para o PDF. Tente novamente.');
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader(); leitor.onload = () => resolve(leitor.result); leitor.onerror = reject; leitor.readAsDataURL(blob);
  });
}
