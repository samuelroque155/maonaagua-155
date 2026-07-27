import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Briefcase, User } from 'lucide-react';

export default function Onboarding() {
  const { user, perfil, setPerfil, gradText, gradBtn } = useContext(AppContext);
  const [loading, setLoading] = useState(false);

  const selecionarTipo = async (tipo) => {
    if (!user) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'usuarios', user.uid);
      await updateDoc(docRef, { 'perfil.tipoConta': tipo });
      setPerfil(prev => ({ ...prev, tipoConta: tipo }));
    } catch (error) {
      alert("Erro ao definir tipo de conta: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-sky-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-emerald-400 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>

      <div className="w-full max-w-md relative z-10 text-center">
        <h1 className={`text-4xl font-black mb-4 ${gradText}`}>Bem-vindo(a)!</h1>
        <p className="text-zinc-400 mb-10">Como você deseja usar a plataforma?</p>

        <div className="flex flex-col gap-4">
          <button 
            disabled={loading}
            onClick={() => selecionarTipo('autonomo')}
            className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center gap-4 hover:border-teal-400 transition-colors text-left"
          >
            <div className="bg-teal-500/20 p-4 rounded-xl">
              <User size={32} className="text-teal-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Sou Autônomo</h3>
              <p className="text-sm text-zinc-400 leading-tight">Faço meus próprios atendimentos e gerencio minha carteira sozinho.</p>
            </div>
          </button>

          <button 
            disabled={loading}
            onClick={() => selecionarTipo('empresa')}
            className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center gap-4 hover:border-sky-400 transition-colors text-left"
          >
            <div className="bg-sky-500/20 p-4 rounded-xl">
              <Briefcase size={32} className="text-sky-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Sou Empresa</h3>
              <p className="text-sm text-zinc-400 leading-tight">Tenho uma equipe de piscinologos e preciso atribuir rotas a eles.</p>
            </div>
          </button>
        </div>

        {loading && <p className="mt-6 text-teal-400 animate-pulse font-bold">Configurando sua conta...</p>}
      </div>
    </div>
  );
}
