import { useEffect, useRef, useState } from 'react';
import { dataBrasil, formatarDataAgenda, somarDiasAgenda } from '../services/agendaService.js';
export default function ModalAntecipacao({ cliente, dataOriginal, salvar, fechar, gradBtn }) {
  const [data, setData] = useState(dataBrasil());
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const formulario = useRef(null);
  useEffect(() => {
    const anterior = document.activeElement;
    const prenderFoco = e => {
      if (e.key !== 'Tab') return;
      const itens = [...formulario.current.querySelectorAll('input:not(:disabled),button:not(:disabled)')];
      const primeiro = itens[0], ultimo = itens.at(-1);
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
    };
    const elemento = formulario.current;
    elemento.addEventListener('keydown', prenderFoco);
    return () => { elemento.removeEventListener('keydown', prenderFoco); anterior?.focus(); };
  }, []);
  const confirmar = async e => {
    e.preventDefault(); setOcupado(true); setErro('');
    try { await salvar(data, motivo); fechar(); } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { if (!ocupado) fechar(); }}>
    <form ref={formulario} role="dialog" aria-modal="true" aria-labelledby="titulo-antecipar" onClick={e => e.stopPropagation()} onSubmit={confirmar} onKeyDown={e => { if (e.key === 'Escape' && !ocupado) fechar(); }} className="w-full max-w-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl p-5 space-y-4 shadow-xl">
      <h2 id="titulo-antecipar" className="font-bold text-lg">Antecipar visita</h2>
      <p className="text-sm">{cliente.nome} · prevista para {formatarDataAgenda(dataOriginal)}</p>
      <label className="block text-sm">Nova data<input autoFocus required type="date" min={dataBrasil()} max={somarDiasAgenda(dataOriginal, -1)} value={data} onChange={e => setData(e.target.value)} className="block w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950" /></label>
      <label className="block text-sm">Motivo (opcional)<input maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: feriado" className="block w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950" /></label>
      <p className="text-xs text-zinc-500">Somente esta visita será transferida. Os dias fixos do cliente continuam iguais.</p>
      {erro && <p role="alert" className="text-sm text-rose-500">{erro}</p>}
      <div className="flex gap-2 justify-end"><button type="button" disabled={ocupado} onClick={fechar} className="min-h-11 px-3 text-sm">Voltar</button><button disabled={ocupado} className={`min-h-11 px-4 rounded-xl text-sm font-bold ${gradBtn}`}>{ocupado ? 'Salvando…' : 'Confirmar'}</button></div>
    </form>
  </div>;
}
