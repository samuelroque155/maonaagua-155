import React, { useState, useEffect } from 'react';
import { 
  Camera, Droplets, ShoppingCart, ArrowLeft, Check, MapPin, Save, FileText, Plus, 
  AlertTriangle, CalendarDays, CheckCircle2, Phone, MessageSquare, Minus, Share2, Clock, RotateCcw, Trash2, Sun, Moon, LogOut, Navigation, Pencil
} from 'lucide-react';

// --- IMPORTAÇÕES DO FIREBASE ---
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const listaQuimica = ['CLORO BALDE 10 KL', 'CLORO 1 KL', 'ELEVADOR DE ALCALINIDADE 2 KL', 'BARRILHA 2KL', 'SULFATO DE ALUMÍNIO 2KL', 'LIMPA BORDAS 1LT', 'CLARIFICANTE 1LT', 'CLARIFICANTE EM GEL', 'REDUTOR DE PH E ALCALINIDADE 1LT', 'ALGICIDA SEM COBRE 1LT', 'ALGICIDA DE MANUTENÇÃO 1LT', 'ALGICIDA DE CHOQUE 1LT', 'SAL PRA GERADOR DE CLORO 25 KL'];
const listaAcessorios = ['ESCOVA PRA PISCINA', 'ASPIRADOR', 'CABO TELESCÓPIO 4MTs', 'CABO TELESCÓPIO 6 MTs', 'CAPA TÉRMICA', 'MANGUEIRA DE ASPIRAÇÃO', 'PENEIRA TIPO PELICANO'];
const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const gradBtn = "bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 text-white border-none shadow-md hover:scale-[1.02] transition-all duration-200";
const gradText = "bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent";
const gradIconBg = "bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/30 dark:to-emerald-900/30 text-teal-600 dark:text-teal-400";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [tela, setTela] = useState('lista'); 
  const [clienteRelatorio, setClienteRelatorio] = useState(null);
  const [modoImpressao, setModoImpressao] = useState(false); // NOVO: Controla se estamos gerando o PDF

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
    if (modoEscuro) { document.documentElement.classList.add('dark'); } 
    else { document.documentElement.classList.remove('dark'); }
  }, [modoEscuro]);

  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    const desinscrever = onAuthStateChanged(auth, async (usuarioAtual) => {
      setUser(usuarioAtual);
      if (usuarioAtual) {
        const docRef = doc(db, 'usuarios', usuarioAtual.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) { setClientes(docSnap.data().clientes || []); } 
        else { setClientes([]); }
      }
      setAuthLoading(false);
    });
    return () => desinscrever();
  }, []);

  const atualizarE_SalvarClientes = async (novosClientes) => {
    setClientes(novosClientes); 
    if (user) { await setDoc(doc(db, 'usuarios', user.uid), { clientes: novosClientes }); }
  };

  const [clienteAtual, setClienteAtual] = useState(null);
  const [aspecto, setAspecto] = useState(''); 
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
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

  const piscinasDeHoje = clientes.filter(c => c.diasVisita.includes(diaAtual) || c.adiadoPara === diaAtual);

  const handleLogin = async () => {
    try { await signInWithEmailAndPassword(auth, emailLogin, senhaLogin); } 
    catch (error) { alert("E-mail ou senha incorretos."); }
  };

  const handleCadastro = async () => {
    try { await createUserWithEmailAndPassword(auth, emailLogin, senhaLogin); } 
    catch (error) { alert("Erro ao cadastrar: " + error.message); }
  };

  const handleRecuperarSenha = async () => {
    if(!emailLogin) return alert("Digite seu e-mail primeiro.");
    try {
      await sendPasswordResetEmail(auth, emailLogin);
      alert("E-mail de recuperação enviado!");
    } catch (error) { alert("Erro ao enviar e-mail."); }
  };

  const handleSair = async () => { if(window.confirm("Sair da conta?")) await signOut(auth); };

  const iniciarVisita = (cliente) => {
    atualizarE_SalvarClientes(clientes.map(c => c.id === cliente.id ? { ...c, visitaEmAndamentoData: dataHojeStr } : c));
    setClienteAtual(cliente);
    if (cliente.visitaEmAndamentoData !== dataHojeStr) { setHoraInicioVisita(Date.now()); }
    setTela('visita');
  };

  const processarFotoComprimida = (e, callback) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 500; 
        let width = img.width; let height = img.height;
        if (width > height && width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } 
        else if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleNovaFoto = (e) => processarFotoComprimida(e, (base) => { setFotosVisita([...fotosVisita, base]); setFotosContagem(fotosContagem + 1); });
  const removerFoto = (i) => { setFotosVisita(fotosVisita.filter((_, idx) => idx !== i)); setFotosContagem(fotosContagem - 1); };
  const handleFotoAlerta = (e) => processarFotoComprimida(e, (base) => { setFotosAlerta([...fotosAlerta, base]); });
  const removerFotoAlerta = (i) => { setFotosAlerta(fotosAlerta.filter((_, idx) => idx !== i)); };

  const toggleProduto = (n) => {
    const ex = produtosFaltando.find(p => p.nome === n);
    if (ex) { setProdutosFaltando(produtosFaltando.filter(p => p.nome !== n)); } 
    else { setProdutosFaltando([...produtosFaltando, { nome: n, qtd: 1 }]); }
  };

  const adiarVisita = (id, dia) => { atualizarE_SalvarClientes(clientes.map(c => c.id === id ? { ...c, adiadoPara: dia } : c)); setMostrarAdiarId(null); };

  const adicionarCliente = () => {
    if (novoNome && novaRua && novosDias.length > 0) {
      const end = `${novaRua}, ${novoNumero ? novoNumero + ', ' : ''}${novoBairro}`;
      atualizarE_SalvarClientes([...clientes, { id: Date.now(), nome: novoNome, endereco: end, rua: novaRua, numero: novoNumero, bairro: novoBairro, diasVisita: novosDias, adiadoPara: null, ultimaVisita: null, visitaEmAndamentoData: null, ultimosProdutosFaltando: [], historicoVisitas: [] }]);
      setTela('lista');
    } else { alert("Preencha os campos obrigatórios."); }
  };

  const salvarVisita = () => {
    if (fotosContagem < 3 || !ph || !cloro || !aspecto) return alert("Preencha pH, Cloro, Aspecto e tire 3 fotos.");
    const df = new Date();
    const di = new Date(horaInicioVisita || Date.now());
    const fH = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const tMs = df.getTime() - di.getTime();
    const tM = Math.max(1, Math.round(tMs / 60000));
    const tF = tM >= 60 ? `${Math.floor(tM/60)}h ${tM%60}m` : `${tM}m`;
    const dF = `${String(dateObj.getDate()).padStart(2, '0')}/${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][dateObj.getMonth()]}`;

    const novaV = { d: dF, h: `${fH(di)} - ${fH(df)}`, a: aspecto, c: cloro, p: ph, al: alcalinidade, t: tF, tMs: tMs, fotos: fotosVisita, fotosA: fotosAlerta, txtA: textoAlerta };
    
    atualizarE_SalvarClientes(clientes.map(c => c.id === clienteAtual.id ? { ...c, ultimaVisita: dataHojeStr, visitaEmAndamentoData: null, adiadoPara: null, ultimosProdutosFaltando: [...produtosFaltando], historicoVisitas: [...(c.historicoVisitas || []), novaV] } : c));
    alert("Visita Finalizada!"); setTela('lista'); resetarForm();
  };

  const resetarForm = () => { setAspecto(''); setPh(''); setCloro(''); setAlcalinidade(''); setFotosContagem(0); setFotosVisita([]); setFotosAlerta([]); setTextoAlerta(''); setProdutosFaltando([]); };

  // --- FUNÇÃO DE IMPRESSÃO NATIVA ---
  const imprimirRelatorio = () => {
    setModoImpressao(true);
    setTimeout(() => {
      window.print();
      setModoImpressao(false);
    }, 500);
  };

  if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-teal-400 font-bold">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
        <h1 className={`text-5xl font-black mb-8 ${gradText}`}>Mão Na Água</h1>
        <div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-sm border border-zinc-800">
          <input type="email" placeholder="E-mail" value={emailLogin} onChange={e => setEmailLogin(e.target.value)} className="w-full bg-zinc-950 p-4 rounded-xl mb-4 outline-none border border-zinc-800 focus:border-teal-400" />
          <input type="password" placeholder="Senha" value={senhaLogin} onChange={e => setSenhaLogin(e.target.value)} className="w-full bg-zinc-950 p-4 rounded-xl mb-6 outline-none border border-zinc-800 focus:border-teal-400" />
          <button onClick={isRegistering ? handleCadastro : handleLogin} className={`w-full py-4 rounded-xl font-bold ${gradBtn}`}>{isRegistering ? 'CADASTRAR' : 'ENTRAR'}</button>
          <div className="mt-6 text-center space-y-3">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-zinc-400">{isRegistering ? 'Já tem conta? Login' : 'Não tem conta? Cadastre-se'}</button>
            {!isRegistering && <button onClick={handleRecuperarSenha} className="block w-full text-xs text-zinc-500 underline">Esqueci minha senha</button>}
          </div>
        </div>
      </div>
    );
  }

  if (tela === 'lista') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto pb-24 transition-colors">
        <header className="flex justify-between items-center mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div><h1 className={`text-3xl font-black ${gradText}`}>Mão Na Água</h1><p className="text-xs text-zinc-500">Hoje é {diasDaSemanaNomes[diaAtual]}</p></div>
          <div className="flex gap-2">
            <button onClick={() => setModoEscuro(!modoEscuro)} className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">{modoEscuro ? <Sun size={18} className="text-teal-400" /> : <Moon size={18} className="text-slate-600" />}</button>
            <button onClick={handleSair} className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-rose-500"><LogOut size={18} /></button>
          </div>
        </header>
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><Droplets className="text-sky-400" size={18}/> Limpar Hoje</h2>
        <div className="space-y-4">
          {piscinasDeHoje.length === 0 ? <p className="text-center py-10 text-zinc-400">Tudo limpo por hoje!</p> : piscinasDeHoje.map(c => (
            <div key={c.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="font-bold dark:text-white">{c.nome}</h3><p className="text-[10px] text-zinc-500 flex items-center gap-1"><MapPin size={10}/> {c.endereco}</p></div>
                {c.ultimaVisita === dataHojeStr && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold">OK</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => iniciarVisita(c)} className={`flex-1 py-3 rounded-xl font-bold text-xs ${c.ultimaVisita === dataHojeStr ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400' : gradBtn}`}>INICIAR</button>
                <button onClick={() => setMostrarAdiarId(c.id)} className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-xs font-bold dark:text-zinc-300">ADIAR</button>
              </div>
              {mostrarAdiarId === c.id && (
                <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl grid grid-cols-4 gap-2">
                  {diasDaSemanaNomes.map((d, i) => i !== diaAtual && <button key={i} onClick={() => adiarVisita(c.id, i)} className="text-[10px] p-2 bg-white dark:bg-zinc-700 rounded-lg font-bold">{d.substring(0,3)}</button>)}
                  <button onClick={() => setMostrarAdiarId(null)} className="col-span-4 text-[10px] text-rose-500 font-bold py-1">Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => setTela('relatorio')} className="fixed bottom-6 left-6 bg-white dark:bg-zinc-900 p-4 rounded-full shadow-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2"><FileText size={20} className="text-teal-500"/><span className="text-xs font-bold dark:text-white">CLIENTES</span></button>
        <button onClick={() => setTela('novo_cliente')} className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl ${gradBtn}`}><Plus size={24}/></button>
      </div>
    );
  }

  if (tela === 'visita') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto pb-20">
        <header className="flex items-center gap-4 mb-6"><button onClick={() => setTela('lista')} className="p-2 dark:text-white"><ArrowLeft/></button><h2 className="font-bold dark:text-white">{clienteAtual.nome}</h2></header>
        <div className="space-y-6">
          <section>
            <label className="text-xs font-bold text-sky-500 mb-2 block uppercase">Aspecto</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cristalina', 'Turva', 'Verde'].map(v => <button key={v} onClick={() => setAspecto(v)} className={`py-3 rounded-xl font-bold text-xs border ${aspecto === v ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white dark:bg-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800'}`}>{v}</button>)}
            </div>
          </section>
          <section className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-bold mb-3 flex items-center gap-2 dark:text-white"><Camera size={14}/> Fotos (Mín. 3) - {fotosContagem}/3</h3>
            <label className="w-full py-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center cursor-pointer">
              <Camera className="text-zinc-300 mb-2" size={30}/><span className="text-xs text-zinc-400 font-bold">Tirar Foto</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNovaFoto} />
            </label>
            <div className="flex gap-2 overflow-x-auto mt-4">
              {fotosVisita.map((f, i) => <div key={i} className="relative min-w-[70px] h-16 rounded-lg overflow-hidden"><img src={f} className="w-full h-full object-cover"/><button onClick={() => removerFoto(i)} className="absolute top-0 right-0 bg-rose-500 text-white p-1"><Trash2 size={10}/></button></div>)}
            </div>
          </section>
          <section className="grid grid-cols-3 gap-3">
            <div className="text-center"><span className="text-[10px] font-bold text-zinc-500">PH</span><input type="number" value={ph} onChange={e => setPh(e.target.value)} className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-bold dark:text-white" placeholder="7.2"/></div>
            <div className="text-center"><span className="text-[10px] font-bold text-zinc-500">CLORO</span><input type="number" value={cloro} onChange={e => setCloro(e.target.value)} className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-bold dark:text-white" placeholder="2.0"/></div>
            <div className="text-center"><span className="text-[10px] font-bold text-zinc-500">ALC</span><input type="number" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-bold dark:text-white" placeholder="100"/></div>
          </section>
          <section className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
            <h3 className="text-xs font-bold text-rose-500 mb-3 flex items-center gap-2"><AlertTriangle size={14}/> Relatar Problema</h3>
            <label className="w-full py-4 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-center gap-2 cursor-pointer mb-3">
              <Camera size={16} className="text-rose-400"/><span className="text-xs font-bold text-rose-400">Anexar Defeito</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoAlerta} />
            </label>
            <div className="flex gap-2 overflow-x-auto mb-3">
              {fotosAlerta.map((f, i) => <div key={i} className="relative min-w-[60px] h-12 rounded-lg overflow-hidden border border-rose-200"><img src={f} className="w-full h-full object-cover"/><button onClick={() => removerFotoAlerta(i)} className="absolute top-0 right-0 bg-rose-500 text-white p-0.5"><Trash2 size={8}/></button></div>)}
            </div>
            <textarea value={textoAlerta} onChange={e => setTextoAlerta(e.target.value)} className="w-full p-3 bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs outline-none dark:text-white" placeholder="Descreva o problema aqui..."/>
          </section>
          <button onClick={salvarVisita} className={`w-full py-4 rounded-2xl font-bold text-lg ${gradBtn}`}>FINALIZAR LIMPEZA</button>
        </div>
      </div>
    );
  }

  if (tela === 'relatorio') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto">
        <header className="flex items-center gap-4 mb-6"><button onClick={() => setTela('lista')} className="p-2 dark:text-white"><ArrowLeft/></button><h2 className="font-bold text-xl dark:text-white">Meus Clientes</h2></header>
        <div className="space-y-3">
          {clientes.map(c => <button key={c.id} onClick={() => { setClienteRelatorio(c); setTela('ver_relatorio'); }} className="w-full bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-left flex justify-between items-center group"><span className="font-bold dark:text-white">{c.nome}</span><FileText size={18} className="text-zinc-300 group-hover:text-teal-400"/></button>)}
        </div>
      </div>
    );
  }

  if (tela === 'ver_relatorio') {
    const cExp = clientes.find(c => c.id === clienteRelatorio.id) || clienteRelatorio;
    const hist = cExp.historicoVisitas || [];
    // Filtro: Apenas a primeira foto de cada visita
    const fotosMes = hist.filter(v => v.fotos?.length > 0).map(v => ({ src: v.fotos[0], d: v.d }));
    const alertas = hist.filter(v => v.fotosA?.length > 0 || v.txtA);

    return (
      <div className={`min-h-screen ${modoImpressao ? 'bg-white p-0' : 'bg-slate-100 dark:bg-zinc-950 p-4 pb-20'}`}>
        
        {/* --- CABEÇALHO DO DOSSIÊ (Escondido no PDF) --- */}
        {!modoImpressao && (
          <header className="max-w-md mx-auto flex items-center gap-4 mb-6">
            <button onClick={() => setTela('relatorio')} className="p-2 dark:text-white"><ArrowLeft/></button>
            <h2 className="font-bold text-lg dark:text-white">Pasta de {cExp.nome}</h2>
          </header>
        )}

        {/* --- ÁREA DO RELATÓRIO COMPLETO (PDF) --- */}
        <div id="relatorio-completo" className={`bg-white w-full max-w-2xl mx-auto shadow-2xl rounded-3xl overflow-hidden border border-zinc-200 text-zinc-900 ${modoImpressao ? 'shadow-none border-none rounded-none' : ''}`}>
          <div className="h-2 bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400"></div>
          
          <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div><h1 className="text-3xl font-black text-sky-500 mb-1">Mão Na Água</h1><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Gestão Profissional de Piscinas</p></div>
              <div className="text-right"><p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Relatório Mensal</p><div className="bg-sky-50 px-3 py-1 rounded-lg text-sky-700 font-bold text-sm">{mesEscrito} / {anoEscrito}</div></div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl mb-8 border border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Cliente / Localização</p>
              <p className="text-xl font-black text-zinc-800">{cExp.nome}</p>
              <p className="text-xs text-zinc-500 mt-1">{cExp.endereco}</p>
            </div>

            <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-2 mb-4 uppercase tracking-widest">Histórico de Manutenções</h3>
            <table className="w-full text-[10px] mb-10 border-collapse">
              <thead><tr className="bg-slate-50 text-zinc-400 font-bold uppercase"><th className="p-2 text-left border-b border-zinc-100">Data</th><th className="p-2 text-left border-b border-zinc-100">Água</th><th className="p-2 border-b border-zinc-100 text-center">Cl</th><th className="p-2 border-b border-zinc-100 text-center">pH</th><th className="p-2 border-b border-zinc-100 text-center">Alc</th></tr></thead>
              <tbody>
                {hist.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-zinc-400 italic">Sem registros este mês.</td></tr> : hist.map((v, i) => (
                  <tr key={i} className="border-b border-zinc-50"><td className="p-2 font-bold text-zinc-700">{v.d}</td><td className={`p-2 font-bold ${v.a === 'Cristalina' ? 'text-emerald-500' : 'text-amber-500'}`}>{v.a}</td><td className="p-2 text-center text-zinc-600 font-bold">{v.c}</td><td className="p-2 text-center text-zinc-600 font-bold">{v.p}</td><td className="p-2 text-center text-zinc-600 font-bold">{v.al}</td></tr>
                ))}
              </tbody>
            </table>

            {alertas.length > 0 && (
              <div className="mb-10">
                <h3 className="text-xs font-bold text-rose-500 border-b border-rose-100 pb-2 mb-4 uppercase tracking-widest flex items-center gap-2">Ocorrências Técnicas</h3>
                <div className="space-y-4">
                  {alertas.map((v, i) => (
                    <div key={i} className="bg-rose-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-rose-800 mb-2">{v.d} - RELATO TÉCNICO:</p>
                      <p className="text-xs text-zinc-700 mb-3 leading-relaxed">{v.txtA || "Alerta visual registrado."}</p>
                      <div className="flex gap-2 flex-wrap">
                        {v.fotosA?.map((f, idx) => <img key={idx} src={f} className="w-24 h-24 object-cover rounded-xl border border-rose-200" />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fotosMes.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-2 mb-4 uppercase tracking-widest">Resumo Fotográfico das Visitas</h3>
                <div className="grid grid-cols-2 gap-3">
                  {fotosMes.map((f, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-zinc-100 h-40">
                      <img src={f.src} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 w-full bg-black/50 text-white text-[9px] font-bold p-1 text-center">{f.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-zinc-100 text-center">
              <p className="text-xs font-bold text-zinc-400 mb-1">Mão Na Água • Samuel Roque</p>
              <p className="text-[8px] text-zinc-300">Para visualizar a galeria completa de fotos em alta resolução, solicite o link da pasta virtual via WhatsApp.</p>
            </div>
          </div>
        </div>

        {/* --- BOTÕES (Sempre ocultos no PDF) --- */}
        {!modoImpressao && (
          <div className="max-w-md mx-auto mt-8 space-y-4">
            <button onClick={imprimirRelatorio} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg ${gradBtn}`}><Share2 size={20}/> SALVAR RELATÓRIO COMPLETO (PDF)</button>
            <button onClick={() => { setNovoNome(cExp.nome); setNovaRua(cExp.rua || ''); setNovoBairro(cExp.bairro || ''); setNovoNumero(cExp.numero || ''); setNovosDias(cExp.diasVisita || []); setClienteAtual(cExp); setTela('editar_cliente'); }} className="w-full py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-xs dark:text-white flex items-center justify-center gap-2"><Pencil size={14}/> EDITAR CADASTRO</button>
            <button onClick={() => { if(window.confirm("Excluir cliente para sempre?")) atualizarE_SalvarClientes(clientes.filter(c => c.id !== cExp.id)); setTela('relatorio'); }} className="w-full py-4 text-rose-500 font-bold text-xs flex items-center justify-center gap-2"><Trash2 size={14}/> EXCLUIR CLIENTE DA NUVEM</button>
          </div>
        )}

        {/* CSS PARA OCULTAR TUDO NO PDF, EXCETO O RELATÓRIO */}
        <style>{`
          @media print {
            body { background: white !important; margin: 0; padding: 0; }
            header, button, .lucide, .fixed, footer { display: none !important; }
            #relatorio-completo { border: none !important; box-shadow: none !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
            .dark { background: white !important; color: black !important; }
          }
        `}</style>
      </div>
    );
  }

  // --- TELAS DE CADASTRO / EDIÇÃO (Simplificadas) ---
  if (tela === 'novo_cliente' || tela === 'editar_cliente') {
    const isEdit = tela === 'editar_cliente';
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 max-w-md mx-auto">
        <header className="flex items-center gap-4 mb-10"><button onClick={() => setTela(isEdit ? 'ver_relatorio' : 'lista')} className="dark:text-white"><ArrowLeft/></button><h2 className="font-bold text-xl dark:text-white">{isEdit ? 'Editar' : 'Novo'} Cliente</h2></header>
        <div className="space-y-4">
          <input placeholder="Nome Completo" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl outline-none dark:text-white" />
          <input placeholder="Rua / Avenida" value={novaRua} onChange={e => setNovaRua(e.target.value)} className="w-full p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl outline-none dark:text-white" />
          <div className="flex gap-2">
            <input placeholder="Número" value={novoNumero} onChange={e => setNovoNumero(e.target.value)} className="w-1/3 p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl outline-none dark:text-white" />
            <input placeholder="Bairro" value={novoBairro} onChange={e => setNovoBairro(e.target.value)} className="w-2/3 p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl outline-none dark:text-white" />
          </div>
          <div className="py-4">
            <p className="text-xs font-bold text-zinc-400 mb-3">Dias de Limpeza</p>
            <div className="grid grid-cols-4 gap-2">
              {diasDaSemanaNomes.map((d, i) => <button key={i} onClick={() => { setNovosDias(novosDias.includes(i) ? novosDias.filter(x => x !== i) : [...novosDias, i]); }} className={`p-2 rounded-lg text-[10px] font-bold border ${novosDias.includes(i) ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white dark:bg-zinc-900 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>{d.substring(0,3)}</button>)}
            </div>
          </div>
          <button onClick={isEdit ? () => {
            const end = `${novaRua}, ${novoNumero ? novoNumero + ', ' : ''}${novoBairro}`;
            atualizarE_SalvarClientes(clientes.map(c => c.id === clienteAtual.id ? { ...c, nome: novoNome, endereco: end, rua: novaRua, numero: novoNumero, bairro: novoBairro, diasVisita: novosDias } : c));
            setTela('ver_relatorio');
          } : adicionarCliente} className={`w-full py-5 rounded-2xl font-bold text-lg ${gradBtn}`}>{isEdit ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR'}</button>
        </div>
      </div>
    );
  }

  return null;
}