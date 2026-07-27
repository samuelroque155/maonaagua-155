import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  ArrowLeft, Pencil, ShoppingCart, Plus, Trash2, Save, Briefcase, User
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Configuracoes({ setTela, salvarConfiguracoes, handleSair }) {
  const { user, perfil, setPerfil, gradText, gradBtn } = useContext(AppContext);

  const alternarTipoConta = async (novoTipo) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { 'perfil.tipoConta': novoTipo });
      setPerfil({ ...perfil, tipoConta: novoTipo });
      alert("Tipo de conta alterado para: " + novoTipo);
    } catch (e) {
      alert("Erro ao alterar tipo de conta: " + e.message);
    }
  };

  const addProduto = () => {
    const input = document.getElementById('novoProdInput');
    if (input.value) {
      setPerfil({ ...perfil, listaProdutos: [...perfil.listaProdutos, input.value] });
      input.value = '';
    }
  };

  const addAcessorio = () => {
    const input = document.getElementById('novoAcessInput');
    if (input.value) {
      setPerfil({ ...perfil, listaAcessorios: [...perfil.listaAcessorios, input.value] });
      input.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans transition-colors duration-300 pb-20">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => setTela('lista')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20} /></button>
        <h2 className={`text-2xl font-black ${gradText}`}>Configurações</h2>
      </header>

      <div className="space-y-8">
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-6 flex items-center gap-2 uppercase tracking-widest"><Pencil size={16} className="text-teal-500" /> Perfil Profissional</h3>
          <div className="space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-black text-teal-600 dark:text-teal-500 uppercase tracking-widest ml-1">Nome da Empresa</span>
              <input value={perfil.empresa} onChange={e => setPerfil({ ...perfil, empresa: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-400 text-sm font-bold" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black text-teal-600 dark:text-teal-500 uppercase tracking-widest ml-1">Sua Cidade / Estado</span>
              <input value={perfil.cidade} onChange={e => setPerfil({ ...perfil, cidade: e.target.value })} placeholder="Ex: Jataí - GO" className="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-400 text-sm font-bold" />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm mb-4 uppercase tracking-wider text-teal-600 flex items-center gap-2"><ShoppingCart size={16} /> Meus Produtos</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input id="novoProdInput" type="text" placeholder="Ex: Cloro 10kg" className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-teal-400" />
              <button onClick={addProduto} className="bg-teal-500 text-white p-3 rounded-xl"><Plus size={20} /></button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 scrollbar-hide border-t border-zinc-50 dark:border-zinc-800 mt-2 pt-3">
              {perfil.listaProdutos.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-[11px] font-medium">
                  <span className="text-zinc-700 dark:text-zinc-300">{p}</span>
                  <button onClick={() => setPerfil({ ...perfil, listaProdutos: perfil.listaProdutos.filter((_, idx) => idx !== i) })} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2 uppercase tracking-widest"><Briefcase size={16} className="text-sky-500" /> Tipo de Conta</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => alternarTipoConta('autonomo')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${perfil.tipoConta === 'autonomo' ? 'bg-teal-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-teal-500'}`}
            >
              <User size={16} /> Autônomo
            </button>
            <button 
              onClick={() => alternarTipoConta('empresa')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${perfil.tipoConta === 'empresa' ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-sky-500'}`}
            >
              <Briefcase size={16} /> Empresa
            </button>
          </div>
        </section>

        <button onClick={salvarConfiguracoes} className={`w-full py-4 rounded-xl font-bold ${gradBtn} flex items-center justify-center gap-2`}><Save size={20} /> SALVAR ALTERAÇÕES</button>
        <button onClick={handleSair} className="w-full py-4 text-rose-500 font-bold border border-rose-200 dark:border-rose-900/30 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">SAIR DA CONTA</button>
      </div>
    </div>
  );
}
