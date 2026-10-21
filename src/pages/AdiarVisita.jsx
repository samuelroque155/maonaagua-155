import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CalendarDays, Camera } from 'lucide-react';
import { compressImage, fileToBase64 } from '../utils/imageUtils';
import { formatarDataAgenda, somarDiasAgenda } from '../services/agendaService';

export default function AdiarVisita({ cliente, dataOriginal, salvando, salvar, voltar }) {
  const [motivo, setMotivo] = useState('');
  const [novaData, setNovaData] = useState('');
  const [compareceu, setCompareceu] = useState(true);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState('');
  const pedidoFoto = useRef(0);
  useEffect(() => () => { pedidoFoto.current++; }, []);
  const selecionarFoto = async evento => {
    const arquivo = evento.target.files?.[0]; evento.target.value = '';
    if (!arquivo) return;
    const pedido = ++pedidoFoto.current;
    setErro(''); setPreparando(true);
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) throw new Error('Selecione uma imagem JPEG, PNG ou WebP.');
      const compactada = await compressImage(arquivo);
      const imagem = await fileToBase64(compactada);
      if (pedido !== pedidoFoto.current) return;
      setFoto(compactada); setPreview(imagem); setCompareceu(true);
    } catch (e) { if (pedido === pedidoFoto.current) setErro(e.message || 'Não foi possível preparar a foto.'); }
    finally { if (pedido === pedidoFoto.current) setPreparando(false); }
  };
  return <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 pb-12">
    <header className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-5 flex items-center gap-3">
      <button disabled={salvando || preparando} onClick={voltar} aria-label="Voltar" className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-teal-500"><ArrowLeft size={20} /></button>
      <h1 className="font-black text-lg text-teal-600">Adiar visita</h1>
    </header>
    <form className="max-w-md mx-auto p-6 space-y-5" onSubmit={e => { e.preventDefault(); if (!salvando && !preparando) salvar({ motivo, novaData, compareceu, foto }); }}>
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 space-y-2">
        <h2 className="font-bold">Cliente: {cliente?.nome}</h2>
        <p className="text-sm text-zinc-500">Visita original: {formatarDataAgenda(dataOriginal)} {cliente?.horaVisita || ''}</p>
        <p className="text-xs text-zinc-500">Os dias fixos do cliente serão mantidos. Este registro não conta como limpeza concluída.</p>
      </section>
      <label className="block text-sm font-bold">Motivo do adiamento
        <textarea required maxLength={4000} value={motivo} disabled={salvando} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: portão fechado, sem ninguém para permitir a entrada." className="block w-full mt-2 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 min-h-28" />
      </label>
      <label className="block text-sm font-bold">Nova data da limpeza
        <input type="date" required min={dataOriginal ? somarDiasAgenda(dataOriginal, 1) : undefined} value={novaData} disabled={salvando} onChange={e => setNovaData(e.target.value)} className="block w-full mt-2 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
      </label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={compareceu} disabled={salvando || Boolean(foto)} onChange={e => setCompareceu(e.target.checked)} />Compareci ao local</label>
      <label className="block text-sm font-bold"><span className="flex items-center gap-2"><Camera size={18} />Foto de comprovação (opcional)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={salvando || preparando} onChange={selecionarFoto} className="block mt-3 w-full text-xs" />
      </label>
      {preparando && <p className="text-sm text-teal-600">Preparando foto...</p>}
      {preview && <div className="space-y-2"><img src={preview} alt="Comprovação de comparecimento" className="w-full max-h-60 object-contain rounded-2xl" /><button type="button" disabled={salvando} onClick={() => { setFoto(null); setPreview(''); }} className="text-xs text-rose-500">Remover foto</button></div>}
      {erro && <p role="alert" className="text-sm text-rose-500">{erro}</p>}
      <button disabled={salvando || preparando || !motivo.trim() || !novaData} className="w-full bg-teal-500 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"><CalendarDays size={18} />{salvando ? 'Salvando adiamento...' : 'Confirmar adiamento'}</button>
    </form>
  </div>;
}
