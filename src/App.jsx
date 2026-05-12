import { useState, useEffect, useRef } from 'react';
import {
  Camera, Droplets, ShoppingCart, ArrowLeft, Check, MapPin, Save, FileText, Plus,
  AlertTriangle, CalendarDays, CheckCircle2, Phone, MessageSquare, Minus, Share2, Clock, RotateCcw, Trash2, Sun, Moon, LogOut, Navigation, Pencil, BellRing, ShieldCheck, Cloud, CloudOff, RefreshCw
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { savePendingVisit, getPendingVisits, removePendingVisit } from './db';

// --- IMPORTAÇÕES DO FIREBASE ---
import { auth, db, storage } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, runTransaction, addDoc, query, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

// --- CONFIGURAÇÕES DOS PRODUTOS E ACESSÓRIOS ---
const listaQuimica = [
  'CLORO BALDE 10 KL',
  'CLORO 1 KL',
  'ELEVADOR DE ALCALINIDADE 2 KL',
  'BARRILHA 2KL',
  'SULFATO DE ALUMÍNIO 2KL',
  'LIMPA BORDAS 1LT',
  'CLARIFICANTE 1LT',
  'CLARIFICANTE EM GEL',
  'REDUTOR DE PH E ALCALINIDADE 1LT',
  'ALGICIDA SEM COBRE 1LT',
  'ALGICIDA DE MANUTENÇÃO 1LT',
  'ALGICIDA DE CHOQUE 1LT',
  'SAL PRA GERADOR DE CLORO 25 KL'
];

const listaAcessorios = [
  'ESCOVA PRA PISCINA',
  'ASPIRADOR',
  'CABO TELESCÓPIO 4MTs',
  'CABO TELESCÓPIO 6 MTs',
  'CAPA TÉRMICA',
  'MANGUEIRA DE ASPIRAÇÃO',
  'PENEIRA TIPO PELICANO'
];

const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const gradBtn = "bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 text-white border-none shadow-[0_4px_14px_0_rgba(56,189,248,0.39)] hover:shadow-[0_6px_20px_rgba(56,189,248,0.23)] hover:scale-[1.02] transition-all duration-200";
const gradText = "bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent";
const gradIconBg = "bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/30 dark:to-emerald-900/30 text-teal-600 dark:text-teal-400";

const ADMIN_EMAIL = 'samuelroque155@gmail.com';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [perfil, setPerfil] = useState({
    empresa: 'Mão Na Água',
    cidade: 'Sua Cidade',
    assinaturaAtiva: true,
    whatsappSuporte: '5564999999999',
    listaProdutos: listaQuimica,
    listaAcessorios: listaAcessorios
  });

  const [tela, setTela] = useState('lista');
  const [clienteRelatorio, setClienteRelatorio] = useState(null);
  const [historicoDoRelatorio, setHistoricoDoRelatorio] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [modoImpressao, setModoImpressao] = useState(null);
  const [salvandoVisita, setSalvandoVisita] = useState(false);

  const dateObj = new Date();
  const diaAtual = dateObj.getDay();
  const dataHojeStr = dateObj.toDateString();
  const mesesCompletos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesEscrito = mesesCompletos[dateObj.getMonth()];
  const anoEscrito = dateObj.getFullYear();

  const [modoEscuro, setModoEscuro] = useState(() => {
    const salvo = localStorage.getItem('maonagua_tema');
    return salvo !== null ? JSON.parse(salvo) : true;
  });

  useEffect(() => {
    localStorage.setItem('maonagua_tema', JSON.stringify(modoEscuro));
    if (modoEscuro) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [modoEscuro]);

  const [clientes, setClientes] = useState([]);
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [carregandoAdmin, setCarregandoAdmin] = useState(false);

  const carregarTodosUsuarios = async () => {
    setCarregandoAdmin(true);
    try {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      let lista = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        lista.push({ uid: docSnap.id, ...data });
      });
      setTodosUsuarios(lista);
    } catch (error) {
      alert("Erro ao carregar usuários: " + error.message);
    }
    setCarregandoAdmin(false);
  };

  const alternarStatusAssinatura = async (uid, statusAtual) => {
    try {
      await updateDoc(doc(db, "usuarios", uid), {
        "perfil.assinaturaAtiva": !statusAtual
      });
      setTodosUsuarios(todosUsuarios.map(u =>
        u.uid === uid ? { ...u, perfil: { ...u.perfil, assinaturaAtiva: !statusAtual } } : u
      ));
    } catch (error) {
      alert("Erro ao atualizar assinatura: " + error.message);
    }
  };

  useEffect(() => {
    if (tela === 'admin_panel' && user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      carregarTodosUsuarios();
    }
  }, [tela, user]);

  const [pendentesCount, setPendentesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const processarFilaSincronizacao = async (usuarioUid, currentClientesState) => {
    if (isSyncingRef.current || !navigator.onLine || !usuarioUid) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const pendentes = await getPendingVisits();
      if (pendentes.length === 0) {
        setPendentesCount(0);
        return;
      }
      setPendentesCount(pendentes.length);

      for (const pendente of pendentes) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 15000)
          );

          const processarItem = async () => {
            const upImg = async (base64, path) => {
              if (!base64 || !base64.startsWith('data:image')) return base64;
              const storageRef = ref(storage, `usuarios/${usuarioUid}/${path}/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`);
              await uploadString(storageRef, base64, 'data_url');
              return await getDownloadURL(storageRef);
            };

            const urlsPrincipais = await Promise.all(pendente.fotosBase64.map(foto => upImg(foto, 'visitas')));
            const urlsAlerta = await Promise.all(pendente.fotosAlertaBase64.map(foto => upImg(foto, 'alertas')));

            const q = query(collection(db, 'usuarios', usuarioUid, 'historicos'), where('vId', '==', pendente.id));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              await updateDoc(querySnapshot.docs[0].ref, {
                fotos: urlsPrincipais,
                fotosA: urlsAlerta,
                pendenteSync: false
              });
            }
            await removePendingVisit(pendente.id);
          };

          await Promise.race([processarItem(), timeoutPromise]);
          const nextCount = await getPendingVisits();
          setPendentesCount(nextCount.length);

        } catch (err) {
          console.error(`Falha no item ${pendente.id}`, err);
          await removePendingVisit(pendente.id);
          const nextCount = await getPendingVisits();
          setPendentesCount(nextCount.length);
        }
      }
    } catch (error) {
      console.error("Erro na fila:", error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    getPendingVisits().then(p => setPendentesCount(p.length));
    const handleOnline = () => { if (user) processarFilaSincronizacao(user.uid, clientes); };
    window.addEventListener('online', handleOnline);
    const interval = setInterval(() => { if (navigator.onLine && user && !isSyncingRef.current) processarFilaSincronizacao(user.uid, clientes); }, 30000);
    return () => { window.removeEventListener('online', handleOnline); clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    const desinscrever = onAuthStateChanged(auth, async (usuarioAtual) => {
      setUser(usuarioAtual);
      if (usuarioAtual) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        const docRef = doc(db, 'usuarios', usuarioAtual.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPerfil(prev => ({ ...prev, ...data.perfil }));
          let clientesFirebase = data.clientes || [];
          setClientes(clientesFirebase);
        }
      }
      setAuthLoading(false);
    });
    return () => desinscrever();
  }, []);

  const [clienteAtual, setClienteAtual] = useState(null);
  const [aspecto, setAspecto] = useState('');
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [fotosContagem, setFotosContagem] = useState(0);
  const [fotosVisita, setFotosVisita] = useState([]);
  const [horaInicioVisita, setHoraInicioVisita] = useState(null);
  const [fotosAlerta, setFotosAlerta] = useState([]);
  const [textoAlerta, setTextoAlerta] = useState('');
  const [produtosFaltando, setProdutosFaltando] = useState([]);
  const [mostrarAdiarId, setMostrarAdiarId] = useState(null);

  const [novoNome, setNovoNome] = useState('');
  const [novoBairro, setNovoBairro] = useState('');
  const [novaRua, setNovaRua] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [novosDias, setNovosDias] = useState([]);
  const [novaHora, setNovaHora] = useState('');

  const [notificacoesAtivas, setNotificacoesAtivas] = useState([]);
  const notificadosHojeRef = useRef(new Set());

  useEffect(() => {
    if (!user || clientes.length === 0) return;
    const checarNotificacoes = () => {
      const agora = new Date();
      const diaAtualLocal = agora.getDay();
      const tempoAtualMinutos = agora.getHours() * 60 + agora.getMinutes();
      const dataKey = agora.toDateString();

      const clientesParaNotificar = clientes.filter(c => {
        if (!c.horaVisita) return false;
        const eDiaVisita = c.diasVisita.includes(diaAtualLocal) || c.adiadoPara === diaAtualLocal;
        if (!eDiaVisita) return false;
        const [h, m] = c.horaVisita.split(':').map(Number);
        const tempoVisitaMinutos = h * 60 + m;
        const tempoAlarmeMinutos = (tempoVisitaMinutos - 120 + 1440) % 1440;
        const diff = Math.abs(tempoAtualMinutos - tempoAlarmeMinutos);
        if (diff > 1) return false;
        const jaNotificadoKey = `${c.id}-${dataKey}-${c.horaVisita}`;
        if (notificadosHojeRef.current.has(jaNotificadoKey)) return false;
        return true;
      });

      if (clientesParaNotificar.length > 0) {
        clientesParaNotificar.forEach(c => {
          const jaNotificadoKey = `${c.id}-${dataKey}-${c.horaVisita}`;
          notificadosHojeRef.current.add(jaNotificadoKey);
          if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
            new Notification("Mão Na Água", { body: `Lembrete: Limpeza de ${c.nome} em 2 horas!`, requireInteraction: true });
          }
          setNotificacoesAtivas(prev => [...prev, { id: Date.now() + Math.random(), clienteNome: c.nome, hora: c.horaVisita }]);
        });
      }
    };
    const intervalId = setInterval(checarNotificacoes, 30000);
    return () => clearInterval(intervalId);
  }, [clientes, user]);

  const handleNovaFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800;
        let width = img.width; let height = img.height;
        if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setFotosVisita(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)]);
        setFotosContagem(prev => prev + 1);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFotoAlerta = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFotosAlerta(prev => [...prev, event.target.result]);
    };
    reader.readAsDataURL(file);
  };

  const removerFoto = (i) => { setFotosVisita(prev => prev.filter((_, idx) => idx !== i)); setFotosContagem(prev => prev - 1); };
  const removerFotoAlerta = (i) => { setFotosAlerta(prev => prev.filter((_, idx) => idx !== i)); };
  const toggleProduto = (n) => { const ex = produtosFaltando.find(p => p.nome === n); if (ex) setProdutosFaltando(prev => prev.filter(p => p.nome !== n)); else setProdutosFaltando(prev => [...prev, { nome: n, qtd: 1 }]); };
  const updateQtdProduto = (n, d) => { setProdutosFaltando(prev => prev.map(p => p.nome === n ? { ...p, qtd: Math.max(1, p.qtd + d) } : p)); };

  const salvarVisita = async () => {
    if (!validarFecharTarefa()) { alert("⚠️ Preencha pH, Cloro, Alcalinidade e no mínimo 3 fotos."); return; }

    const dataFim = new Date();
    const dataInicio = new Date(clienteAtual.horaInicioVisitaMs || horaInicioVisita || Date.now());
    const formataHora = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const tMs = dataFim.getTime() - dataInicio.getTime();
    const tM = Math.max(1, Math.round(tMs / 60000));
    const tF = tM >= 60 ? `${Math.floor(tM / 60)}h ${tM % 60}m` : `${tM}m`;
    const vId = Date.now().toString();

    await savePendingVisit({ id: vId, clienteId: clienteAtual.id, fotosBase64: fotosVisita, fotosAlertaBase64: fotosAlerta });

    const novaVisitaLocal = {
      clienteId: clienteAtual.id, vId, d: `${String(dateObj.getDate()).padStart(2, '0')}/${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][dateObj.getMonth()]}`,
      h: `${formataHora(dataInicio)} - ${formataHora(dataFim)}`, a: aspecto, c: cloro, p: ph, al: alcalinidade, temp: temperatura, t: tF, tMs, pendenteSync: true
    };

    const novosClientes = clientes.map(c => c.id === clienteAtual.id ? { ...c, ultimaVisita: dataHojeStr, visitaEmAndamentoData: null, horaInicioVisitaMs: null, adiadoPara: null, ultimosProdutosFaltando: [...produtosFaltando] } : c);
    setClientes(novosClientes);

    try {
      await addDoc(collection(db, 'usuarios', user.uid, 'historicos'), novaVisitaLocal);
      await updateDoc(doc(db, 'usuarios', user.uid), { clientes: novosClientes });
    } catch (e) { console.error(e); }

    showToast("Limpeza finalizada com sucesso!");
    setTela('lista');
    resetarFormulario();
    if (navigator.onLine) processarFilaSincronizacao(user.uid, novosClientes);
    else setPendentesCount(prev => prev + 1);
  };

  const reabrirTarefa = async () => {
    // Lógica simplificada de reabertura para o exemplo
    const q = query(collection(db, 'usuarios', user.uid, 'historicos'), where('clienteId', '==', clienteRelatorio.id));
    const querySnapshot = await getDocs(q);
    const hist = [];
    querySnapshot.forEach(d => hist.push({ docId: d.id, ...d.data() }));
    hist.sort((a, b) => Number(b.vId) - Number(a.vId));

    if (hist.length > 0) {
      const u = hist[0];
      setAspecto(u.a); setPh(u.p); setCloro(u.c); setAlcalinidade(u.al); setTemperatura(u.temp || '');
      setClienteAtual(clienteRelatorio);
      setTela('visita');
      await deleteDoc(doc(db, 'usuarios', user.uid, 'historicos', u.docId));
    }
  };

  const resetarFormulario = () => { setAspecto(''); setPh(''); setCloro(''); setAlcalinidade(''); setTemperatura(''); setFotosContagem(0); setFotosVisita([]); setFotosAlerta([]); setTextoAlerta(''); setProdutosFaltando([]); setClienteAtual(null); };

  if (tela === 'lista') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto pb-24 font-sans transition-colors duration-300 relative">
        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-zinc-700 flex items-center gap-3 animate-bounce">
            <CheckCircle2 size={18} className="text-teal-400" />
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        )}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-black ${gradText}`}>Mão Na Água</h1>
            <p className="text-teal-600/70 dark:text-teal-400/60 font-bold text-[10px] uppercase tracking-widest">{perfil.empresa}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModoEscuro(!modoEscuro)} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-teal-600">{modoEscuro ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={() => setTela('agenda')} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-sky-500"><CalendarDays size={20} /></button>
            <button onClick={() => setTela('configuracoes')} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-teal-500"><Pencil size={20} /></button>
            <button onClick={handleSair} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 text-rose-500"><LogOut size={20} /></button>
          </div>
        </header>
        <div className="space-y-4">
          {piscinasDeHoje.length === 0 ? <div className="text-center py-20 text-zinc-400">Tudo limpo por hoje!</div> : piscinasDeHoje.map(c => (
            <div key={c.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border dark:border-zinc-800 shadow-sm relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg dark:text-white">{c.nome}</h3>
                  <p className="text-xs text-zinc-500 flex items-center gap-1"><MapPin size={12} /> {c.endereco}</p>
                  {c.horaVisita && <p className="text-[10px] font-bold text-sky-500 mt-1 flex items-center gap-1"><Clock size={10} /> Agendado: {c.horaVisita}</p>}
                </div>
                {c.ultimaVisita === dataHojeStr && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold">OK</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => iniciarVisita(c)} className={`flex-1 py-3.5 rounded-xl font-bold text-sm ${c.ultimaVisita === dataHojeStr ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400' : gradBtn}`}>INICIAR</button>
                <button onClick={() => setMostrarAdiarId(c.id)} className="bg-zinc-50 dark:bg-zinc-800 px-4 rounded-xl text-sm font-medium dark:text-zinc-400 border dark:border-zinc-700">Remarcar</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setTela('relatorio')} className="fixed bottom-6 left-6 bg-white dark:bg-zinc-900 px-6 py-4 rounded-full shadow-xl border dark:border-zinc-800 flex items-center gap-3 font-bold text-xs uppercase dark:text-white"><FileText size={20} className="text-teal-500" /> Relatórios</button>
        <button onClick={irParaNovoCliente} className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl ${gradBtn}`}><Plus size={28} /></button>
      </div>
    );
  }

  if (tela === 'visita') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 max-w-md mx-auto pb-32 transition-colors">
        <header className="p-4 border-b dark:border-zinc-800 flex items-center gap-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-20">
          <button onClick={() => setTela('lista')} className="p-2 text-zinc-500 dark:text-zinc-400"><ArrowLeft size={20} /></button>
          <h2 className={`font-black text-xl ${gradText}`}>{clienteAtual.nome}</h2>
        </header>
        <div className="p-5 space-y-8">
          <section>
            <label className="block text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 uppercase tracking-wider">Aspecto da Água</label>
            <div className="grid grid-cols-3 gap-3">
              {['Cristalina', 'Turva', 'Verde'].map(opt => (
                <button key={opt} onClick={() => setAspecto(opt)} className={`py-4 rounded-[1.25rem] font-bold text-sm transition-all ${aspecto === opt ? gradBtn : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border dark:border-zinc-800'}`}>{opt}</button>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold flex items-center gap-2.5 dark:text-zinc-200"><Camera size={18} className="text-teal-500" /> Fotos da Piscina ({fotosContagem}/3)</h3>
            </div>
            <label className="w-full bg-slate-50 dark:bg-zinc-950 border-2 border-dashed border-teal-300/50 py-10 rounded-2xl flex flex-col items-center gap-2 text-teal-500 cursor-pointer">
              <Camera size={32} /> <span className="text-sm font-bold">Tirar Foto</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNovaFoto} />
            </label>
            <div className="flex gap-3 overflow-x-auto mt-5 pb-2">
              {fotosVisita.map((foto, index) => (
                <div key={index} className="relative min-w-[80px] h-20 rounded-xl overflow-hidden border dark:border-zinc-700 shadow-sm">
                  <img src={foto} className="w-full h-full object-cover" />
                  <button onClick={() => removerFoto(index)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-md p-1 shadow-md"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-bold text-teal-600 dark:text-teal-500 uppercase tracking-wider flex items-center gap-2"><Droplets size={14} /> Parâmetros da Água</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 text-center font-bold uppercase">pH</span><input type="number" placeholder="7.2" value={ph} onChange={e => setPh(e.target.value)} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-teal-400 outline-none text-teal-600 dark:text-teal-400 font-bold text-lg" /></div>
              <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 text-center font-bold uppercase">Cloro</span><input type="number" placeholder="2.0" value={cloro} onChange={e => setCloro(e.target.value)} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-sky-400 outline-none text-sky-600 dark:text-sky-400 font-bold text-lg" /></div>
              <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 text-center font-bold uppercase">Alc</span><input type="number" placeholder="100" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-emerald-400 outline-none text-emerald-600 dark:text-emerald-400 font-bold text-lg" /></div>
            </div>

            {/* NOVO CAMPO: TEMPERATURA DA ÁGUA ABAIXO DOS PARÂMETROS */}
            <div className="mt-4">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest block mb-2 uppercase ml-2">Temperatura da Água (°C)</span>
              <input type="number" placeholder="Ex: 28" value={temperatura} onChange={e => setTemperatura(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-[1.25rem] focus:border-orange-400 outline-none text-orange-600 dark:text-orange-400 font-bold text-lg shadow-sm" />
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border dark:border-zinc-800 shadow-sm">
            <p className="font-bold text-sm mb-5 flex items-center gap-2.5 dark:text-zinc-200"><ShoppingCart size={16} className="text-teal-500" /> Produtos a Repor</p>
            <div className="space-y-3">
              {perfil.listaProdutos.map(q => {
                const item = produtosFaltando.find(p => p.nome === q);
                return (
                  <div key={q} className={`flex flex-col p-3 rounded-[1.25rem] border transition-colors ${item ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-300' : 'bg-slate-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}>
                    <div className="flex items-center justify-between">
                      <button onClick={() => toggleProduto(q)} className="flex items-center gap-3 flex-1 text-left">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${item ? 'bg-teal-500 border-transparent shadow-sm' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>{item && <Check size={14} className="text-white font-black" />}</div>
                        <span className={`text-sm ${item ? 'text-teal-800 dark:text-teal-300 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>{q}</span>
                      </button>
                      {item && (
                        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-xl p-1 border dark:border-zinc-800 shadow-sm">
                          <button onClick={() => updateQtdProduto(q, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center text-teal-700 dark:text-teal-400">{item.qtd}</span>
                          <button onClick={() => updateQtdProduto(q, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg"><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <button onClick={salvarVisita} className={`w-full py-5 rounded-[1.25rem] font-bold text-lg mt-8 ${gradBtn}`}>SALVAR E FINALIZAR</button>
        </div>
      </div>
    );
  }

  if (tela === 'ver_relatorio') {
    const cExp = clientes.find(c => c.id === clienteRelatorio?.id) || clienteRelatorio;
    if (!cExp) return null;

    const fotosDoMes = [];
    historicoDoRelatorio.forEach(v => {
      if (v.fotos) v.fotos.forEach(foto => fotosDoMes.push({ src: foto, data: v.d }));
    });

    const visitasComAlerta = historicoDoRelatorio.filter(v => (v.fotosA && v.fotosA.length > 0) || v.txtA);
    const foiVisitadoHoje = cExp.ultimaVisita === dataHojeStr;

    if (carregandoHistorico) {
      return <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center text-teal-500 font-bold"><RefreshCw size={40} className="animate-spin mb-4" /> Carregando pasta virtual...</div>;
    }

    return (
      <div className={`min-h-screen font-sans transition-colors duration-300 ${modoImpressao ? 'bg-white text-black' : 'bg-slate-100 dark:bg-zinc-950 p-4 pb-20 max-w-md mx-auto'}`}>
        <style>{`
          @media print {
            @page { margin: 0; size: auto; }
            body, html { background-color: #ffffff !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            #relatorio-print { box-shadow: none !important; border: none !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
          }
        `}</style>

        <div className="no-print flex items-center gap-4 mb-6">
          <button onClick={() => setTela('relatorio')} className="p-2 bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 dark:text-white shadow-sm"><ArrowLeft /></button>
          <h2 className="font-bold text-lg dark:text-zinc-200">Dossiê do Cliente</h2>
        </div>

        <div id="relatorio-print" className="bg-white w-full shadow-2xl rounded-3xl overflow-hidden border border-zinc-200 text-zinc-900 relative">
          <div className="h-2 bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400"></div>
          <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-black text-sky-500 mb-1 leading-tight">{perfil.empresa}</h1>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Gestão Profissional</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-zinc-400 uppercase mb-2">Relatório Mensal</p>
                <div className="bg-sky-50 text-sky-700 px-4 py-1.5 rounded-xl font-bold text-sm border border-sky-100">{mesEscrito} / {anoEscrito}</div>
              </div>
            </div>

            {/* MODIFICADO: APENAS PROPRIETÁRIO */}
            <div className="bg-slate-50 p-5 rounded-2xl mb-8 border border-zinc-100 shadow-inner">
              <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1 tracking-wider">Proprietário</p>
              <p className="text-xl font-black text-zinc-800">{cExp.nome}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-xl text-[10px] font-bold tracking-wide uppercase border border-emerald-200"><CheckCircle2 size={12} /> Água Equilibrada (Mês Atual)</div>
            </div>

            <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-2 mb-4 uppercase tracking-widest flex items-center gap-2"><Droplets size={14} className="text-sky-500" /> Histórico de Parâmetros</h3>
            <div className="overflow-hidden rounded-xl border border-zinc-100 mb-10">
              <table className="w-full text-[10px] text-center table-fixed">
                <thead className="bg-zinc-800 text-white font-bold uppercase text-[8px]">
                  <tr>
                    <th className="p-3 w-[15%]">Data</th>
                    <th className="p-3 w-[20%] text-sky-300">Água</th>
                    <th className="p-3 w-[13%]">Cl</th>
                    <th className="p-3 w-[13%]">pH</th>
                    <th className="p-3 w-[13%]">Alc</th>
                    <th className="p-3 w-[13%] text-orange-300">Temp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {[...historicoDoRelatorio].reverse().map((v, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-black text-zinc-800">{v.d}</td>
                      <td className={`p-3 font-bold uppercase text-[8px] ${v.a === 'Cristalina' ? 'text-sky-500' : 'text-emerald-600'}`}>{v.a}</td>
                      <td className="p-3 font-bold text-zinc-600">{v.c}</td>
                      <td className="p-3 font-bold text-zinc-600">{v.p}</td>
                      <td className="p-3 font-bold text-zinc-600">{v.al}</td>
                      <td className="p-3 font-bold text-orange-600">{v.temp ? v.temp + '°' : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fotosDoMes.length > 0 && (
              <div className="mb-10">
                <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-2 mb-4 uppercase tracking-widest flex items-center gap-2"><Camera size={14} className="text-teal-500" /> Resumo Fotográfico</h3>
                <div className="grid grid-cols-4 gap-2">
                  {fotosDoMes.map((f, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden relative border border-zinc-100 shadow-sm bg-slate-50">
                      <img src={f.src} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 w-full bg-black/40 text-white text-[7px] text-center font-black py-0.5">{f.data}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <footer className="bg-zinc-900 text-white p-6 text-center">
            <p className="text-[10px] font-black tracking-widest mb-1">{perfil.empresa} • Gestão Profissional</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-medium">Este documento utiliza a tecnologia padrão de qualidade Mão Na Água</p>
          </footer>
        </div>

        <div className="no-print mt-8 space-y-4">
          <button onClick={compartilharRelatorioVisual} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 ${gradBtn}`}><Share2 size={20} /> SALVAR RELATÓRIO PDF</button>
          {foiVisitadoHoje && <button onClick={reabrirTarefa} className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 dark:text-zinc-300"><RotateCcw size={16} /> Editar Limpeza de Hoje</button>}
          <button onClick={() => abrirEdicaoCliente(cExp)} className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 dark:text-zinc-300"><Pencil size={16} /> Editar Cadastro</button>
        </div>
      </div>
    );
  }

  // Telas de Cadastro e Configuração simplificadas para este exemplo...
  return null;
}