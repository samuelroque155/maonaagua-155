import { useState, useEffect, useRef } from 'react';
import { 
  Camera, Droplets, ShoppingCart, ArrowLeft, Check, MapPin, Save, FileText, Plus, 
  AlertTriangle, CalendarDays, CheckCircle2, Phone, MessageSquare, Minus, Share2, Clock, RotateCcw, Trash2, Sun, Moon, LogOut, Navigation, Pencil, BellRing
} from 'lucide-react';
import { toPng } from 'html-to-image';

// --- IMPORTAÇÕES DO FIREBASE ---
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

// --- O SEU TEMA AQUÁTICO EM GRADIENTE ---
const gradBtn = "bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 text-white border-none shadow-[0_4px_14px_0_rgba(56,189,248,0.39)] hover:shadow-[0_6px_20px_rgba(56,189,248,0.23)] hover:scale-[1.02] transition-all duration-200";
const gradText = "bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent";
const gradBorder = "border-transparent bg-clip-border bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400"; 
const gradIconBg = "bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/30 dark:to-emerald-900/30 text-teal-600 dark:text-teal-400";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [tela, setTela] = useState('lista'); 
  const [clienteRelatorio, setClienteRelatorio] = useState(null);
  const [modoImpressao, setModoImpressao] = useState(null);

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

  useEffect(() => {
    const desinscrever = onAuthStateChanged(auth, async (usuarioAtual) => {
      setUser(usuarioAtual);
      if (usuarioAtual) {
        const docRef = doc(db, 'usuarios', usuarioAtual.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setClientes(docSnap.data().clientes || []);
        } else {
          await setDoc(docRef, { clientes: [] });
          setClientes([]);
        }
      }
      setAuthLoading(false);
    });
    return () => desinscrever();
  }, []);

  const atualizarE_SalvarClientes = async (novosClientes) => {
    setClientes(novosClientes); 
    if (user) {
      await setDoc(doc(db, 'usuarios', user.uid), { clientes: novosClientes });
    }
  };

  const [clienteAtual, setClienteAtual] = useState(null);
  const [aspecto, setAspecto] = useState(''); 
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
  const [temperatura, setTemperatura] = useState(''); // NOVO ESTADO
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

  const piscinasDeHoje = clientes.filter(c => c.diasVisita.includes(diaAtual) || c.adiadoPara === diaAtual);

  useEffect(() => {
    if (!user || clientes.length === 0) return;

    if (typeof Notification !== 'undefined' && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checarNotificacoes = () => {
      const agora = new Date();
      const diaAtualLocal = agora.getDay();
      const horaStr = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
      const dataKey = agora.toDateString(); 

      const clientesParaNotificar = clientes.filter(c => {
        const hojeE_DiaVisita = c.diasVisita?.includes(diaAtualLocal) || c.adiadoPara === diaAtualLocal;
        if (!hojeE_DiaVisita) return false;
        if (!c.horaVisita) return false;
        
        const jaNotificadoKey = `${c.id}-${dataKey}-${c.horaVisita}`;
        if (notificadosHojeRef.current.has(jaNotificadoKey)) return false;

        return c.horaVisita === horaStr;
      });

      if (clientesParaNotificar.length > 0) {
        const novasNots = [];
        clientesParaNotificar.forEach(c => {
          const jaNotificadoKey = `${c.id}-${dataKey}-${c.horaVisita}`;
          notificadosHojeRef.current.add(jaNotificadoKey);

          // Tocar o som de água
          try {
            const audio = new Audio('/agua.ogg');
            audio.play().catch(e => console.log('Áudio bloqueado pelo navegador', e));
          } catch(e) {}

          if (typeof window !== 'undefined' && 'serviceWorker' in navigator && Notification.permission === "granted") {
             navigator.serviceWorker.ready.then(registration => {
               registration.showNotification("Mão Na Água", {
                 body: `Hora de limpar a piscina de ${c.nome}!`,
                 icon: "/favicon.ico",
                 vibrate: [200, 100, 200, 100, 200, 100, 200],
                 tag: `limpeza-${c.id}`
               }).catch(() => {
                 new Notification("Mão Na Água", { body: `Hora de limpar a piscina de ${c.nome}!` });
               });
             });
          } else if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
             try {
               new Notification("Mão Na Água", { body: `Hora de limpar a piscina de ${c.nome}!` });
             } catch (e) {}
          }
          
          novasNots.push({ id: Date.now() + Math.random(), clienteNome: c.nome, hora: c.horaVisita });
        });
        
        setNotificacoesAtivas(prev => [...prev, ...novasNots]);
      }
    };

    const intervalId = setInterval(checarNotificacoes, 30000); 
    checarNotificacoes(); 

    return () => clearInterval(intervalId);
  }, [clientes, user]);

  const handleLogin = async () => {
    if(!emailLogin || !senhaLogin) return alert("Preencha e-mail e senha");
    try {
      await signInWithEmailAndPassword(auth, emailLogin, senhaLogin);
    } catch (error) {
      alert("Erro ao entrar: Verifique se o e-mail e a senha estão corretos.");
    }
  };

  const handleCadastro = async () => {
    if(!emailLogin || !senhaLogin) return alert("Preencha e-mail e senha");
    if(senhaLogin.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");
    try {
      await createUserWithEmailAndPassword(auth, emailLogin, senhaLogin);
    } catch (error) {
      alert("Erro ao cadastrar: " + error.message);
    }
  };

  const handleRecuperarSenha = async () => {
    if(!emailLogin) {
      return alert("Para redefinir a senha, primeiro digite o seu e-mail no campo acima e depois clique aqui.");
    }
    try {
      await sendPasswordResetEmail(auth, emailLogin);
      alert("✅ E-mail de recuperação enviado!\n\nVerifique sua caixa de entrada (e a pasta de Spam) para criar uma nova senha.");
    } catch (error) {
      alert("Erro ao enviar e-mail: Verifique se o e-mail foi digitado corretamente.");
    }
  };

  const handleSair = async () => {
    const sair = window.confirm("Tem certeza que deseja sair da sua conta?");
    if(sair) await signOut(auth);
  };

  const iniciarVisita = (cliente) => {
    atualizarE_SalvarClientes(clientes.map(c => c.id === cliente.id ? { ...c, visitaEmAndamentoData: dataHojeStr } : c));
    setClienteAtual(cliente);
    if (cliente.visitaEmAndamentoData !== dataHojeStr) {
      setHoraInicioVisita(Date.now()); 
    }
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
        const MAX_DIM = 400; 
        let width = img.width; let height = img.height;
        if (width > height && width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } 
        else if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleNovaFoto = (e) => processarFotoComprimida(e, (base64) => {
    setFotosVisita(prev => [...prev, base64]);
    setFotosContagem(prev => prev + 1);
  });

  const removerFoto = (indexToRemove) => {
    setFotosVisita(prev => prev.filter((_, index) => index !== indexToRemove));
    setFotosContagem(prev => prev - 1);
  };

  const handleFotoAlerta = (e) => processarFotoComprimida(e, (base64) => {
    setFotosAlerta(prev => [...prev, base64]); 
  });

  const removerFotoAlerta = (indexToRemove) => {
    setFotosAlerta(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const toggleProduto = (nome) => {
    const existe = produtosFaltando.find(p => p.nome === nome);
    if (existe) {
      setProdutosFaltando(produtosFaltando.filter(p => p.nome !== nome));
    } else {
      setProdutosFaltando([...produtosFaltando, { nome, qtd: 1 }]);
    }
  };

  const updateQtdProduto = (nome, delta) => {
    setProdutosFaltando(produtosFaltando.map(p => p.nome === nome ? { ...p, qtd: Math.max(1, p.qtd + delta) } : p));
  };

  const adiarVisita = (clienteId, novoDiaIndex) => {
    atualizarE_SalvarClientes(clientes.map(c => c.id === clienteId ? { ...c, adiadoPara: novoDiaIndex } : c));
    setMostrarAdiarId(null);
  };

  const irParaNovoCliente = () => {
    setNovoNome(''); setNovaRua(''); setNovoNumero(''); setNovoBairro(''); setNovosDias([]); setNovaHora('');
    setTela('novo_cliente');
  };

  const adicionarCliente = () => {
    if (novoNome && novaRua && novoBairro && novosDias.length > 0) {
      const enderecoCompleto = `${novaRua}, ${novoNumero ? novoNumero + ', ' : ''}${novoBairro}`;
      atualizarE_SalvarClientes([...clientes, { 
        id: Date.now(), nome: novoNome, endereco: enderecoCompleto, rua: novaRua, numero: novoNumero, bairro: novoBairro, diasVisita: novosDias, horaVisita: novaHora,
        adiadoPara: null, ultimaVisita: null, visitaEmAndamentoData: null, ultimosProdutosFaltando: [], historicoVisitas: [] 
      }]);
      setNovoNome(''); setNovaRua(''); setNovoNumero(''); setNovoBairro(''); setNovosDias([]); setNovaHora(''); setTela('lista');
    } else {
      alert("Preencha nome, rua, bairro e selecione pelo menos um dia da semana.");
    }
  };

  const abrirEdicaoCliente = (cliente) => {
    setClienteAtual(cliente);
    setNovoNome(cliente.nome);
    setNovaRua(cliente.rua || cliente.endereco || ''); 
    setNovoNumero(cliente.numero || '');
    setNovoBairro(cliente.bairro || '');
    setNovosDias(cliente.diasVisita || []);
    setNovaHora(cliente.horaVisita || '');
    setTela('editar_cliente');
  };

  const salvarEdicaoCliente = () => {
    if (novoNome && novaRua && novoBairro && novosDias.length > 0) {
      const enderecoCompleto = `${novaRua}, ${novoNumero ? novoNumero + ', ' : ''}${novoBairro}`;
      
      atualizarE_SalvarClientes(clientes.map(c => 
        c.id === clienteAtual.id 
          ? { ...c, nome: novoNome, rua: novaRua, numero: novoNumero, bairro: novoBairro, endereco: enderecoCompleto, diasVisita: novosDias, horaVisita: novaHora } 
          : c
      ));
      
      setNovoNome(''); setNovaRua(''); setNovoNumero(''); setNovoBairro(''); setNovosDias([]); setNovaHora('');
      setClienteAtual(null);
      setTela('relatorio'); 
      alert("✅ Cadastro atualizado com sucesso!");
    } else {
      alert("Preencha nome, rua, bairro e selecione pelo menos um dia da semana.");
    }
  };

  const alternarDiaNovoCliente = (diaIndex) => {
    setNovosDias(novosDias.includes(diaIndex) ? novosDias.filter(d => d !== diaIndex) : [...novosDias, diaIndex]);
  };

  const excluirCliente = (id) => {
    const confirmacao = window.confirm("⚠️ TEM CERTEZA?\n\nIsso vai apagar este cliente e todo o histórico de visitas dele para sempre da nuvem.");
    if (confirmacao) {
      atualizarE_SalvarClientes(clientes.filter(c => c.id !== id));
      setTela('relatorio');
    }
  };

  const validarFecharTarefa = () => {
    return fotosContagem >= 3 && ph !== '' && cloro !== '' && alcalinidade !== '' && aspecto !== '';
  };

  const salvarVisita = () => {
    if (!validarFecharTarefa()) {
      alert("⚠️ ATENÇÃO:\n\nPara finalizar, você precisa de:\n- No mínimo 3 fotos\n- Preencher pH, Cloro e Alc\n- Selecionar o aspecto da água.");
      return;
    }
    
    const dataFim = new Date();
    const dataInicio = new Date(horaInicioVisita || Date.now());
    
    const formataHora = (data) => `${data.getHours().toString().padStart(2, '0')}:${data.getMinutes().toString().padStart(2, '0')}`;
    const horarioVisita = `${formataHora(dataInicio)} - ${formataHora(dataFim)}`;

    const tempoMsTotal = dataFim.getTime() - dataInicio.getTime();
    const tempoMinutos = Math.max(1, Math.round(tempoMsTotal / 60000)); 
    const tempoFormatado = tempoMinutos >= 60 ? `${Math.floor(tempoMinutos/60)}h ${tempoMinutos%60}m` : `${tempoMinutos}m`;
    
    const diaFormatado = String(dateObj.getDate()).padStart(2, '0');
    const mesesCurtos = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const novaVisita = {
      d: `${diaFormatado}/${mesesCurtos[dateObj.getMonth()]}`,
      h: horarioVisita, 
      a: aspecto, 
      c: cloro, 
      p: ph, 
      al: alcalinidade, 
      temp: temperatura, // NOVO CAMPO SALVO
      t: tempoFormatado,
      tMs: tempoMsTotal, 
      fotos: fotosVisita, 
      fotosA: fotosAlerta, 
      txtA: textoAlerta
    };
    
    atualizarE_SalvarClientes(clientes.map(c => {
      if (c.id === clienteAtual.id) {
        const historicoBase = c.historicoVisitas || [];
        return { 
          ...c, 
          ultimaVisita: dataHojeStr, 
          visitaEmAndamentoData: null, 
          adiadoPara: null,
          ultimosProdutosFaltando: [...produtosFaltando],
          historicoVisitas: [...historicoBase, novaVisita]
        };
      }
      return c;
    }));

    alert(`✅ VISITA FINALIZADA!\n\nSalvo na nuvem com sucesso. Tempo: ${tempoFormatado}`);
    setTela('lista');
    resetarFormulario();
  };

  const executarReabertura = (clienteAlvo) => {
    const historico = clienteAlvo.historicoVisitas || [];
    if (historico.length === 0) return;
    
    const ultimaVisitaReal = historico[historico.length - 1];
    
    setAspecto(ultimaVisitaReal.a || ''); setPh(ultimaVisitaReal.p || ''); setCloro(ultimaVisitaReal.c || ''); setAlcalinidade(ultimaVisitaReal.al || '');
    setTemperatura(ultimaVisitaReal.temp || ''); // REABRE COM TEMPERATURA
    setFotosVisita(ultimaVisitaReal.fotos || []); setFotosContagem(ultimaVisitaReal.fotos ? ultimaVisitaReal.fotos.length : 0);
    setFotosAlerta(ultimaVisitaReal.fotosA || []); 
    setTextoAlerta(ultimaVisitaReal.txtA || '');
    setProdutosFaltando(clienteAlvo.ultimosProdutosFaltando || []); 
    
    setHoraInicioVisita(Date.now() - (ultimaVisitaReal.tMs || 0)); 
    
    const novoHistorico = historico.slice(0, -1);
    atualizarE_SalvarClientes(clientes.map(c => c.id === clienteAlvo.id ? { 
      ...c, 
      ultimaVisita: null, 
      visitaEmAndamentoData: dataHojeStr,
      historicoVisitas: novoHistorico, 
      ultimosProdutosFaltando: [] 
    } : c));
    
    setClienteAtual(clienteAlvo);
    setTela('visita');
  };

  const reabrirTarefaDaHome = (cliente) => executarReabertura(cliente);
  const reabrirTarefa = () => executarReabertura(clientes.find(c => c.id === clienteRelatorio.id));

  const resetarFormulario = () => {
    setAspecto(''); setPh(''); setCloro(''); setAlcalinidade(''); setTemperatura('');
    setFotosContagem(0); setFotosVisita([]); setHoraInicioVisita(null); 
    setFotosAlerta([]); 
    setTextoAlerta(''); setProdutosFaltando([]); setClienteAtual(null);
  };

  const enviarAvisoWhatsApp = (cliente, historicoProdutos = []) => {
    let mensagem = `Olá, ${cliente.nome}! 🌊\nPassando para avisar que a manutenção da sua piscina foi concluída com sucesso.\n\n`;
    if (historicoProdutos.length > 0) {
       mensagem += `⚠️ *Produtos/Acessórios Faltando:*\nIdentifiquei que precisamos repor alguns itens:\n`;
       historicoProdutos.forEach(p => { mensagem += `- ${p.qtd}x ${p.nome}\n`; });
       mensagem += `\n`;
    }
    mensagem += `Qualquer dúvida, estou à disposição!\n*Mão Na Água - Gestão Profissional*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // =========================================================================
  // 1. RELATÓRIO PDF NATIVO
  // =========================================================================
  const compartilharRelatorioVisual = () => {
    setModoImpressao('relatorio');
    setTimeout(() => {
      window.print();
      // O timer longo garante que o celular tenha tempo de capturar a tela limpa
      setTimeout(() => {
        setModoImpressao(null);
      }, 3000); 
    }, 300); 
  };

  // =========================================================================
  // 2. ALERTA DE DEFEITO (FOTO PNG, MANTIDO INTACTO)
  // =========================================================================
  const compartilharAlertaSeparado = async () => {
    const elemento = document.getElementById('alerta-print-foto');
    if (!elemento) return;
    
    try {
      const dataUrl = await toPng(elemento, { 
        backgroundColor: '#ffffff', 
        pixelRatio: 2,
        useCORS: true 
      });
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Alerta_${clienteRelatorio.nome}.png`;
      a.click();
      alert("✅ Foto do Alerta de Defeito salva na sua galeria/downloads!");
    } catch(e) { 
      alert('Erro ao gerar a foto do relato: ' + e.message); 
    }
  };


  if (authLoading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-teal-400 font-bold">A conectar ao Firebase...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-sky-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-emerald-400 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>

        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-10">
            <h1 className={`text-6xl font-black mb-2 tracking-tight ${gradText} drop-shadow-sm`}>Mão Na Água</h1>
            <p className="text-teal-200/60 font-medium tracking-widest uppercase text-xs mt-3">Gestão Profissional</p>
          </div>

          <div className="bg-zinc-900/60 p-8 rounded-[2rem] border border-zinc-800 shadow-2xl backdrop-blur-md">
            <h2 className="text-xl font-bold mb-8 text-zinc-100">{isRegistering ? 'Criar Nova Conta' : 'Aceda à sua aplicação'}</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">E-mail</label>
                <input type="email" placeholder="seu@email.com" value={emailLogin} onChange={e => setEmailLogin(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 text-white transition-colors mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">Senha</label>
                <input type="password" placeholder="Mínimo 6 caracteres" value={senhaLogin} onChange={e => setSenhaLogin(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 text-white transition-colors mt-1" />
              </div>
              
              <button onClick={isRegistering ? handleCadastro : handleLogin} className={`w-full py-4 rounded-2xl font-bold mt-6 text-lg ${gradBtn}`}>
                {isRegistering ? 'CADASTRAR E ENTRAR' : 'ENTRAR'}
              </button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-zinc-400 font-medium hover:text-teal-400 transition-colors">
                {isRegistering ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
              </button>
              
              {!isRegistering && (
                <button onClick={handleRecuperarSenha} className="text-xs text-zinc-500 font-medium hover:text-sky-400 transition-colors underline underline-offset-4">
                  Esqueci minha senha
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tela === 'lista') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto text-zinc-900 dark:text-zinc-100 pb-24 font-sans transition-colors duration-300 relative">
        {notificacoesAtivas.length > 0 && (
          <div className="fixed top-4 left-0 right-0 z-[100] px-4 pointer-events-none flex flex-col items-center gap-2">
            {notificacoesAtivas.map(not => (
              <div key={not.id} className="w-full max-w-md bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md p-4 rounded-[1.25rem] shadow-2xl border border-zinc-700 pointer-events-auto flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-sky-400 to-teal-400 text-white p-2.5 rounded-[1rem] shadow-lg">
                    <BellRing size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <p className="font-black text-white text-sm tracking-wide">Hora da Limpeza!</p>
                    <p className="text-teal-300 text-xs font-bold mt-0.5">{not.clienteNome} às {not.hora}</p>
                  </div>
                </div>
                <button onClick={() => setNotificacoesAtivas(prev => prev.filter(n => n.id !== not.id))} className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-colors">
                  <Check size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
        <header className="flex justify-between items-start mb-6 pb-2 relative">
          <div>
            <h1 className={`text-4xl font-black ${gradText}`}>Mão Na Água</h1>
            <p className="text-teal-600/70 dark:text-teal-400/60 font-medium text-sm mt-1">Hoje é {diasDaSemanaNomes[diaAtual]}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModoEscuro(!modoEscuro)} className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-teal-600 dark:text-teal-400 shadow-sm hover:scale-105 transition-transform">
              {modoEscuro ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setTela('agenda')} className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sky-500 shadow-sm hover:scale-105 transition-transform">
              <CalendarDays size={20} />
            </button>
            <button onClick={handleSair} className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-rose-500 shadow-sm hover:scale-105 transition-transform">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <h2 className="font-bold text-xl mb-4 text-zinc-800 dark:text-zinc-200 flex items-center gap-2"><Droplets className="text-teal-400" size={20}/> Limpar Hoje</h2>
        <div className="space-y-4">
          {piscinasDeHoje.length === 0 ? (
            <div className="text-center bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 mt-10 shadow-lg relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-emerald-400"></div>
               <Check size={48} className="mx-auto text-teal-400 mb-3" />
               <p className="font-bold text-lg text-zinc-700 dark:text-zinc-300">Tudo limpo por hoje!</p>
            </div>
          ) : piscinasDeHoje.map(c => {
            const foiFinalizadoHoje = c.ultimaVisita === dataHojeStr;
            const emAndamentoHoje = c.visitaEmAndamentoData === dataHojeStr && !foiFinalizadoHoje;
            
            let badgeSelo = <span className="text-[10px] px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Aberto</span>;
            if (foiFinalizadoHoje) {
              badgeSelo = <span className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-teal-400/20 to-emerald-400/20 text-teal-700 dark:text-teal-300 font-bold uppercase tracking-wider border border-teal-200/50 dark:border-teal-800/50">Finalizado</span>;
            } else if (emAndamentoHoje) {
              badgeSelo = <span className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-sky-400/20 to-blue-400/20 text-sky-700 dark:text-sky-300 font-bold uppercase tracking-wider border border-sky-200/50 dark:border-sky-800/50">Em Andamento</span>;
            }

            return (
              <div key={c.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                {foiFinalizadoHoje && <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-teal-400 to-emerald-400"></div>}
                
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-lg ${foiFinalizadoHoje ? 'ml-2 text-zinc-900 dark:text-zinc-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{c.nome}</h3>
                    {c.horaVisita && <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-sky-100 dark:border-sky-900/50"><Clock size={10} /> {c.horaVisita}</span>}
                  </div>
                  {badgeSelo}
                </div>
                
                <div className={`mb-5 ${foiFinalizadoHoje ? 'ml-2' : ''}`}>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><MapPin size={14} className="text-sky-400"/> {c.endereco}</p>
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.endereco + ', Jataí - GO')}`, '_blank')} 
                    className="text-[10px] font-bold text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 flex items-center gap-1 mt-1.5 ml-5 transition-colors"
                  >
                    <Navigation size={10} /> Abrir Rota no Maps
                  </button>
                </div>
                
                {mostrarAdiarId === c.id ? (
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 uppercase tracking-wider">Mover visita para qual dia?</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {diasDaSemanaNomes.map((dia, index) => index !== diaAtual && (
                        <button key={index} onClick={() => adiarVisita(c.id, index)} className="text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl whitespace-nowrap text-zinc-700 dark:text-zinc-300 hover:border-teal-400 transition-colors">{dia}</button>
                      ))}
                    </div>
                    <button onClick={() => setMostrarAdiarId(null)} className="w-full mt-2 text-xs text-rose-500 font-bold p-2 text-center hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">Cancelar</button>
                  </div>
                ) : foiFinalizadoHoje ? (
                  <button onClick={() => reabrirTarefaDaHome(c)} className="w-full py-3.5 rounded-xl font-bold text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                    <RotateCcw size={16}/> Reabrir Visita
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => iniciarVisita(c)} className={`flex-1 py-3.5 rounded-xl font-bold text-sm ${emAndamentoHoje ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md' : gradBtn}`}>
                      {emAndamentoHoje ? 'Continuar Limpeza' : 'Iniciar Limpeza'}
                    </button>
                    <button onClick={() => setMostrarAdiarId(c.id)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-5 py-3.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Remarcar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => setTela('relatorio')} className="fixed bottom-6 left-6 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-6 py-4 rounded-full shadow-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 z-50 hover:scale-105 transition-transform"><FileText size={20} className="text-teal-500" /> <span className="font-bold text-xs uppercase tracking-wider">Relatórios</span></button>
        <button onClick={irParaNovoCliente} className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl z-50 hover:rotate-90 transition-transform ${gradBtn}`}><Plus size={28} /></button>
      </div>
    );
  }

  if (tela === 'agenda') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto text-zinc-900 dark:text-zinc-100 font-sans pb-20 transition-colors duration-300">
        <header className="flex items-center gap-4 mb-8 pt-2"><button onClick={() => setTela('lista')} className="p-2 text-sky-500 bg-sky-50 dark:bg-sky-500/10 rounded-xl"><ArrowLeft size={20} /></button><h2 className={`text-2xl font-black ${gradText}`}>Agenda da Semana</h2></header>
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

  if (tela === 'visita') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto pb-32 font-sans transition-colors duration-300">
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4 sticky top-0 z-20 shadow-sm dark:shadow-none">
          <button onClick={() => setTela('lista')} className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"><ArrowLeft size={20}/></button>
          <h2 className={`font-black text-xl ${gradText}`}>{clienteAtual.nome}</h2>
        </header>
        
        <div className="p-5 space-y-8">
          <section>
            <label className="block text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 uppercase tracking-wider">Aspecto da Água</label>
            <div className="grid grid-cols-3 gap-3">
              {['Cristalina', 'Turva', 'Verde'].map(opt => (
                <button key={opt} onClick={() => setAspecto(opt)} className={`py-4 rounded-[1.25rem] font-bold text-sm transition-all ${aspecto === opt ? gradBtn + " shadow-md" : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-teal-300'}`}>{opt}</button>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-400/10 to-transparent rounded-bl-full pointer-events-none"></div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200"><div className={`p-1.5 rounded-lg ${gradIconBg}`}><Camera size={16} /></div> Fotos Principais (Mín. 3)</h3>
              <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${fotosContagem >= 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>{fotosContagem}/3</span>
            </div>
            <label className="w-full bg-slate-50 dark:bg-zinc-950 border-2 border-dashed border-teal-300/50 dark:border-teal-700/50 py-10 rounded-[1.25rem] flex flex-col items-center gap-3 text-teal-500 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors">
              <Camera size={36} className="text-teal-400" /> <span className="text-sm font-bold tracking-wide">Adicionar Foto da Piscina</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNovaFoto} />
            </label>
            
            {fotosVisita.length > 0 && (
              <div className="flex gap-3 overflow-x-auto mt-5 pb-2 scrollbar-hide">
                {fotosVisita.map((foto, index) => (
                  <div key={index} className="relative min-w-[80px] h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm flex-shrink-0">
                    <img src={foto} className="w-full h-full object-cover" alt={`Foto ${index + 1}`} />
                    <button 
                      onClick={() => removerFoto(index)}
                      className="absolute top-1 right-1 bg-rose-500/90 text-white rounded-md p-1 shadow-sm hover:bg-rose-600 transition-colors backdrop-blur-sm"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-rose-200 dark:border-rose-900/30 relative overflow-hidden transition-colors shadow-sm">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-rose-400 to-rose-600"></div>
             <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2.5 mb-4 ml-3"><div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-500"><AlertTriangle size={16} /></div> Relatar Problema</h3>
             
             <label className={`ml-3 w-[calc(100%-12px)] bg-slate-50 dark:bg-zinc-950 border-2 border-dashed border-rose-300/50 dark:border-rose-700/50 py-8 rounded-[1.25rem] flex flex-col items-center gap-3 text-rose-500 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors`}>
               <Camera size={30} className="text-rose-400" /> 
               <span className="text-sm font-bold tracking-wide">Anexar Foto do Defeito</span>
               <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoAlerta} />
             </label>
             
             {fotosAlerta.length > 0 && (
              <div className="ml-3 mr-3 flex gap-3 overflow-x-auto mt-5 pb-2 scrollbar-hide border-b border-zinc-100 dark:border-zinc-800">
                {fotosAlerta.map((foto, index) => (
                  <div key={index} className="relative min-w-[80px] h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm flex-shrink-0">
                    <img src={foto} className="w-full h-full object-cover" alt={`Defeito ${index + 1}`} />
                    <button 
                      onClick={() => removerFotoAlerta(index)}
                      className="absolute top-1 right-1 bg-rose-500/90 text-white rounded-md p-1 shadow-sm hover:bg-rose-600 transition-colors backdrop-blur-sm"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

             <div className="ml-3 mr-3 mt-4 space-y-4">
                 <textarea 
                   placeholder="Descreva a peça partida, vazamento..." 
                   value={textoAlerta}
                   onChange={e => setTextoAlerta(e.target.value)}
                   className="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 text-zinc-800 dark:text-zinc-200 min-h-[100px] transition-all shadow-inner"
                 />
               </div>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-bold text-teal-600 dark:text-teal-500 uppercase tracking-wider flex items-center gap-2"><Droplets size={14}/> Parâmetros da Água</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center font-bold tracking-widest">pH</span><input type="number" placeholder="7.2" value={ph} onChange={e => setPh(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 outline-none text-teal-600 dark:text-teal-400 font-bold text-lg shadow-sm transition-all" /></div>
              <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center font-bold tracking-widest">CLORO</span><input type="number" placeholder="2.0" value={cloro} onChange={e => setCloro(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none text-sky-600 dark:text-sky-400 font-bold text-lg shadow-sm transition-all" /></div>
              <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center font-bold tracking-widest">ALC</span><input type="number" placeholder="100" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none text-emerald-600 dark:text-emerald-400 font-bold text-lg shadow-sm transition-all" /></div>
            </div>
            
            {/* NOVO CAMPO: TEMPERATURA DA ÁGUA */}
            <div className="mt-4">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest block mb-1.5 ml-2 uppercase">Temperatura da Água (°C)</span>
              <input type="number" placeholder="28" value={temperatura} onChange={e => setTemperatura(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none text-orange-600 dark:text-orange-400 font-bold text-lg shadow-sm transition-all" />
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/5 to-transparent rounded-bl-full pointer-events-none"></div>
            <p className="font-bold text-sm mb-5 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200"><div className={`p-1.5 rounded-lg ${gradIconBg}`}><ShoppingCart size={16}/></div> Produtos a Repor</p>
            <div className="space-y-3">
              {listaQuimica.map(q => {
                const item = produtosFaltando.find(p => p.nome === q);
                return (
                  <div key={q} className={`flex flex-col p-3 rounded-[1.25rem] border transition-colors ${item ? 'bg-gradient-to-r from-sky-50 to-teal-50 dark:from-sky-900/10 dark:to-teal-900/10 border-teal-300 dark:border-teal-700/50' : 'bg-slate-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-teal-200 dark:hover:border-teal-800'}`}>
                    <div className="flex items-center justify-between">
                      <button onClick={() => toggleProduto(q)} className="flex items-center gap-3.5 flex-1 text-left">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${item ? 'bg-gradient-to-br from-sky-400 to-teal-400 border-transparent shadow-sm' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>{item && <Check size={14} className="text-white font-black" />}</div>
                        <span className={`text-sm font-medium ${item ? 'text-teal-800 dark:text-teal-300 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>{q}</span>
                      </button>
                      {item && (
                        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-xl p-1.5 border border-teal-100 dark:border-teal-800 shadow-sm">
                          <button onClick={() => updateQtdProduto(q, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center text-teal-700 dark:text-teal-400">{item.qtd}</span>
                          <button onClick={() => updateQtdProduto(q, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/5 to-transparent rounded-bl-full pointer-events-none"></div>
            <p className="font-bold text-sm mb-5 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200"><div className={`p-1.5 rounded-lg ${gradIconBg}`}><ShoppingCart size={16}/></div> Acessórios a Repor</p>
            <div className="space-y-3">
              {listaAcessorios.map(q => {
                const item = produtosFaltando.find(p => p.nome === q);
                return (
                  <div key={q} className={`flex flex-col p-3 rounded-[1.25rem] border transition-colors ${item ? 'bg-gradient-to-r from-sky-50 to-teal-50 dark:from-sky-900/10 dark:to-teal-900/10 border-teal-300 dark:border-teal-700/50' : 'bg-slate-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-teal-200 dark:hover:border-teal-800'}`}>
                    <div className="flex items-center justify-between">
                      <button onClick={() => toggleProduto(q)} className="flex items-center gap-3.5 flex-1 text-left">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${item ? 'bg-gradient-to-br from-sky-400 to-teal-400 border-transparent shadow-sm' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>{item && <Check size={14} className="text-white font-black" />}</div>
                        <span className={`text-sm font-medium ${item ? 'text-teal-800 dark:text-teal-300 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>{q}</span>
                      </button>
                      {item && (
                        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-xl p-1.5 border border-teal-100 dark:border-teal-800 shadow-sm">
                          <button onClick={() => updateQtdProduto(q, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center text-teal-700 dark:text-teal-400">{item.qtd}</span>
                          <button onClick={() => updateQtdProduto(q, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Plus size={14} /></button>
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

  if (tela === 'novo_cliente') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans pb-10 transition-colors duration-300">
        <header className="flex items-center gap-4 mb-10 mt-2"><button onClick={() => setTela('lista')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20}/></button><h2 className={`text-2xl font-black ${gradText}`}>Novo Cliente</h2></header>
        <div className="space-y-6">
          <div className="space-y-2"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Nome Completo</span><input placeholder="Ex: Samuel Silva" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
          
          <div className="space-y-2"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Rua</span><input placeholder="Ex: Rua das Flores" value={novaRua} onChange={e => setNovaRua(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
          
          <div className="flex gap-3">
            <div className="space-y-2 flex-1"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Número</span><input placeholder="Ex: 123" value={novoNumero} onChange={e => setNovoNumero(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
            <div className="space-y-2 flex-[2]"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Bairro</span><input placeholder="Ex: Setor Central" value={novoBairro} onChange={e => setNovoBairro(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
          </div>
          
          <div className="space-y-2">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Hora da Visita</span>
            <input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" />
          </div>
          
          <div className="pt-4">
            <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 ml-2 uppercase tracking-wider">Dias de Limpeza Mensal</p>
            <div className="grid grid-cols-4 gap-2.5">
              {diasDaSemanaNomes.map((d, i) => (
                <button key={i} onClick={() => alternarDiaNovoCliente(i)} className={`py-3.5 rounded-[1rem] text-xs font-bold border transition-all ${novosDias.includes(i) ? gradBtn + " shadow-md" : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-teal-300'}`}>{d.substring(0, 3)}</button>
              ))}
            </div>
          </div>
          
          <button onClick={adicionarCliente} className={`w-full py-5 rounded-[1.25rem] font-bold text-lg mt-8 ${gradBtn}`}>CADASTRAR CLIENTE</button>
        </div>
      </div>
    );
  }

  if (tela === 'editar_cliente') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans pb-10 transition-colors duration-300">
        <header className="flex items-center gap-4 mb-10 mt-2"><button onClick={() => setTela('ver_relatorio')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20}/></button><h2 className={`text-2xl font-black ${gradText}`}>Editar Cadastro</h2></header>
        <div className="space-y-6">
          <div className="space-y-2"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Nome Completo</span><input placeholder="Ex: Samuel Silva" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
          
          <div className="space-y-2"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Rua</span><input placeholder="Ex: Rua das Flores" value={novaRua} onChange={e => setNovoNome(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
          
          <div className="flex gap-3">
            <div className="space-y-2 flex-1"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Número</span><input placeholder="Ex: 123" value={novoNumero} onChange={e => setNovoNumero(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
            <div className="space-y-2 flex-[2]"><span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Bairro</span><input placeholder="Ex: Setor Central" value={novoBairro} onChange={e => setNovoBairro(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" /></div>
          </div>
          
          <div className="space-y-2">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Hora da Visita</span>
            <input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 text-zinc-900 dark:text-white transition-all shadow-sm" />
          </div>
          
          <div className="pt-4">
            <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 ml-2 uppercase tracking-wider">Dias de Limpeza Mensal</p>
            <div className="grid grid-cols-4 gap-2.5">
              {diasDaSemanaNomes.map((d, i) => (
                <button key={i} onClick={() => alternarDiaNovoCliente(i)} className={`py-3.5 rounded-[1rem] text-xs font-bold border transition-all ${novosDias.includes(i) ? gradBtn + " shadow-md" : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-teal-300'}`}>{d.substring(0, 3)}</button>
              ))}
            </div>
          </div>
          
          <button onClick={salvarEdicaoCliente} className={`w-full py-5 rounded-[1.25rem] font-bold text-lg mt-8 ${gradBtn}`}>SALVAR ALTERAÇÕES</button>
        </div>
      </div>
    );
  }

  if (tela === 'relatorio') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans transition-colors duration-300">
        <header className="flex items-center gap-4 mb-8 mt-2"><button onClick={() => setTela('lista')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20}/></button><h2 className={`text-2xl font-black ${gradText}`}>Meus Clientes</h2></header>
        <div className="space-y-3.5">
          {clientes.map(c => (
            <button key={c.id} onClick={() => { setClienteRelatorio(c); setTela('ver_relatorio'); }} className="w-full bg-white dark:bg-zinc-900 p-5 rounded-[1.25rem] border border-zinc-200 dark:border-zinc-800 text-left flex justify-between items-center hover:border-teal-300 dark:hover:border-teal-700 shadow-sm transition-all group">
              <div><p className="font-bold text-lg text-zinc-800 dark:text-zinc-200 mb-1">{c.nome}</p><p className="text-[10px] text-teal-600 dark:text-teal-500 uppercase font-bold tracking-widest">Abrir Pasta Virtual</p></div>
              <div className={`p-3 rounded-xl ${gradIconBg} group-hover:scale-110 transition-transform`}><FileText size={20} /></div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (tela === 'ver_relatorio') {
    const clienteExibicao = clientes.find(c => c.id === clienteRelatorio.id) || clienteRelatorio;
    const produtosDoRelatorio = clienteExibicao.ultimosProdutosFaltando || [];
    const historicoDoRelatorio = clienteExibicao.historicoVisitas || [];
    
    // --- NOVO FILTRO: Adiciona TODAS as fotos de todas as visitas ---
    const fotosDoMes = [];
    historicoDoRelatorio.forEach(v => {
      if (v.fotos && v.fotos.length > 0) {
        v.fotos.forEach(foto => {
          fotosDoMes.push({ src: foto, data: v.d });
        });
      }
    });
      
    const visitasComAlerta = historicoDoRelatorio.filter(v => (v.fotosA && v.fotosA.length > 0) || v.txtA);
    const ultimaVisitaReal = historicoDoRelatorio.length > 0 ? historicoDoRelatorio[historicoDoRelatorio.length - 1] : null;
    const foiVisitadoHoje = clienteExibicao.ultimaVisita === dataHojeStr;

    return (
      <div className={`min-h-screen font-sans relative overflow-x-hidden transition-colors duration-300 ${modoImpressao ? 'bg-white text-black' : 'bg-slate-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 pb-10 max-w-md mx-auto'}`}>
        
        {/* CSS PODEROSO PARA OCULTAR BOTÕES NO MOMENTO DO PDF NATIVO */}
        <style>{`
          @media print {
            @page { margin: 0; size: auto; }
            body, html { background-color: #ffffff !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            .print\\:hidden { display: none !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}</style>

        {/* --- ÁREA DO ALERTA ESCONDIDA (USADA PARA GERAR A FOTO PNG SEM BUG DE COR) --- */}
        <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', zIndex: -50 }}>
          <div id="alerta-print-foto" style={{ width: '400px', padding: '32px', backgroundColor: '#ffffff', fontFamily: 'sans-serif' }}>
            <div style={{ borderLeft: '4px solid #f43f5e', paddingLeft: '20px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '30px', fontWeight: '900', color: '#e11d48', margin: 0, letterSpacing: '-0.05em' }}>🚨 Atenção Técnica</h2>
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#71717a', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{clienteExibicao.nome} • {ultimaVisitaReal?.d}</p>
            </div>
            
            {ultimaVisitaReal?.fotosA?.[0] && (
               <img src={ultimaVisitaReal.fotosA[0]} style={{ width: '100%', height: '288px', objectFit: 'cover', borderRadius: '16px', marginBottom: '24px', border: '2px solid #ffe4e6' }} alt="ProblemaPrincipal" />
            )}
            
            <div style={{ backgroundColor: '#fff1f2', padding: '20px', borderRadius: '16px', border: '1px solid #ffe4e6', marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', color: '#27272a', fontWeight: '500', whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>{ultimaVisitaReal?.txtA || 'Nenhuma descrição técnica adicionada ao relato visual.'}</p>
            </div>

            {ultimaVisitaReal?.fotosA && ultimaVisitaReal.fotosA.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {ultimaVisitaReal.fotosA.slice(1).map((foto, index) => (
                  <img key={index} src={foto} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #ffe4e6' }} alt={`ProblemaExtra ${index + 1}`} />
                ))}
              </div>
            )}

            <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #f4f4f5', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 'bold', margin: 0 }}>Mão Na Água • Relatório Automático</p>
            </div>
          </div>
        </div>

        {/* --- TELA NORMAL (Botões do Topo - Ocultos na Impressão com print:hidden no-print) --- */}
        <div className={`print:hidden no-print ${modoImpressao ? 'hidden' : 'block'}`}>
          <header className="p-4 flex items-center gap-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 shadow-sm transition-colors">
            <button onClick={() => setTela('relatorio')} className="text-zinc-500 dark:text-zinc-400 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ArrowLeft size={20}/></button>
            <h2 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">Dossiê do Cliente</h2>
          </header>
          
          <div className="p-4 mt-2">
            {foiVisitadoHoje && (
              <button onClick={reabrirTarefa} className="w-full mb-6 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-4 rounded-[1.25rem] flex items-center justify-center gap-2.5 shadow-lg shadow-sky-500/20 active:scale-95 transition-all">
                <RotateCcw size={18} /> Editar Limpeza de Hoje
              </button>
            )}

            <div className="flex gap-3 mb-6">
              <button onClick={() => enviarAvisoWhatsApp(clienteExibicao, produtosDoRelatorio)} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-[1rem] flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"><MessageSquare size={18} /> WhatsApp</button>
              <button onClick={compartilharRelatorioVisual} className="flex-1 bg-zinc-800 hover:bg-zinc-900 text-white font-bold py-3.5 rounded-[1rem] flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"><Share2 size={18} /> Salvar PDF Completo</button>
            </div>

            {foiVisitadoHoje && ultimaVisitaReal?.fotosA && ultimaVisitaReal.fotosA.length > 0 && (
              <button onClick={compartilharAlertaSeparado} className="w-full mb-6 bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-[1.25rem] flex items-center justify-center gap-2.5 shadow-lg shadow-rose-500/20 active:scale-95 transition-all">
                <AlertTriangle size={18} /> Baixar Foto do Alerta de Defeito
              </button>
            )}
          </div>
        </div>


        {/* --- ÁREA DE IMPRESSÃO DO RELATÓRIO MENSAL (COMPLETO E NATIVO) --- */}
        <div className={`${modoImpressao === 'relatorio' ? 'px-0 block' : 'px-4'}`}>
          <div id="relatorio-print" className="bg-white w-full shadow-2xl rounded-2xl overflow-hidden border border-zinc-200 text-zinc-900 relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400"></div>
            
            <header className="p-6 pt-8 relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-teal-500 mb-1">Mão Na Água</h1>
                  <p className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">Gestão Profissional</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Relatório Mensal</h2>
                  <div className="bg-gradient-to-r from-sky-50 to-teal-50 border border-teal-100 px-3.5 py-1.5 rounded-lg">
                    <p className="text-sm font-black text-teal-700 uppercase tracking-wider">{mesEscrito} / {anoEscrito}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-zinc-100 shadow-inner">
                 <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1 tracking-wider">Proprietário</p>
                 <p className="text-lg font-black text-zinc-800">{clienteExibicao.nome}</p>
                 <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase"><CheckCircle2 size={12} /> Água Equilibrada (Mês Atual)</div>
              </div>
            </header>

            <div className="p-6 space-y-8">
              <section>
                <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-200 pb-2 mb-3 flex items-center gap-2 uppercase tracking-wide"><div className="p-1 rounded bg-sky-100 text-sky-600"><Droplets size={12}/></div> Histórico de Parâmetros</h3>
                
                <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm w-full">
                  <table className="w-full text-[10px] text-center table-fixed">
                    <thead className="bg-slate-50 text-zinc-500 font-bold uppercase tracking-tighter text-[9px]">
                      <tr>
                        <th className="px-1 py-2 border-b w-[14%]">Data</th>
                        <th className="px-1 py-2 border-b w-[18%]">Aspecto</th>
                        <th className="px-1 py-2 border-b text-teal-600 w-[22%]">Tempo</th>
                        <th className="px-1 py-2 border-b w-[11.5%]">Cl</th>
                        <th className="px-1 py-2 border-b w-[11.5%]">pH</th>
                        <th className="px-1 py-2 border-b w-[11.5%]">Alc</th>
                        <th className="px-1 py-2 border-b w-[11.5%]">Temp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {historicoDoRelatorio.length === 0 ? (
                         <tr><td colSpan="7" className="p-4 text-center text-xs text-zinc-400 italic">Nenhuma manutenção registada este mês.</td></tr>
                      ) : (
                         historicoDoRelatorio.map((v, i) => (
                           <tr key={i} className="hover:bg-slate-50 transition-colors">
                             <td className="px-1 py-2 font-black text-zinc-800 tracking-tight">{v.d}</td>
                             <td className={`px-1 py-2 font-bold text-[9px] uppercase tracking-wider ${v.a === 'Cristalina' ? 'text-emerald-500' : 'text-yellow-500'}`}>{v.a}</td>
                             <td className="px-1 py-2 font-bold text-zinc-500">
                               <div className="flex flex-col items-center justify-center">
                                 <span className="text-[9px] text-zinc-700">{v.h || '--'}</span>
                                 <span className="flex items-center gap-0.5 text-[8px] text-teal-600 mt-0.5"><Clock size={8}/> {v.t || '--'}</span>
                               </div>
                             </td>
                             <td className="px-1 py-2 font-bold text-zinc-700">{v.c}</td>
                             <td className="px-1 py-2 font-bold text-zinc-700">{v.p}</td>
                             <td className="px-1 py-2 font-bold text-zinc-700">{v.al}</td>
                             <td className="px-1 py-2 font-bold text-zinc-700">{v.temp ? v.temp + '°' : '--'}</td>
                           </tr>
                         ))
                      )}
                    </tbody>
                  </table>
                </div>

              </section>

              {visitasComAlerta.length > 0 && (
                <section className="pt-2 border-t border-zinc-100">
                  <h3 className="text-xs font-bold text-rose-600 pb-3 flex items-center gap-2 uppercase tracking-wide"><div className="p-1 rounded bg-rose-100 text-rose-600"><AlertTriangle size={12} /></div> Ocorrências Técnicas</h3>
                  <div className="space-y-3">
                    {visitasComAlerta.map((v, i) => (
                      <div key={i} className="flex gap-3 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50 items-start flex-col">
                        <div className="flex items-start gap-3 w-full">
                          <div className="flex-1">
                            <p className="text-[9px] font-black text-rose-800 mb-1 tracking-wider uppercase">{v.d}</p>
                            <p className="text-[10px] text-zinc-700 leading-relaxed font-medium">{v.txtA || 'Alerta visual gerado sem anotação em texto.'}</p>
                          </div>
                        </div>
                        
                        {v.fotosA && v.fotosA.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-1 w-full">
                            {v.fotosA.map((foto, fIndex) => (
                              <img key={fIndex} src={foto} className="w-16 h-16 object-cover rounded-lg shadow-sm border border-rose-200" alt={`Alerta ${fIndex + 1}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {fotosDoMes.length > 0 && (
                <section className="pt-2 border-t border-zinc-100">
                  <h3 className="text-xs font-bold text-zinc-800 pb-3 flex items-center gap-2 uppercase tracking-wide"><div className="p-1 rounded bg-teal-100 text-teal-600"><Camera size={12}/></div> Resumo Fotográfico (Visitas)</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {fotosDoMes.map((foto, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden relative border border-zinc-200 bg-zinc-100 shadow-sm">
                        <img src={foto.src} className="w-full h-full object-cover" alt="Piscina" />
                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent pt-4 pb-1 px-1 text-white text-[8px] font-bold text-center tracking-widest uppercase">{foto.data}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
            
            <footer className="bg-zinc-900 text-white p-6 text-center mt-2 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-teal-500"></div>
               <p className="text-sm font-bold mb-1.5 text-zinc-100">Obrigado pela confiança!</p>
               <p className="text-[9px] text-zinc-500 mb-5 font-medium">Documento auditado pelo sistema Mão Na Água.</p>
               
               <div className="bg-zinc-800/50 p-2 rounded-lg mb-4 inline-block">
                 <p className="text-[8px] text-zinc-400 font-medium">Para visualizar a galeria fotográfica completa em alta resolução, solicite acesso à sua pasta virtual.</p>
               </div>

               <div className="flex justify-center gap-5 text-[9px] text-zinc-400 font-bold uppercase tracking-widest border-t border-zinc-800 pt-4">
                  <span className="flex items-center gap-1.5"><Phone size={11} className="text-sky-400"/> Atendimento Premium</span>
               </div>
            </footer>
          </div>
        </div>

        {/* --- TELA NORMAL (Ações Rápidas da Agenda - Ocultas na Impressão com print:hidden no-print) --- */}
        <div className={`print:hidden no-print px-4 ${modoImpressao ? 'hidden' : 'block'}`}>
          <div className="mt-8 bg-white dark:bg-zinc-900 rounded-[1.5rem] p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
             <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
               <CalendarDays size={16} className="text-teal-500" /> Ações Rápidas da Agenda
             </h3>
             <div className="flex flex-col gap-3">
               <button onClick={() => iniciarVisita(clienteExibicao)} className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all ${gradBtn}`}>
                 <Plus size={18} /> Iniciar Visita Extra Agora
               </button>

               {mostrarAdiarId === clienteExibicao.id ? (
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2">
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 uppercase tracking-wider">Mover próxima visita para:</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {diasDaSemanaNomes.map((dia, index) => (
                        <button key={index} onClick={() => { adiarVisita(clienteExibicao.id, index); alert(`Visita remarcada para ${dia}!`); }} className="text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl whitespace-nowrap text-zinc-700 dark:text-zinc-300 hover:border-teal-400 transition-colors">{dia}</button>
                      ))}
                    </div>
                    <button onClick={() => setMostrarAdiarId(null)} className="w-full mt-2 text-xs text-rose-500 font-bold p-2 text-center hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">Cancelar</button>
                  </div>
               ) : (
                  <button onClick={() => setMostrarAdiarId(clienteExibicao.id)} className="w-full bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 active:scale-95 transition-all">
                    <CalendarDays size={18} /> Antecipar / Remarcar Visita
                  </button>
               )}
             </div>
          </div>
          
          <div className="flex flex-col gap-3 mt-6">
            <button onClick={() => abrirEdicaoCliente(clienteExibicao)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-teal-600 dark:text-teal-400 font-bold py-4 rounded-[1.25rem] flex items-center justify-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors shadow-sm">
              <Pencil size={18} /> Editar Cadastro do Cliente
            </button>
            <button onClick={() => excluirCliente(clienteExibicao.id)} className="w-full bg-transparent border-2 border-rose-200 dark:border-rose-900/50 text-rose-500 dark:text-rose-400 font-bold py-4 rounded-[1.25rem] flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
              <Trash2 size={18} /> Encerrar Contrato (Excluir)
            </button>
          </div>
        </div>

      </div>
    );
  }

  return null;
}