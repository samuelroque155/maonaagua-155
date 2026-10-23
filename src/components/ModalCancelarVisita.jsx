import { useState } from 'react';
import { dataBrasil, somarDiasAgenda } from '../services/agendaService.js';

export default function ModalCancelarVisita({ cliente, temRascunho, confirmar, fechar, gradBtn }) {
  const [remarcar, setRemarcar] = useState(false);
  const [novaData, setNovaData] = useState(somarDiasAgenda(dataBrasil(), 1));
  const [motivo, setMotivo] = useState('');
  const [preservar, setPreservar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="cancelar-visita-titulo" className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl p-5 space-y-4 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100" onSubmit={async e => { e.preventDefault(); setOcupado(true); setErro(''); try { await confirmar({ motivo, novaData: remarcar ? novaData : null, preservar }); fechar(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } }} onKeyDown={e => { if (e.key === 'Escape' && !ocupado) fechar(); }}>
      <h2 id="cancelar-visita-titulo" className="font-bold text-lg">Cancelar visita</h2>
      <p className="text-sm">{cliente.nome} · A limpeza não será marcada como concluída.</p>
      <fieldset disabled={ocupado} className="space-y-3">
        <label className="flex gap-2 items-center text-sm min-h-11"><input type="radio" name="acao-cancelar" checked={!remarcar} onChange={() => setRemarcar(false)} />Cancelar atendimento sem realizar a limpeza</label>
        <label className="flex gap-2 items-center text-sm min-h-11"><input type="radio" name="acao-cancelar" checked={remarcar} onChange={() => setRemarcar(true)} />Cancelar atendimento e remarcar a limpeza</label>
        {remarcar && <label className="block text-sm">Nova data<input required type="date" min={somarDiasAgenda(dataBrasil(), 1)} value={novaData} onChange={e => setNovaData(e.target.value)} className="block w-full p-3 mt-1 border rounded-xl bg-transparent" /></label>}
        <label className="block text-sm">Motivo<textarea autoFocus required maxLength={4000} value={motivo} onChange={e => setMotivo(e.target.value)} className="block w-full p-3 mt-1 border rounded-xl bg-transparent" /></label>
        {temRascunho && <div className="text-sm space-y-2"><p>Há fotos ou dados neste atendimento. Nenhum arquivo sincronizado será apagado.</p><label className="flex gap-2 min-h-11 items-center"><input type="checkbox" checked={preservar} onChange={e => setPreservar(e.target.checked)} />Preservar os dados no registro de cancelamento</label>{!preservar && <p className="text-amber-600">O rascunho local será descartado somente após confirmar o registro. As fotos já enviadas não serão apagadas.</p>}</div>}
      </fieldset>
      {erro && <p role="alert" className="text-sm text-rose-500">{erro}</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={ocupado} onClick={fechar} className="min-h-11 px-2 text-sm">Voltar</button><button disabled={ocupado} className={`min-h-11 px-3 rounded-xl text-sm font-bold ${gradBtn}`}>{ocupado ? 'Salvando…' : 'Confirmar cancelamento'}</button></div>
    </form>
  </div>;
}
