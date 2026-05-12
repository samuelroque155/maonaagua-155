import { useState, useEffect, useRef } from 'react';
import {
  Camera, Droplets, ShoppingCart, ArrowLeft, Check, MapPin, Save, FileText, Plus,
  AlertTriangle, CalendarDays, CheckCircle2, Phone, MessageSquare, Minus, Share2, Clock, RotateCcw, Trash2, Sun, Moon, LogOut, Navigation, Pencil, BellRing, ShieldCheck, Cloud, CloudOff, RefreshCw, Send
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { savePendingVisit, getPendingVisits, removePendingVisit } from './db';

// --- IMPORTAÇÕES DO FIREBASE ---
import { auth, db, storage } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

const listaQuimica = ['CLORO BALDE 10 KL', 'CLORO 1 KL', 'ELEVADOR DE ALCALINIDADE 2 KL', 'BARRILHA 2KL', 'SULFATO DE ALUMÍNIO 2KL', 'LIMPA BORDAS 1LT', 'CLARIFICANTE 1LT', 'CLARIFICANTE EM GEL', 'REDUTOR DE PH E ALCALINIDADE 1LT', 'ALGICIDA SEM COBRE 1LT', 'ALGICIDA DE MANUTENÇÃO 1LT', 'ALGICIDA DE CHOQUE 1LT', 'SAL PRA GERADOR DE CLORO 25 KL'];
const listaAcessorios = ['ESCOVA PRA PISCINA', 'ASPIRADOR', 'CABO TELESCÓPIO 4MTs', 'CABO TELESCÓPIO 6 MTs', 'CAPA TÉRMICA', 'MANGUEIRA DE ASPIRAÇÃO', 'PENEIRA TIPO PELICANO'];
const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const gradBtn = "bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 text-white border-none shadow-[0_4px_14px_0_rgba(56,189,248,0.39)] hover:scale-[1.02] transition-all duration-200";
const gradText = "bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent";
const gradIconBg = "bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/30 dark:to-emerald-900/30 text-teal-600 dark:text-teal-400";

const ADMIN_EMAIL = 'samuelroque155@gmail.com';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [tela, setTela] = useState('lista');
  const [perfil, setPerfil] = useState({ empresa: 'Mão Na Água', cidade: 'Jataí', assinaturaAtiva: true, listaProdutos: listaQuimica, listaAcessorios: listaAcessorios });

  const [clienteRelatorio, setClienteRelatorio] = useState(null);
  const [historicoDoRelatorio, setHistoricoDoRelatorio] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [modoImpressao, setModoImpressao] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendentesCount, setPendentesCount] = useState(0);
  const isSyncingRef = useRef(false);

  const dateObj = new Date();
  const diaAtual = dateObj.getDay();
  const dataHojeStr = dateObj.toDateString();
  const mesEscrito = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][dateObj.getMonth()];

  // Estados Visita
  const [clienteAtual, setClienteAtual] = useState(null);
  const [aspecto, setAspecto] = useState('');
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [fotosVisita, setFotosVisita] = useState([]);
  const [fotosAlerta, setFotosAlerta] = useState([]);
  const [textoAlerta, setTextoAlerta] = useState('');
  const [produtosFaltando, setProdutosFaltando] = useState([]);
  const [horaInicioVisita, setHoraInicioVisita] = useState(null);

  // Estados Cadastro
  const [novoNome, setNovoNome] = useState('');
  const [novoBairro, setNovoBairro] = useState('');
  const [novaRua, setNovaRua] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [novosDias, setNovosDias] = useState([]);
  const [novaHora, setNovaHora] = useState('');
  const [mostrarAdiarId, setMostrarAdiarId] = useState(null);

  const [modoEscuro, setModoEscuro] = useState(() => JSON.parse(localStorage.getItem('maonagua_tema')) ?? true);

  useEffect(() => {
    localStorage.setItem('maonagua_tema', JSON.stringify(modoEscuro));
    if (modoEscuro) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [modoEscuro]);

  useEffect(() => {
    const desinscrever = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'usuarios', u.uid));
        if (snap.exists()) {
          const d = snap.data();
          setClientes(d.clientes || []);
          setPerfil(prev => ({ ...prev, ...d.perfil }));
        }
      }
      setAuthLoading(false);
    });
    return () => desinscrever();
  }, []);

  const processarFilaSincronizacao = async (uid) => {
    if (isSyncingRef.current || !navigator.onLine) return;
    isSyncingRef.current = true; setIsSyncing(true);
    const pendentes = await getPendingVisits();
    for (const p of pendentes) {
      try {
        const up = async (b64, path) => {
          const sRef = ref(storage, `usuarios/${uid}/${path}/${Date.now()}.jpg`);
          await uploadString(sRef, b64, 'data_url');
          return await getDownloadURL(sRef);
        };
        const urls = await Promise.all(p.fotosBase64.map(f => up(f, 'visitas')));
        const urlsA = await Promise.all(p.fotosAlertaBase64.map(f => up(f, 'alertas')));
        const qH = query(collection(db, 'usuarios', uid, 'historicos'), where('vId', '==', p.id));
        const resH = await getDocs(qH);
        if (!resH.empty) await updateDoc(resH.docs[0].ref, { fotos: urls, fotosA: urlsA, pendenteSync: false });
        await removePendingVisit(p.id);
      } catch (e) { console.error(e); }
    }
    setPendentesCount((await getPendingVisits()).length);
    isSyncingRef.current = false; setIsSyncing(false);
  };

  const handleNovaFoto = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => setFotosVisita(prev => [...prev, ev.target.result]);
    reader.readAsDataURL(e.target.files[0]);
  };

  const salvarVisita = async () => {
    if (fotosVisita.length < 3 || !ph || !cloro || !aspecto) return alert("Preencha os dados e tire 3 fotos.");
    const vId = Date.now().toString();
    const dF = `${String(dateObj.getDate()).padStart(2, '0')}/${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][dateObj.getMonth()]}`;

    await savePendingVisit({ id: vId, clienteId: clienteAtual.id, fotosBase64: fotosVisita, fotosAlertaBase64: fotosAlerta });

    const novaV = {
      clienteId: clienteAtual.id, vId, d: dF, a: aspecto, c: cloro, p: ph, al: alcalinidade, temp: temperatura,
      t: 'Concluído', pendenteSync: true
    };

    try {
      await addDoc(collection(db, 'usuarios', user.uid, 'historicos'), novaV);
      const novosC = clientes.map(c => c.id === clienteAtual.id ? { ...c, ultimaVisita: dataHojeStr } : c);
      await updateDoc(doc(db, 'usuarios', user.uid), { clientes: novosC });
      setClientes(novosC);
      setTela('lista');
      resetarFormulario();
      processarFilaSincronizacao(user.uid);
    } catch (e) { alert("Erro ao salvar."); }
  };

  const resetarFormulario = () => { setAspecto(''); setPh(''); setCloro(''); setAlcalinidade(''); setTemperatura(''); setFotosVisita([]); setFotosAlerta([]); setClienteAtual(null); };

  if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-teal-400">Carregando...</div>;

  if (!user) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
      <h1 className={`text-6xl font-black mb-8 ${gradText}`}>Mão Na Água</h1>
      <div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-sm">
        <input type="email" placeholder="E-mail" value={emailLogin} onChange={e => setEmailLogin(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl mb-4" />
        <input type="password" placeholder="Senha" value={senhaLogin} onChange={e => setSenhaLogin(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl mb-6" />
        <button onClick={() => signInWithEmailAndPassword(auth, emailLogin, senhaLogin)} className={`w-full py-4 rounded-2xl font-bold ${gradBtn}`}>ENTRAR</button>
      </div>
    </div>
  );

  if (tela === 'lista') return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto pb-24">
      <header className="flex justify-between items-center mb-8">
        <h1 className={`text-3xl font-black ${gradText}`}>Mão Na Água</h1>
        <div className="flex gap-2">
          <button onClick={() => setTela('agenda')} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-sky-500"><CalendarDays size={20} /></button>
          <button onClick={() => setTela('configuracoes')} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-teal-500"><Pencil size={20} /></button>
          <button onClick={() => signOut(auth)} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-rose-500"><LogOut size={20} /></button>
        </div>
      </header>
      <div className="space-y-4">
        {piscinasDeHoje.map(c => (
          <div key={c.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-lg dark:text-white">{c.nome}</h3>
            <p className="text-xs text-zinc-500 mb-4">{c.endereco}</p>
            <button onClick={() => { setClienteAtual(c); setTela('visita'); }} className={`w-full py-3 rounded-xl font-bold ${c.ultimaVisita === dataHojeStr ? 'bg-zinc-100 text-zinc-400' : gradBtn}`}>INICIAR</button>
          </div>
        ))}
      </div>
      <button onClick={() => setTela('relatorio')} className="fixed bottom-6 left-6 bg-white dark:bg-zinc-900 px-6 py-4 rounded-full shadow-xl border dark:border-zinc-800 flex items-center gap-3 font-bold text-xs dark:text-white"><FileText size={20} className="text-teal-500" /> Relatórios</button>
      <button onClick={() => setTela('novo_cliente')} className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl ${gradBtn}`}><Plus size={28} /></button>
    </div>
  );

  if (tela === 'visita') return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto">
      <button onClick={() => setTela('lista')} className="mb-6 dark:text-white"><ArrowLeft /></button>
      <h2 className={`text-2xl font-black mb-8 ${gradText}`}>{clienteAtual.nome}</h2>
      <div className="space-y-6">
        <section className="grid grid-cols-3 gap-3">
          {['Cristalina', 'Turva', 'Verde'].map(v => <button key={v} onClick={() => setAspecto(v)} className={`py-3 rounded-xl font-bold text-xs border ${aspecto === v ? gradBtn : 'bg-white dark:bg-zinc-900 dark:text-white'}`}>{v}</button>)}
        </section>
        <section className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border dark:border-zinc-800">
          <input type="file" onChange={handleNovaFoto} className="hidden" id="fInput" /><label htmlFor="fInput" className="block text-center p-6 border-2 border-dashed border-teal-500 rounded-xl text-teal-500 font-bold">Tirar Fotos ({fotosVisita.length}/3)</label>
        </section>
        <section className="grid grid-cols-3 gap-3">
          <input type="number" placeholder="pH" value={ph} onChange={e => setPh(e.target.value)} className="p-4 rounded-xl border dark:bg-zinc-900 dark:text-white" />
          <input type="number" placeholder="Cloro" value={cloro} onChange={e => setCloro(e.target.value)} className="p-4 rounded-xl border dark:bg-zinc-900 dark:text-white" />
          <input type="number" placeholder="Alc" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} className="p-4 rounded-xl border dark:bg-zinc-900 dark:text-white" />
        </section>
        <section className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border dark:border-zinc-800">
          <span className="text-xs font-bold text-zinc-500 uppercase block mb-2">Temperatura da Água (°C)</span>
          <input type="number" placeholder="Ex: 28" value={temperatura} onChange={e => setTemperatura(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded-xl font-bold text-orange-500 outline-none" />
        </section>
        <button onClick={salvarVisita} className={`w-full py-4 rounded-2xl font-bold ${gradBtn}`}>FINALIZAR</button>
      </div>
    </div>
  );

  if (tela === 'ver_relatorio') {
    return (
      <div className={`min-h-screen p-4 ${modoImpressao ? 'bg-white' : 'bg-slate-100 dark:bg-zinc-950'}`}>
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } #relatorio-print { border: none; box-shadow: none; } }`}</style>
        <div className="no-print flex gap-4 mb-6">
          <button onClick={() => setTela('relatorio')} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 dark:text-white"><ArrowLeft /></button>
          <button onClick={compartilharRelatorioVisual} className={`flex-1 py-4 rounded-xl font-bold ${gradBtn}`}>Salvar PDF</button>
        </div>
        <div id="relatorio-print" className="bg-white max-w-md mx-auto p-8 rounded-3xl border shadow-xl text-zinc-900">
          <h1 className="text-3xl font-black text-sky-500 mb-1">{perfil.empresa}</h1>
          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-8">Gestão Profissional</p>
          <div className="bg-slate-50 p-4 rounded-xl mb-6 border">
            <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Proprietário</p>
            <p className="text-lg font-black">{clienteRelatorio.nome}</p>
          </div>
          <table className="w-full text-[10px] text-center mb-8">
            <thead className="bg-zinc-800 text-white font-bold">
              <tr><th className="p-2">Data</th><th className="p-2">Água</th><th className="p-2">Cl</th><th className="p-2">pH</th><th className="p-2">Alc</th><th className="p-2">Temp</th></tr>
            </thead>
            <tbody>
              {historicoDoRelatorio.map((v, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-bold">{v.d}</td>
                  <td className="p-2">{v.a}</td>
                  <td className="p-2">{v.c}</td>
                  <td className="p-2">{v.p}</td>
                  <td className="p-2">{v.al}</td>
                  <td className="p-2">{v.temp ? v.temp + '°' : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Telas de Cadastro e Configuração restauradas
  if (tela === 'novo_cliente') return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 max-w-md mx-auto">
      <button onClick={() => setTela('lista')} className="mb-6 dark:text-white"><ArrowLeft /></button>
      <h2 className={`text-2xl font-black mb-8 ${gradText}`}>Novo Cliente</h2>
      <div className="space-y-4">
        <input placeholder="Nome" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full p-4 border rounded-xl dark:bg-zinc-900 dark:text-white" />
        <input placeholder="Endereço" value={novaRua} onChange={e => setNovaRua(e.target.value)} className="w-full p-4 border rounded-xl dark:bg-zinc-900 dark:text-white" />
        <div className="grid grid-cols-4 gap-2">
          {diasDaSemanaNomes.map((d, i) => <button key={i} onClick={() => setNovosDias(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} className={`p-2 rounded-lg text-[10px] font-bold border ${novosDias.includes(i) ? gradBtn : 'bg-white dark:bg-zinc-800 dark:text-white'}`}>{d.substring(0, 3)}</button>)}
        </div>
        <button onClick={adicionarCliente} className={`w-full py-4 rounded-2xl font-bold mt-6 ${gradBtn}`}>CADASTRAR</button>
      </div>
    </div>
  );

  if (tela === 'configuracoes') return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 max-w-md mx-auto">
      <button onClick={() => setTela('lista')} className="mb-6 dark:text-white"><ArrowLeft /></button>
      <h2 className={`text-2xl font-black mb-8 ${gradText}`}>Configurações</h2>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase">Nome da Empresa</label>
          <input value={perfil.empresa} onChange={e => setPerfil({ ...perfil, empresa: e.target.value })} className="w-full p-4 border rounded-xl dark:bg-zinc-900 dark:text-white" />
        </div>
        <button onClick={async () => { await updateDoc(doc(db, 'usuarios', user.uid), { perfil }); setTela('lista'); }} className={`w-full py-4 rounded-2xl font-bold ${gradBtn}`}>SALVAR</button>
      </div>
    </div>
  );

  return null;
}

// Funções de apoio
async function abrirRelatorio(c, uid, setH, setC, setT) {
  setC(c); setT('ver_relatorio'); setH([]);
  const q = query(collection(db, 'usuarios', uid, 'historicos'), where('clienteId', '==', c.id));
  const res = await getDocs(q);
  const h = []; res.forEach(d => h.push(d.data()));
  setH(h.sort((a, b) => b.vId - a.vId));
}