import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  ArrowLeft, ShieldCheck
} from 'lucide-react';

export default function AdminPanel({ setTela, todosUsuarios, carregandoAdmin, alternarStatusAssinatura }) {
  const { gradText, gradBtn } = useContext(AppContext);
  const ADMIN_EMAIL = 'samuelroque155@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto text-zinc-900 dark:text-zinc-100 font-sans pb-20">
      <header className="flex items-center gap-4 mb-8 pt-2">
        <button onClick={() => setTela('lista')} className="p-2 text-zinc-500 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20} /></button>
        <h2 className={`text-2xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-2`}>Painel Admin</h2>
      </header>

      {carregandoAdmin ? (
        <div className="text-center p-10 text-zinc-500 font-bold uppercase tracking-widest text-xs">Carregando usuários...</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium mb-6 shadow-sm">
            Total de Contas: <b>{todosUsuarios.length}</b>.
          </div>

          {todosUsuarios.map(u => (
            <div key={u.uid} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${u.perfil?.assinaturaAtiva ? 'bg-emerald-400' : 'bg-rose-500'}`}></div>
              <div className="flex justify-between items-start mb-4 ml-1">
                <div>
                  <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-100">{u.perfil?.empresa || 'Sem Empresa'}</h3>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">{u.perfil?.email}</p>
                </div>
                {u.perfil?.assinaturaAtiva ? (
                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2.5 py-1 rounded-md font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">Ativa</span>
                ) : (
                  <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[10px] px-2.5 py-1 rounded-md font-black uppercase tracking-wider border border-rose-200 dark:border-rose-800">Suspensa</span>
                )}
              </div>

              <button
                onClick={() => alternarStatusAssinatura(u.uid, !!u.perfil?.assinaturaAtiva)}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 ml-1 ${u.perfil?.assinaturaAtiva ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-500 text-white shadow-md'}`}
              >
                {u.perfil?.assinaturaAtiva ? 'Suspender Acesso Agora' : 'Liberar Assinatura'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
