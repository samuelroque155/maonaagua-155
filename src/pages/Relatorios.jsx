import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  ArrowLeft, Plus, MapPin, Search, Pencil, Trash2, CalendarDays, FileText
} from 'lucide-react';

export default function Relatorios({ setTela, irParaNovoCliente, abrirEdicaoCliente, abrirRelatorio, excluirCliente }) {
  const { clientes, gradText, gradBtn } = useContext(AppContext);
  const [busca, setBusca] = useState('');

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.endereco.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans pb-24">
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setTela('lista')} className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-black uppercase tracking-tight dark:text-white">Meus Clientes</h1>
        </div>
        <button onClick={irParaNovoCliente} className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20"><Plus size={24} /></button>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        <div className="relative group">
          <Search className="absolute left-4 top-4 text-zinc-400 group-focus-within:text-teal-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Buscar cliente ou bairro..." 
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 pl-12 rounded-2xl text-sm outline-none focus:border-teal-400 dark:text-white transition-all shadow-sm"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filtrados.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 font-bold uppercase tracking-widest text-xs">Nenhum cliente encontrado</div>
          ) : (
            filtrados.map(cliente => (
              <div key={cliente.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-base mb-1">{cliente.nome}</h3>
                    <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cliente.endereco)}`, '_blank')} className="text-left text-xs text-zinc-400 dark:text-zinc-500 line-clamp-1 flex items-center gap-1.5 font-medium hover:text-sky-500 transition-colors active:scale-95 origin-left">
                      <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md"><MapPin size={12} className="text-sky-500" /></div> {cliente.endereco}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => abrirEdicaoCliente(cliente)} className="w-9 h-9 bg-sky-50 dark:bg-sky-900/20 rounded-xl flex items-center justify-center text-sky-500 border border-sky-100 dark:border-sky-900/30 transition-colors hover:bg-sky-100"><Pencil size={16} /></button>
                    <button onClick={() => excluirCliente(cliente.id)} className="w-9 h-9 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center text-rose-500 border border-rose-100 dark:border-rose-900/30 transition-colors hover:bg-rose-100"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800">
                   <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Agenda</span>
                     <div className="flex flex-wrap gap-1">
                        {cliente.diasVisita.map(d => (
                          <span key={d} className="text-[9px] font-bold bg-slate-50 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-md uppercase">
                            {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][d]}
                          </span>
                        ))}
                     </div>
                   </div>
                   <div className="flex flex-col gap-1 items-end">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Relatório</span>
                     <button onClick={() => abrirRelatorio(cliente)} className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-black text-[11px] uppercase tracking-wider hover:underline">
                       <FileText size={14} /> Ver histórico
                     </button>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
