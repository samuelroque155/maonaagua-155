import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  ArrowLeft, CalendarDays
} from 'lucide-react';

export default function Agenda({ setTela }) {
  const { clientes, gradText, gradBtn, diaAtual } = useContext(AppContext);
  const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto text-zinc-900 dark:text-zinc-100 font-sans pb-20 transition-colors duration-300">
      <header className="flex items-center gap-4 mb-8 pt-2">
        <button onClick={() => setTela('lista')} className="p-2 text-sky-500 bg-sky-50 dark:bg-sky-500/10 rounded-xl"><ArrowLeft size={20} /></button>
        <h2 className={`text-2xl font-black ${gradText}`}>Agenda da Semana</h2>
      </header>
      <div className="space-y-5">
        {diasDaSemanaNomes.map((nomeDia, index) => {
          const clientesDoDia = clientes.filter(c => c.diasVisita.includes(index) || c.adiadoPara === index);
          return (
            <div key={index} className={`bg-white dark:bg-zinc-900 rounded-[1.5rem] overflow-hidden border transition-colors ${index === diaAtual ? 'border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.15)] ring-1 ring-teal-400/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
              <div className={`px-5 py-3.5 font-bold text-sm tracking-wide ${index === diaAtual ? gradBtn + " rounded-none" : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 uppercase text-xs'}`}>{nomeDia} {index === diaAtual && '(Hoje)'}</div>
              <div className="p-5 space-y-3.5">
                {clientesDoDia.length === 0 ? (
                  <p className="text-sm text-zinc-400 dark:text-zinc-600 italic">Livre.</p>
                ) : clientesDoDia.map(c => (
                  <div key={c.id} className="flex items-center justify-between"><span className="text-zinc-700 dark:text-zinc-200 font-medium text-sm">{c.nome}</span>{c.adiadoPara === index && <span className="text-[10px] text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/40 px-2.5 py-1 rounded-md font-bold tracking-wider uppercase border border-teal-200 dark:border-teal-800">Remarcado</span>}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
