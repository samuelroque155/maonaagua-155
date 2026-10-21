import { useEffect, useRef, useState } from 'react';
import { lerArquivoLocal, salvarArquivoLocal } from './arquivoLocalService.js';

export function useRascunhoOcorrencia(userId, contexto) {
  const [estado, setEstado] = useState({ chave: '', foto: null, texto: '', registro: null });
  const [erro, setErro] = useState('');
  const atual = useRef(null);
  const chave = `${userId || ''}:${contexto}`;
  useEffect(() => {
    let ativo = true;
    if (!userId) return;
    lerArquivoLocal(userId, 'ocorrencia', contexto).then(salvo => {
      if (!ativo) return;
      const restaurado = { foto: null, texto: '', registro: null, ...salvo, chave };
      atual.current = restaurado; setEstado(restaurado); setErro('');
    }).catch(() => { if (ativo) setErro('Não foi possível restaurar o rascunho. Reabra a tela antes de registrar outra ocorrência.'); });
    return () => { ativo = false; };
  }, [userId, contexto, chave]);
  const atualizar = mudanca => {
    if (atual.current?.chave !== chave) return;
    const novo = { ...atual.current, ...mudanca };
    atual.current = novo; setEstado(novo);
    // Somente Base64 durável; previews blob nunca são persistidos.
    const foto = novo.foto?.base64 ? { ...novo.foto, url: novo.foto.base64, status: 'ready' } : null;
    salvarArquivoLocal(userId, 'ocorrencia', contexto, { ...novo, foto }).then(() => setErro('')).catch(() => setErro('Não foi possível guardar o rascunho no aparelho. Não feche o app antes de registrar a ocorrência.'));
  };
  const pronto = estado.chave === chave;
  return { foto: pronto ? estado.foto : null, texto: pronto ? estado.texto : '', registro: pronto ? estado.registro : null, pronto, erro, atualizar };
}
