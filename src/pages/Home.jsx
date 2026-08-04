import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  Camera, ShoppingCart, MapPin, Plus, CalendarDays, RefreshCw, LogOut, Sun, Moon, Search, Navigation, Clock, BellRing, Settings, ShieldCheck, Cloud, CloudOff, UserPlus, User, Briefcase, Activity
} from 'lucide-react';

export default function Home({ iniciarVisita, reabrirTarefaDaHome, setTela, toast }) {
  const { 
    user, perfil, clientes, modoEscuro, setModoEscuro, 
    pendentesCount, isSyncing, handleSair, gradText, gradBtn, 
    diaAtual, dataHojeStr, processarFilaSincronizacao, tela, targetUid
  } = useContext(AppContext);
  
  let clientesFiltrados = clientes;
  if (perfil.tipoConta === 'funcionario' && perfil.rotas) {
    clientesFiltrados = clientes.filter(c => perfil.rotas.includes(c.id));
  }
  const piscinasDeHoje = clientesFiltrados.filter(c => c.diasVisita.includes(diaAtual) || c.adiadoPara === diaAtual);

  const visitasEmAndamento = perfil.tipoConta === 'empresa' 
    ? clientes.filter(c => c.visitaEmAndamentoData === dataHojeStr)
    : [];
  const ADMIN_EMAIL = 'samuelroque155@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans pb-24 transition-colors duration-300 relative overflow-x-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className="bg-zinc-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-zinc-700 flex items-center gap-3">
            <span className="font-bold text-sm whitespace-nowrap">{toast}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800/50 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <span className="text-white font-bold text-xl">{perfil.empresa.charAt(0)}</span>
            </div>
            <div>
              <h1 className={`text-xl font-black uppercase tracking-tight ${gradText}`}>{perfil.empresa}</h1>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><MapPin size={10} /> {perfil.cidade}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
              <button onClick={() => setTela('admin_panel')} className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <ShieldCheck size={18} />
              </button>
            )}
            <button onClick={() => setModoEscuro(!modoEscuro)} className="w-9 h-9 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">
              {modoEscuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => processarFilaSincronizacao(user.uid, clientes, targetUid)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${pendentesCount > 0 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-slate-50 dark:bg-zinc-800 text-teal-500'}`}
            >
              {isSyncing ? <Cloud size={18} className="animate-pulse" /> : pendentesCount > 0 ? <CloudOff size={18} /> : <Cloud size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        {/* Status Bar */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center text-sky-500">
               <CalendarDays size={20} />
             </div>
             <div>
               <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">Agenda de Hoje</p>
               <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">{piscinasDeHoje.length} Piscinas</p>
             </div>
           </div>
           <button onClick={() => setTela('agenda')} className="text-[10px] font-black text-teal-500 uppercase tracking-widest bg-teal-50 dark:bg-teal-900/20 px-4 py-2 rounded-xl">Ver Semana</button>
        </div>

        {perfil.tipoConta === 'empresa' && visitasEmAndamento.length > 0 && (
           <div className="bg-sky-50 dark:bg-sky-900/10 p-5 rounded-[2rem] border border-sky-200 dark:border-sky-800/50">
             <div className="flex items-center gap-2 mb-3">
               <Activity size={18} className="text-sky-500 animate-pulse" />
               <h3 className="text-xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">Em Andamento (Ao Vivo)</h3>
             </div>
             <div className="space-y-2">
               {visitasEmAndamento.map(v => (
                 <div key={v.id} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-sky-100 dark:border-sky-900/30">
                   <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{v.nome}</span>
                   <span className="text-[10px] bg-sky-100 dark:bg-sky-800 text-sky-600 dark:text-sky-300 px-2 py-1 rounded-md font-bold uppercase">Em Atendimento</span>
                 </div>
               ))}
             </div>
           </div>
         )}

        {/* Lista de Clientes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Limpar Hoje</h2>
            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          
          {piscinasDeHoje.length === 0 ? (
             <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
               <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400/30">
                 <Plus size={32} />
               </div>
               <p className="text-sm font-bold text-zinc-400">Tudo limpo por hoje!</p>
             </div>
          ) : (
            piscinasDeHoje.map(cliente => {
              const concluida = cliente.ultimaVisita === dataHojeStr;
              const emAndamento = cliente.visitaEmAndamentoData === dataHojeStr && !concluida;
              
              return (
                <div key={cliente.id} className={`group bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border transition-all duration-300 ${concluida ? 'border-emerald-200 dark:border-emerald-900/30' : emAndamento ? 'border-sky-300 dark:border-sky-700' : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md'}`}>
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex-1">
                       <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-base mb-1">{cliente.nome}</h3>
                       <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cliente.endereco)}`, '_blank')} className="text-left text-xs text-zinc-400 dark:text-zinc-500 line-clamp-1 flex items-center gap-1.5 font-medium hover:text-sky-500 transition-colors active:scale-95 origin-left">
                         <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md"><MapPin size={12} className="text-sky-500" /></div> {cliente.endereco}
                       </button>
                     </div>
                     <div className="flex flex-col items-end gap-1.5">
                        {cliente.horaVisita && <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-md flex items-center gap-1"><Clock size={10} /> {cliente.horaVisita}</span>}
                        {concluida && <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">Finalizada</span>}
                     </div>
                   </div>
                   
                   {!concluida ? (
                     <button onClick={() => iniciarVisita(cliente)} className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 ${emAndamento ? 'bg-zinc-800 dark:bg-zinc-700 text-white' : gradBtn}`}>
                        {emAndamento ? 'CONTINUAR LIMPEZA' : 'INICIAR LIMPEZA'} <Navigation size={18} fill="currentColor" />
                     </button>
                   ) : (
                      <button onClick={() => reabrirTarefaDaHome(cliente)} className="w-full py-3.5 rounded-xl font-bold text-[10px] bg-slate-50 dark:bg-zinc-800 text-zinc-400 border border-zinc-100 dark:border-zinc-700 uppercase tracking-widest hover:bg-zinc-100 transition-colors">Reabrir Visita</button>
                   )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Nav Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 p-4 flex justify-around items-center z-40 max-w-md mx-auto rounded-t-[2.5rem] shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        {perfil.tipoConta !== 'funcionario' && (
          <button onClick={() => setTela('novo_cliente')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tela === 'novo_cliente' ? 'text-teal-500 scale-110' : 'text-zinc-400'}`}>
            <UserPlus size={24} />
            <span className="text-[9px] font-black uppercase tracking-widest">Adicionar</span>
          </button>
        )}
        <button onClick={() => setTela('relatorio')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tela === 'relatorio' ? 'text-teal-500 scale-110' : 'text-zinc-400'}`}>
          <User size={24} />
          <span className="text-[9px] font-black uppercase tracking-widest">Clientes</span>
        </button>
        {perfil.tipoConta === 'empresa' && (
          <button onClick={() => setTela('gestao_equipe')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tela === 'gestao_equipe' ? 'text-sky-500 scale-110' : 'text-zinc-400'}`}>
            <Briefcase size={24} />
            <span className="text-[9px] font-black uppercase tracking-widest">Equipe</span>
          </button>
        )}
        <button onClick={() => setTela('configuracoes')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tela === 'configuracoes' ? 'text-teal-500 scale-110' : 'text-zinc-400'}`}>
          <Settings size={24} />
          <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
