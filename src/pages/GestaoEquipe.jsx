import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { UserPlus, UserMinus, ShieldAlert, CheckCircle, Bell, Users } from 'lucide-react';

export default function GestaoEquipe({ setTela }) {
  const { user, clientes, gradText, gradBtn } = useContext(AppContext);
  const [funcionarios, setFuncionarios] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('equipe'); // 'equipe' ou 'alertas'
  
  // Form estado
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [rotasSelecionadas, setRotasSelecionadas] = useState([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (user) {
      carregarFuncionarios();
      carregarAlertas();
    }
  }, [user]);

  const carregarAlertas = async () => {
    try {
      const q = query(collection(db, 'usuarios', user.uid, 'alertasProdutos'), orderBy('ts', 'desc'));
      const snap = await getDocs(q);
      setAlertas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
  };

  const marcarAlertaComoLido = async (alertaId) => {
    try {
      await updateDoc(doc(db, 'usuarios', user.uid, 'alertasProdutos', alertaId), { lido: true });
      carregarAlertas();
    } catch (e) {
      alert("Erro ao marcar como lido: " + e.message);
    }
  };

  const carregarFuncionarios = async () => {
    try {
      const snap = await getDocs(collection(db, 'usuarios', user.uid, 'funcionarios'));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFuncionarios(lista);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const adicionarFuncionario = async () => {
    if (!nome || !email) return alert("Preencha o nome e o e-mail do funcionário.");
    const emailFormatado = email.trim().toLowerCase();
    
    try {
      // 1. Salva na subcoleção do dono
      const funcRef = doc(collection(db, 'usuarios', user.uid, 'funcionarios'));
      const novoFunc = {
        nome,
        email: emailFormatado,
        rotas: rotasSelecionadas,
        criadoEm: Date.now()
      };
      await setDoc(funcRef, novoFunc);

      // 2. Salva no link raiz para o funcionário se encontrar
      await setDoc(doc(db, 'equipes_links', emailFormatado), {
        employerUid: user.uid,
        nome: nome,
        rotas: rotasSelecionadas
      });

      alert("Funcionário adicionado! Ele já pode criar uma conta com esse e-mail.");
      setNome(''); setEmail(''); setRotasSelecionadas([]); setIsAdding(false);
      carregarFuncionarios();
    } catch (e) {
      alert("Erro ao adicionar funcionário: " + e.message);
    }
  };

  const removerFuncionario = async (funcId, funcEmail) => {
    if (!window.confirm("Remover este funcionário?")) return;
    try {
      await deleteDoc(doc(db, 'usuarios', user.uid, 'funcionarios', funcId));
      await deleteDoc(doc(db, 'equipes_links', funcEmail));
      carregarFuncionarios();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  const toggleRota = (clienteId) => {
    if (rotasSelecionadas.includes(clienteId)) {
      setRotasSelecionadas(rotasSelecionadas.filter(id => id !== clienteId));
    } else {
      setRotasSelecionadas([...rotasSelecionadas, clienteId]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans pb-24 transition-colors duration-300">
      <header className="bg-white dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800/50 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-black uppercase tracking-tight ${gradText}`}>Gestão de Equipe</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Painel Empresa</p>
          </div>
          <button onClick={() => setTela('lista')} className="text-xs font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl">Voltar</button>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex bg-zinc-200 dark:bg-zinc-900 p-1 rounded-2xl">
          <button 
            onClick={() => setTab('equipe')} 
            className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${tab === 'equipe' ? 'bg-white dark:bg-zinc-800 text-teal-500 shadow-sm' : 'text-zinc-500'}`}
          >
            <Users size={18} /> Equipe
          </button>
          <button 
            onClick={() => setTab('alertas')} 
            className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${tab === 'alertas' ? 'bg-white dark:bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500'}`}
          >
            <Bell size={18} /> Alertas 
            {alertas.filter(a => !a.lido).length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{alertas.filter(a => !a.lido).length}</span>
            )}
          </button>
        </div>

        {tab === 'equipe' ? (
          <>
            {isAdding ? (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4">Novo Funcionário</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">Nome Completo</label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">E-mail de Login</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 dark:text-white" />
                  </div>
                  
                  <div className="pt-2">
                    <label className="text-[10px] font-bold text-sky-500 uppercase tracking-wider ml-2 mb-2 block">Atribuir Rotas (Clientes)</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                      {clientes.map(c => (
                        <button key={c.id} onClick={() => toggleRota(c.id)} className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-colors ${rotasSelecionadas.includes(c.id) ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700' : 'bg-transparent border-zinc-200 dark:border-zinc-800'}`}>
                          <span className={`font-bold text-sm ${rotasSelecionadas.includes(c.id) ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{c.nome}</span>
                          {rotasSelecionadas.includes(c.id) && <CheckCircle size={16} className="text-sky-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button onClick={() => setIsAdding(false)} className="flex-1 py-4 rounded-2xl font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800">Cancelar</button>
                    <button onClick={adicionarFuncionario} className={`flex-1 py-4 rounded-2xl font-bold ${gradBtn}`}>Salvar</button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)} className="w-full bg-sky-50 dark:bg-sky-900/20 border border-dashed border-sky-300 dark:border-sky-700 p-6 rounded-[2rem] flex flex-col items-center justify-center text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors">
                <UserPlus size={32} className="mb-2" />
                <span className="font-bold">Adicionar Funcionário</span>
              </button>
            )}

            <div className="space-y-4 pt-4">
              <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Sua Equipe</h2>
              {loading ? (
                <p className="text-center text-zinc-400">Carregando...</p>
              ) : funcionarios.length === 0 ? (
                <p className="text-center text-zinc-400 text-sm">Nenhum funcionário cadastrado.</p>
              ) : (
                funcionarios.map(f => (
                  <div key={f.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{f.nome}</h3>
                      <p className="text-xs text-zinc-400">{f.email}</p>
                      <p className="text-[10px] font-bold text-sky-500 mt-1">{f.rotas?.length || 0} rota(s) atribuída(s)</p>
                    </div>
                    <button onClick={() => removerFuncionario(f.id, f.email)} className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40">
                      <UserMinus size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Solicitações da Equipe</h2>
            {alertas.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                <ShieldAlert size={32} className="mx-auto text-emerald-500/50 mb-4" />
                <p className="text-sm font-bold text-zinc-400">Nenhum produto faltando relatado.</p>
              </div>
            ) : (
              alertas.map(a => (
                <div key={a.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border ${a.lido ? 'border-zinc-200 dark:border-zinc-800 opacity-70' : 'border-amber-300 dark:border-amber-700 shadow-lg'} transition-all`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{a.clienteNome}</h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{a.data} • Func: {a.funcionarioAtivo}</p>
                    </div>
                    {!a.lido && <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-1 rounded-md font-bold uppercase animate-pulse">Novo</span>}
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-4">
                    <p className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Produtos Faltando:</p>
                    <ul className="space-y-1">
                      {a.produtos.map((p, idx) => (
                        <li key={idx} className="text-sm text-zinc-700 dark:text-zinc-300 font-medium flex justify-between">
                          <span>{p.nome}</span>
                          <span className="text-amber-500 font-bold">{p.qtd}x</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    {a.clienteTel && (
                      <button onClick={() => window.open(`https://wa.me/55${a.clienteTel.replace(/\D/g, '')}?text=Olá, durante a manutenção notamos que faltam alguns produtos: ${a.produtos.map(p => `${p.qtd}x ${p.nome}`).join(', ')}.`, '_blank')} className="flex-1 py-3 text-xs font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-xl">
                        Avisar Cliente
                      </button>
                    )}
                    {!a.lido && (
                      <button onClick={() => marcarAlertaComoLido(a.id)} className="flex-1 py-3 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700">
                        Marcar Resolvido
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
