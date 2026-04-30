import React, { useState, useEffect } from 'react';
import { 
  Camera, Droplets, ShoppingCart, ArrowLeft, Check, MapPin, Save, FileText, Plus, 
  AlertTriangle, CalendarDays, CheckCircle2, Phone, MessageSquare, Minus, Share2, Clock, RotateCcw,
  Sun, Moon, LogIn, LogOut
} from 'lucide-react';
import html2canvas from 'html2canvas';

// --- CONFIGURAÇÕES DE PRODUTOS ---
const listaQuimica = [
  'Cloro Granulado 10kg', 'Cloro Granulado 1kg', 'Cloro em Pastilha', 'Algicida de Manutenção', 
  'Algicida de Choque', 'Algicida sem cobre', 'Clarificante / Decantador', 'Clarificante em Gel', 
  'Sulfato de Alumínio 2kg', 'Barrilha Leve 2kg', 'Elevador de Alcalinidade 2kg', 
  'Redutor de pH e Alcalinidade', 'Limpa Bordas', 'Sal para Gerador'
];

const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// --- CORES CORRIGIDAS (AZUL PROFISSIONAL) ---
const gradBtn = "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-none shadow-md";
const gradText = "bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent";

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(false);
  const [modoEscuro, setModoEscuro] = useState(true);
  const [tela, setTela] = useState('lista'); 
  const [clienteRelatorio, setClienteRelatorio] = useState(null);
  const diaAtual = new Date().getDay(); 
  const dataHojeStr = new Date().toDateString();

  // --- PERSISTÊNCIA DE DADOS ---
  const [clientes, setClientes] = useState(() => {
    const salvo = localStorage.getItem('maonagua_v6');
    return salvo ? JSON.parse(salvo) : [
      { id: 1, nome: 'Dona Maria', endereco: 'Centro', diasVisita: [1, 4], adiadoPara: null, ultimaVisita: null, ultimosProdutosFaltando: [], historicoVisitas: [] },
      { id: 2, nome: 'Condomínio Solar', endereco: 'Bairro das Acácias', diasVisita: [diaAtual], adiadoPara: null, ultimaVisita: null, ultimosProdutosFaltando: [], historicoVisitas: [] }
    ];
  });

  useEffect(() => {
    localStorage.setItem('maonagua_v6', JSON.stringify(clientes));
  }, [clientes]);

  // --- ESTADOS DE CONTROLE ---
  const [clienteAtual, setClienteAtual] = useState(null);
  const [aspecto, setAspecto] = useState(''); 
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
  const [fotosContagem, setFotosContagem] = useState(0);
  const [fotosVisita, setFotosVisita] = useState([]);
  const [horaInicioVisita, setHoraInicioVisita] = useState(null);
  const [fotoAlerta, setFotoAlerta] = useState(null);
  const [textoAlerta, setTextoAlerta] = useState('');
  const [produtosFaltando, setProdutosFaltando] = useState([]);
  const [mostrarAdiarId, setMostrarAdiarId] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novosDias, setNovosDias] = useState([]);

  const piscinasDeHoje = clientes.filter(c => c.ultimaVisita !== dataHojeStr && (c.diasVisita.includes(diaAtual) || c.adiadoPara === diaAtual));

  const bgPrincipal = modoEscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-800';
  const bgCard = modoEscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200';
  const bgInput = modoEscuro ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-gray-300 text-zinc-800';

  // --- FUNÇÕES DE TEMPO E FINALIZAÇÃO ---

  const iniciarVisita = (cliente) => {
    setClienteAtual(cliente);
    setHoraInicioVisita(Date.now()); 
    setTela('visita');
  };

  const salvarVisita = () => {
    if (fotosContagem < 3 || !ph || !cloro || !alcalinidade || !aspecto) {
      alert("⚠️ Preencha todos os campos e tire ao menos 3 fotos.");
      return;
    }
    
    // CÁLCULO DE TEMPO ACUMULADO
    const tempoMsSessao = Date.now() - (horaInicioVisita || Date.now());
    const tempoMsTotal = tempoMsSessao; 
    
    const tempoMinutos = Math.max(1, Math.round(tempoMsTotal / 60000)); 
    const tempoFormatado = tempoMinutos >= 60 ? `${Math.floor(tempoMinutos/60)}h ${tempoMinutos%60}m` : `${tempoMinutos}m`;
    
    const dateObj = new Date();
    const diaFormatado = String(dateObj.getDate()).padStart(2, '0');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const novaVisita = {
      d: `${diaFormatado}/${meses[dateObj.getMonth()]}`,
      a: aspecto, c: cloro, p: ph, al: alcalinidade, 
      t: tempoFormatado,
      tMs: tempoMsTotal,
      fotos: fotosVisita, fotoA: fotoAlerta, txtA: textoAlerta
    };
    
    setClientes(clientes.map(c => {
      if (c.id === clienteAtual.id) {
        return { 
          ...c, ultimaVisita: dataHojeStr, adiadoPara: null,
          ultimosProdutosFaltando: [...produtosFaltando],
          historicoVisitas: [...(c.historicoVisitas || []), novaVisita]
        };
      }
      return c;
    }));

    setTela('lista');
    resetarFormulario();
  };

  const reabrirTarefa = () => {
    const clienteParaEditar = clientes.find(c => c.id === clienteRelatorio.id);
    const historico = clienteParaEditar.historicoVisitas || [];
    if (historico.length === 0) return;
    
    const ultimaVisitaReal = historico[historico.length - 1];
    
    setAspecto(ultimaVisitaReal.a);
    setPh(ultimaVisitaReal.p);
    setCloro(ultimaVisitaReal.c);
    setAlcalinidade(ultimaVisitaReal.al);
    setFotosVisita(ultimaVisitaReal.fotos || []);
    setFotosContagem(ultimaVisitaReal.fotos ? ultimaVisitaReal.fotos.length : 0);
    setFotoAlerta(ultimaVisitaReal.fotoA || null);
    setTextoAlerta(ultimaVisitaReal.txtA || '');
    setProdutosFaltando(clienteParaEditar.ultimosProdutosFaltando || []);
    
    // SOMA DO TEMPO: O cronômetro recomeça considerando o tempo já gasto
    setHoraInicioVisita(Date.now() - (ultimaVisitaReal.tMs || 0)); 
    
    const novoHistorico = historico.slice(0, -1);
    setClientes(clientes.map(c => c.id === clienteParaEditar.id ? { ...c, ultimaVisita: null, historicoVisitas: novoHistorico, ultimosProdutosFaltando: [] } : c));
    setClienteAtual(clienteParaEditar);
    setTela('visita');
  };

  const resetarFormulario = () => {
    setAspecto(''); setPh(''); setCloro(''); setAlcalinidade('');
    setFotosContagem(0); setFotosVisita([]); setHoraInicioVisita(null); 
    setFotoAlerta(null); setTextoAlerta(''); setProdutosFaltando([]); setClienteAtual(null);
  };

  // --- OUTRAS UTILIDADES ---

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

  const handleNovaFoto = (e) => processarFotoComprimida(e, (b) => { setFotosVisita(p => [...p, b]); setFotosContagem(p => p+1); });
  const handleFotoAlerta = (e) => processarFotoComprimida(e, (b) => setFotoAlerta(b));

  const enviarAvisoWhatsApp = (cliente, produtos = []) => {
    let msg = `Olá, ${cliente.nome}! 🌊\nManutenção concluída.\n\n`;
    if (produtos.length > 0) {
       msg += `⚠️ *Produtos Faltando:*\n`;
       produtos.forEach(p => msg += `- ${p.qtd}x ${p.nome}\n`);
    }
    msg += `\nQualquer dúvida estou à disposição!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- COMPONENTES DE TELA ---

  if (!usuarioLogado) return (
    <div className={`min-h-screen ${bgPrincipal} flex items-center justify-center p-6`}>
      <div className={`${bgCard} p-8 rounded-3xl border w-full max-w-sm shadow-xl`}>
        <h1 className={`text-3xl font-black text-center mb-6 ${gradText}`}>Mão Na Água</h1>
        <div className="space-y-4 mb-8">
          <input type="email" placeholder="E-mail" className={`w-full p-4 rounded-xl border ${bgInput}`} />
          <input type="password" placeholder="Senha" className={`w-full p-4 rounded-xl border ${bgInput}`} />
        </div>
        <button onClick={() => setUsuarioLogado(true)} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 ${gradBtn}`}><LogIn size={20}/> Entrar</button>
      </div>
    </div>
  );

  if (tela === 'lista') return (
    <div className={`min-h-screen ${bgPrincipal} p-4 pb-24 font-sans`}>
      <header className="flex justify-between items-start mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div><h1 className={`text-4xl font-black ${gradText}`}>Mão Na Água</h1><p className="opacity-50 text-sm">Hoje é {diasDaSemanaNomes[diaAtual]}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setModoEscuro(!modoEscuro)} className={`p-2 rounded-xl border ${bgCard}`}>{modoEscuro ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-blue-600"/>}</button>
          <button onClick={() => setTela('agenda')} className={`p-2 rounded-xl border ${bgCard} text-blue-500`}><CalendarDays size={20}/></button>
          <button onClick={() => setUsuarioLogado(false)} className={`p-2 rounded-xl border ${bgCard} text-red-500`}><LogOut size={20}/></button>
        </div>
      </header>

      <h2 className="font-bold text-xl mb-4">Piscina Hoje</h2>
      <div className="space-y-4">
        {piscinasDeHoje.length === 0 ? <p className="text-center opacity-40 py-10">Tudo limpo!</p> : piscinasDeHoje.map(c => (
          <div key={c.id} className={`${bgCard} p-5 rounded-3xl border shadow-sm`}>
            <h3 className="font-bold text-lg">{c.nome}</h3>
            <p className="text-xs opacity-60 mb-4 flex items-center gap-1"><MapPin size={12}/> {c.endereco}</p>
            <button onClick={() => iniciarVisita(c)} className={`w-full py-3 rounded-2xl font-bold text-sm ${gradBtn}`}>Iniciar Limpeza</button>
          </div>
        ))}
      </div>

      <button onClick={() => setTela('relatorio')} className={`fixed bottom-6 left-6 ${modoEscuro ? 'bg-zinc-800' : 'bg-gray-100'} p-4 rounded-full border border-zinc-700 flex items-center gap-2 shadow-xl z-50`}><FileText size={20} className="text-blue-500" /> <span className="font-bold text-xs uppercase">Relatórios</span></button>
      <button onClick={() => setTela('novo_cliente')} className={`fixed bottom-6 right-6 p-5 rounded-full shadow-2xl z-50 ${gradBtn}`}><Plus size={28}/></button>
    </div>
  );

  if (tela === 'visita') return (
    <div className={`min-h-screen ${bgPrincipal} p-5 pb-32 font-sans`}>
      <header className="flex items-center gap-4 mb-6"><button onClick={() => setTela('lista')}><ArrowLeft/></button><h2 className={`text-xl font-bold ${gradText}`}>{clienteAtual.nome}</h2></header>
      <div className="space-y-6">
        <section><label className="text-xs font-bold opacity-50 uppercase mb-2 block">Aspecto da Água</label><div className="grid grid-cols-3 gap-2">{['Cristalina', 'Turva', 'Verde'].map(opt => (<button key={opt} onClick={() => setAspecto(opt)} className={`py-3 rounded-xl text-xs font-bold border ${aspecto === opt ? gradBtn : bgCard}`}>{opt}</button>))}</div></section>
        <section className={`${bgCard} p-4 rounded-2xl border`}><div className="flex justify-between items-center mb-4"><span className="text-sm font-bold">Fotos Principais</span><span className="text-xs">{fotosContagem}/3</span></div><label className={`w-full h-24 border-2 border-dashed ${bgPrincipal} rounded-xl flex flex-col items-center justify-center gap-2 text-blue-500`}><Camera size={24}/><span className="text-[10px] font-bold">Tirar Foto</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNovaFoto}/></label></section>
        <section className="space-y-3"><span className="text-xs font-bold opacity-50 uppercase">Parâmetros</span><div className="grid grid-cols-3 gap-2">{['pH', 'Cloro', 'Alc'].map((l, i) => (<div key={l} className="flex flex-col gap-1 text-center"><span className="text-[10px] opacity-60 font-bold">{l}</span><input type="number" step="0.1" value={i===0?ph:i===1?cloro:alcalinidade} onChange={e=>i===0?setPh(e.target.value):i===1?setCloro(e.target.value):setAlcalinidade(e.target.value)} className={`p-3 rounded-xl border text-center font-bold text-blue-500 ${bgInput}`} /></div>))}</div></section>
        <button onClick={salvarVisita} className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg ${gradBtn}`}>Finalizar Limpeza</button>
      </div>
    </div>
  );

  if (tela === 'relatorio') return (
    <div className={`min-h-screen ${bgPrincipal} p-4 font-sans`}>
      <header className="flex items-center gap-4 mb-6"><button onClick={() => setTela('lista')}><ArrowLeft/></button><h2 className={`text-xl font-bold ${gradText}`}>Clientes</h2></header>
      <div className="space-y-3">{clientes.map(c => (<button key={c.id} onClick={() => { setClienteRelatorio(c); setTela('ver_relatorio'); }} className={`${bgCard} w-full p-5 rounded-2xl border flex justify-between items-center shadow-sm`}><div><p className="font-bold">{c.nome}</p></div><FileText size={20} className="text-blue-500"/></button>))}</div>
    </div>
  );

  if (tela === 'ver_relatorio') {
    const c = clientes.find(x => x.id === clienteRelatorio.id);
    const historico = c.historicoVisitas || [];
    const visitadoHoje = c.ultimaVisita === dataHojeStr;
    return (
      <div className={`min-h-screen bg-gray-100 text-zinc-900 p-4 font-sans`}>
        <header className="flex items-center gap-4 mb-4"><button onClick={() => setTela('relatorio')}><ArrowLeft/></button><h2 className="font-bold">Relatório</h2></header>
        {visitadoHoje && <button onClick={reabrirTarefa} className="w-full mb-6 bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"><RotateCcw size={18} /> Reabrir Visita de Hoje</button>}
        <div className="flex gap-2 mb-6"><button onClick={() => enviarAvisoWhatsApp(c, c.ultimosProdutosFaltando)} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"><MessageSquare size={18} /> WhatsApp</button></div>
        <div id="relatorio-print" className="bg-white p-6 shadow-lg rounded-sm border border-zinc-200">
           <div className="border-b-4 border-blue-500 pb-2 mb-4"><h1 className="text-2xl font-black text-blue-600 uppercase tracking-tighter">Mão Na Água</h1></div>
           <div className="bg-gray-50 p-3 rounded mb-6"><p className="text-[10px] opacity-50 uppercase font-bold">Cliente</p><p className="font-bold">{c.nome}</p></div>
           <table className="w-full text-[9px] text-left border-collapse">
             <thead className="bg-gray-100 font-bold uppercase"><tr><th className="p-1.5 border-b">Data</th><th className="p-1.5 border-b text-center text-blue-600">Tempo</th><th className="p-1.5 border-b text-center">Cloro</th><th className="p-1.5 border-b text-center">pH</th><th className="p-1.5 border-b text-center">Alc</th></tr></thead>
             <tbody>{historico.length === 0 ? <tr><td colSpan={5} className="p-4 text-center opacity-30">Vazio</td></tr> : historico.map((v, i) => (<tr key={i} className="border-b border-gray-100"><td className="p-1.5 font-bold">{v.d}</td><td className="p-1.5 text-center font-bold text-gray-500">{v.t}</td><td className="p-1.5 text-center">{v.c}</td><td className="p-1.5 text-center">{v.p}</td><td className="p-1.5 text-center">{v.al}</td></tr>))}</tbody>
           </table>
        </div>
      </div>
    );
  }

  return null;
}