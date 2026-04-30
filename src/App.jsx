import React, { useState, useEffect } from 'react';
import { 
  Camera, Droplets, ShoppingCart, ArrowLeft, Check, MapPin, Save, FileText, Plus, 
  AlertTriangle, CalendarDays, CheckCircle2, Phone, MessageSquare, Minus, Share2, Clock, RotateCcw,
  Sun, Moon, LogIn, LogOut
} from 'lucide-react';
import html2canvas from 'html2canvas';

// --- CONFIGURAÇÕES ---
const listaQuimica = [
  'Cloro Granulado 10kg', 'Cloro Granulado 1kg', 'Cloro em Pastilha', 'Algicida de Manutenção', 
  'Algicida de Choque', 'Algicida sem cobre', 'Clarificante / Decantador', 'Clarificante em Gel', 
  'Sulfato de Alumínio 2kg', 'Barrilha Leve 2kg', 'Elevador de Alcalinidade 2kg', 
  'Redutor de pH e Alcalinidade', 'Limpa Bordas', 'Sal para Gerador'
];
const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const gradBtn = "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white border-none";
const gradText = "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent";

export default function App() {
  // --- ESTADOS DE LOGIN E TEMA ---
  const [usuarioLogado, setUsuarioLogado] = useState(false); // Troque para usar o seu Firebase
  const [modoEscuro, setModoEscuro] = useState(true);
  
  // --- ESTADOS DO APP ---
  const [tela, setTela] = useState('lista'); 
  const [clienteRelatorio, setClienteRelatorio] = useState(null);
  const diaAtual = new Date().getDay(); 
  const dataHojeStr = new Date().toDateString();

  const [clientes, setClientes] = useState(() => {
    const salvo = localStorage.getItem('maonagua_v5');
    return salvo ? JSON.parse(salvo) : [
      { id: 1, nome: 'Dona Maria', endereco: 'Centro', diasVisita: [1, 4], adiadoPara: null, ultimaVisita: null, ultimosProdutosFaltando: [], historicoVisitas: [] },
      { id: 2, nome: 'Condomínio Solar', endereco: 'Bairro das Acácias', diasVisita: [diaAtual], adiadoPara: null, ultimaVisita: null, ultimosProdutosFaltando: [], historicoVisitas: [] }
    ];
  });

  useEffect(() => {
    localStorage.setItem('maonagua_v5', JSON.stringify(clientes));
  }, [clientes]);

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

  // --- CLASSES DO TEMA ---
  const bgPrincipal = modoEscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-gray-100 text-zinc-800';
  const bgCard = modoEscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200';
  const bgInput = modoEscuro ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-zinc-800';

  // --- FUNÇÕES ---

  const realizarLogin = () => {
    // AQUI VOCÊ CONECTA SEU FIREBASE!
    setUsuarioLogado(true);
  };

  const iniciarVisita = (cliente) => {
    setClienteAtual(cliente);
    setHoraInicioVisita(Date.now()); 
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

  const handleFotoAlerta = (e) => processarFotoComprimida(e, (base64) => {
    setFotoAlerta(base64);
  });

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
    setClientes(clientes.map(c => c.id === clienteId ? { ...c, adiadoPara: novoDiaIndex } : c));
    setMostrarAdiarId(null);
  };

  const adicionarCliente = () => {
    if (novoNome && novoEndereco && novosDias.length > 0) {
      setClientes([...clientes, { 
        id: Date.now(), nome: novoNome, endereco: novoEndereco, diasVisita: novosDias,
        adiadoPara: null, ultimaVisita: null, ultimosProdutosFaltando: [], historicoVisitas: [] 
      }]);
      setNovoNome(''); setNovoEndereco(''); setNovosDias([]); setTela('lista');
    } else {
      alert("Preencha nome, endereço e selecione pelo menos um dia da semana.");
    }
  };

  const alternarDiaNovoCliente = (diaIndex) => {
    setNovosDias(novosDias.includes(diaIndex) ? novosDias.filter(d => d !== diaIndex) : [...novosDias, diaIndex]);
  };

  const salvarVisita = () => {
    if (fotosContagem < 3 || !ph || !cloro || !alcalinidade || !aspecto) {
      alert("⚠️ ATENÇÃO:\n\nPara finalizar, você precisa de:\n- No mínimo 3 fotos\n- Preencher pH, Cloro e Alc\n- Selecionar o aspecto da água.");
      return;
    }
    
    // CORREÇÃO DO TEMPO: Cálculo do tempo total
    const tempoMsTotal = Date.now() - (horaInicioVisita || Date.now());
    const tempoMinutos = Math.max(1, Math.round(tempoMsTotal / 60000)); 
    const tempoFormatado = tempoMinutos >= 60 ? `${Math.floor(tempoMinutos/60)}h ${tempoMinutos%60}m` : `${tempoMinutos}m`;
    
    const dateObj = new Date();
    const diaFormatado = String(dateObj.getDate()).padStart(2, '0');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const novaVisita = {
      d: `${diaFormatado}/${meses[dateObj.getMonth()]}`,
      a: aspecto, c: cloro, p: ph, al: alcalinidade, 
      t: tempoFormatado,
      tMs: tempoMsTotal, // Guardamos os milissegundos reais para a conta do "Reabrir"
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

    alert(`✅ VISITA FINALIZADA!\n\nTempo de serviço: ${tempoFormatado}`);
    setTela('lista');
    resetarFormulario();
  };

  const reabrirTarefa = () => {
    const clienteParaEditar = clientes.find(c => c.id === clienteRelatorio.id);
    const historico = clienteParaEditar.historicoVisitas || [];
    if (historico.length === 0) return;
    
    const ultimaVisitaReal = historico[historico.length - 1];
    
    setAspecto(ultimaVisitaReal.a || '');
    setPh(ultimaVisitaReal.p || '');
    setCloro(ultimaVisitaReal.c || '');
    setAlcalinidade(ultimaVisitaReal.al || '');
    setFotosVisita(ultimaVisitaReal.fotos || []);
    setFotosContagem(ultimaVisitaReal.fotos ? ultimaVisitaReal.fotos.length : 0);
    setFotoAlerta(ultimaVisitaReal.fotoA || null);
    setTextoAlerta(ultimaVisitaReal.txtA || '');
    setProdutosFaltando(clienteParaEditar.ultimosProdutosFaltando || []);
    
    // CORREÇÃO DO TEMPO NA REABERTURA: Ajusta a hora para não perder o tempo antigo
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

  const enviarAvisoWhatsApp = (cliente, historicoProdutos = []) => {
    let mensagem = `Olá, ${cliente.nome}! 🌊\nPassando para avisar que a manutenção da sua piscina foi concluída com sucesso.\n\n`;
    if (historicoProdutos.length > 0) {
       mensagem += `⚠️ *Produtos Faltando:*\n`;
       historicoProdutos.forEach(p => {
         mensagem += `- ${p.qtd}x ${p.nome}\n`;
       });
       mensagem += `\n`;
    }
    mensagem += `Qualquer dúvida, estou à disposição!\n*Mão Na Água - Gestão Profissional*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const compartilharRelatorioVisual = async () => {
    const elemento = document.getElementById('relatorio-print');
    if (!elemento) return;
    try {
      const canvas = await html2canvas(elemento, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Relatorio_${clienteRelatorio.nome}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Relatório Mão Na Água', files: [file] });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = file.name; a.click();
          URL.revokeObjectURL(url);
          alert("Imagem salva!");
        }
      }, 'image/png');
    } catch (error) { alert("Erro ao gerar imagem."); }
  };

  const compartilharAlertaSeparado = async (visita) => {
    const elemento = document.getElementById('alerta-print');
    if (!elemento) return;
    try {
      const canvas = await html2canvas(elemento, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Alerta_${clienteRelatorio.nome}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Atenção Técnica' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = file.name; a.click();
          URL.revokeObjectURL(url);
          alert("Imagem salva no dispositivo.");
        }
      }, 'image/png');
    } catch(e) { alert('Erro ao processar imagem.'); }
  };

  // --- RENDERIZAÇÃO: TELA DE LOGIN ---
  if (!usuarioLogado) {
    return (
      <div className={`min-h-screen ${bgPrincipal} p-6 flex flex-col items-center justify-center font-sans`}>
        <div className={`w-full max-w-sm ${bgCard} p-8 rounded-3xl border shadow-2xl`}>
          <div className="text-center mb-8">
            <h1 className={`text-4xl font-black mb-2 ${gradText}`}>Mão Na Água</h1>
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Gestão Profissional</p>
          </div>
          <div className="space-y-4 mb-8">
            <input type="email" placeholder="Seu e-mail" className={`w-full p-4 rounded-xl outline-none ${bgInput}`} />
            <input type="password" placeholder="Sua senha" className={`w-full p-4 rounded-xl outline-none ${bgInput}`} />
          </div>
          <button onClick={realizarLogin} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 ${gradBtn}`}>
            <LogIn size={20} /> Entrar no Sistema
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO: TELAS DO APLICATIVO ---

  if (tela === 'lista') return (
    <div className={`min-h-screen ${bgPrincipal} p-4 max-w-md mx-auto pb-24 font-sans transition-colors duration-300`}>
      <header className={`flex justify-between items-start mb-6 border-b ${modoEscuro ? 'border-zinc-800' : 'border-gray-200'} pb-4`}>
        <div>
          <h1 className={`text-4xl font-black ${gradText}`}>Mão Na Água</h1>
          <p className={`${modoEscuro ? 'text-zinc-500' : 'text-gray-500'} text-sm`}>Hoje é {diasDaSemanaNomes[diaAtual]}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModoEscuro(!modoEscuro)} className={`p-2 rounded-xl border ${bgCard}`}>
            {modoEscuro ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-purple-600" />}
          </button>
          <button onClick={() => setTela('agenda')} className={`p-2 rounded-xl border ${bgCard} text-pink-500`}><CalendarDays size={20} /></button>
        </div>
      </header>

      <h2 className={`font-bold text-xl mb-4 ${gradText}`}>Limpar Hoje</h2>
      <div className="space-y-4">
        {piscinasDeHoje.length === 0 ? (
          <div className={`text-center ${bgCard} p-8 rounded-3xl mt-10 shadow-lg`}><Check size={48} className="mx-auto text-pink-500 mb-3" /><p className="font-bold text-lg">Tudo limpo por hoje!</p></div>
        ) : piscinasDeHoje.map(c => (
          <div key={c.id} className={`${bgCard} p-5 rounded-3xl shadow-lg`}>
            <h3 className="font-bold text-lg">{c.nome}</h3>
            <p className={`text-xs ${modoEscuro ? 'text-zinc-400' : 'text-gray-500'} mb-4 flex items-center gap-1`}><MapPin size={12} className="text-pink-500"/> {c.endereco}</p>
            <div className="flex gap-2">
              <button onClick={() => iniciarVisita(c)} className={`flex-1 py-3 rounded-2xl font-bold text-sm ${gradBtn}`}>Iniciar Limpeza</button>
              <button onClick={() => setMostrarAdiarId(c.id)} className={`px-4 py-3 rounded-2xl text-xs font-bold ${modoEscuro ? 'bg-zinc-950 border border-zinc-800 text-zinc-500' : 'bg-gray-100 border border-gray-300 text-gray-600'}`}>Adiar</button>
            </div>
            {mostrarAdiarId === c.id && (
              <div className={`mt-4 ${modoEscuro ? 'bg-zinc-950' : 'bg-gray-50'} p-4 rounded-2xl border ${bgCard}`}>
                <p className={`text-xs font-bold ${modoEscuro ? 'text-zinc-400' : 'text-gray-500'} mb-3`}>Adiar para qual dia?</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {diasDaSemanaNomes.map((dia, index) => index !== diaAtual && (
                    <button key={index} onClick={() => adiarVisita(c.id, index)} className={`text-xs ${modoEscuro ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300'} border px-4 py-2.5 rounded-xl whitespace-nowrap`}>{dia}</button>
                  ))}
                </div>
                <button onClick={() => setMostrarAdiarId(null)} className="w-full mt-2 text-xs text-rose-500 font-bold p-2 text-center">Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setTela('relatorio')} className={`fixed bottom-6 left-6 ${modoEscuro ? 'bg-zinc-900 text-zinc-100 border-zinc-800' : 'bg-white text-zinc-800 border-gray-200'} px-5 py-4 rounded-full border flex items-center gap-2 z-50 shadow-2xl`}><FileText size={20} className="text-pink-500" /> <span className="font-bold text-xs uppercase">Relatórios</span></button>
      <button onClick={() => setTela('novo_cliente')} className={`fixed bottom-6 right-6 p-4 rounded-full z-50 shadow-2xl ${gradBtn}`}><Plus size={28} /></button>
    </div>
  );

  if (tela === 'agenda') return (
    <div className={`min-h-screen ${bgPrincipal} p-4 max-w-md mx-auto font-sans pb-20`}>
      <header className="flex items-center gap-4 mb-6 pt-2"><button onClick={() => setTela('lista')} className="p-2 text-pink-500"><ArrowLeft /></button><h2 className={`text-2xl font-bold ${gradText}`}>Agenda da Semana</h2></header>
      <div className="space-y-6">
        {diasDaSemanaNomes.map((nomeDia, index) => {
          const clientesDoDia = clientes.filter(c => (c.diasVisita && c.diasVisita.includes(index)) || c.adiadoPara === index);
          return (
            <div key={index} className={`${bgCard} rounded-3xl overflow-hidden border ${index === diaAtual ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' : ''}`}>
              <div className={`px-5 py-3 font-bold text-sm ${index === diaAtual ? gradBtn : (modoEscuro ? 'bg-zinc-950 text-zinc-400' : 'bg-gray-50 text-gray-500')}`}>{nomeDia} {index === diaAtual && '(Hoje)'}</div>
              <div className="p-5 space-y-3">
                {clientesDoDia.length === 0 ? <p className="text-xs italic opacity-50">Nenhuma limpeza agendada.</p> : clientesDoDia.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm"><span className="font-medium">{c.nome}</span>{c.adiadoPara === index && <span className="text-[10px] text-pink-500 bg-pink-500/10 px-2.5 py-1 rounded-md font-bold">Adiado</span>}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  if (tela === 'visita') return (
    <div className={`min-h-screen ${bgPrincipal} max-w-md mx-auto pb-32 font-sans`}>
      <header className={`${bgCard} p-4 border-b flex items-center gap-4 sticky top-0 z-20`}><button onClick={() => setTela('lista')} className="p-2 opacity-70"><ArrowLeft /></button><h2 className={`font-bold text-xl ${gradText}`}>{clienteAtual.nome}</h2></header>
      <div className="p-5 space-y-8">
        <section><label className="block text-sm font-bold opacity-60 mb-3 uppercase">Aspecto da Água:</label><div className="grid grid-cols-3 gap-3">{['Cristalina', 'Turva', 'Verde'].map(opt => (<button key={opt} onClick={() => setAspecto(opt)} className={`py-4 rounded-2xl font-bold text-xs border ${aspecto === opt ? gradBtn : (modoEscuro ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-gray-200 text-gray-600')}`}>{opt}</button>))}</div></section>
        <section className={`${bgCard} p-5 rounded-3xl`}><div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><Camera size={18} className="text-yellow-500"/> Fotos Principais</h3><span className={`text-xs font-bold ${fotosContagem >= 3 ? 'text-emerald-500' : 'text-rose-500'}`}>{fotosContagem}/3</span></div><label className={`w-full ${bgInput} border-2 border-dashed py-8 rounded-2xl flex flex-col items-center gap-3 text-pink-500 cursor-pointer`}><Camera size={32} /> <span className="text-sm font-bold">Adicionar Foto</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNovaFoto} /></label></section>
        <section className={`${bgCard} p-5 rounded-3xl relative overflow-hidden`}><div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-rose-500 to-orange-500"></div><h3 className="font-bold flex items-center gap-2 mb-2 ml-3"><AlertTriangle size={18} className="text-rose-500"/> Relatar Problema</h3><label className={`ml-3 w-[calc(100%-12px)] flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm cursor-pointer border ${fotoAlerta ? 'bg-rose-500/20 border-rose-500 text-rose-500' : bgInput}`}><Camera size={20} />{fotoAlerta ? 'Foto Anexada!' : 'Foto do Problema'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoAlerta} /></label>{fotoAlerta && (<div className="ml-3 mr-3 mt-3 space-y-3"><img src={fotoAlerta} className="w-full h-40 object-cover rounded-xl border opacity-90" /><textarea placeholder="Descreva o problema aqui..." value={textoAlerta} onChange={e => setTextoAlerta(e.target.value)} className={`w-full p-3 rounded-xl text-sm outline-none focus:border-rose-500 min-h-[80px] border ${bgInput}`}/></div>)}</section>
        <section className="space-y-4"><p className="text-xs font-bold opacity-60 uppercase">Parâmetros da Água</p><div className="grid grid-cols-3 gap-2"><div className="flex flex-col gap-1"><span className="text-[10px] opacity-60 text-center font-bold">pH</span><input type="number" step="0.1" value={ph} onChange={e => setPh(e.target.value)} className={`p-4 rounded-xl text-center focus:border-pink-500 outline-none text-pink-500 font-bold border ${bgInput}`} /></div><div className="flex flex-col gap-1"><span className="text-[10px] opacity-60 text-center font-bold">CLORO</span><input type="number" step="0.1" value={cloro} onChange={e => setCloro(e.target.value)} className={`p-4 rounded-xl text-center focus:border-pink-500 outline-none text-pink-500 font-bold border ${bgInput}`} /></div><div className="flex flex-col gap-1"><span className="text-[10px] opacity-60 text-center font-bold">ALC</span><input type="number" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} className={`p-4 rounded-xl text-center focus:border-pink-500 outline-none text-pink-500 font-bold border ${bgInput}`} /></div></div></section>
        <section className={`${bgCard} p-5 rounded-3xl`}><p className="font-bold text-sm mb-4 flex items-center gap-2 text-yellow-500"><ShoppingCart size={18}/> Produtos Faltando</p><div className="space-y-3">{listaQuimica.map(q => { const item = produtosFaltando.find(p => p.nome === q); return (<div key={q} className={`flex flex-col p-3 rounded-2xl border ${item ? 'bg-pink-500/10 border-pink-500' : bgInput}`}><div className="flex items-center justify-between"><button onClick={() => toggleProduto(q)} className="flex items-center gap-3 flex-1 text-left"><div className={`w-6 h-6 rounded flex items-center justify-center border ${item ? 'bg-pink-500 border-pink-500' : 'border-gray-400'}`}>{item && <Check size={16} className="text-white"/>}</div><span className={`text-sm font-bold ${item ? 'text-pink-600' : ''}`}>{q}</span></button>{item && (<div className={`flex items-center gap-3 rounded-xl p-1 border ${bgCard}`}><button onClick={() => updateQtdProduto(q, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg opacity-70"><Minus size={16} /></button><span className="font-bold text-sm w-4 text-center">{item.qtd}</span><button onClick={() => updateQtdProduto(q, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg opacity-70"><Plus size={16} /></button></div>)}</div></div>);})}</div></section>
        <button onClick={salvarVisita} className={`w-full py-5 rounded-2xl font-bold text-lg shadow-2xl ${gradBtn}`}>SALVAR E FINALIZAR</button>
      </div>
    </div>
  );

  if (tela === 'novo_cliente') return (
    <div className={`min-h-screen ${bgPrincipal} p-6 max-w-md mx-auto font-sans pb-10`}>
      <header className="flex items-center gap-4 mb-8"><button onClick={() => setTela('lista')} className="p-2 opacity-70"><ArrowLeft/></button><h2 className={`text-xl font-bold ${gradText}`}>Cadastrar Cliente</h2></header>
      <div className="space-y-5"><div className="space-y-1"><span className="text-xs font-bold opacity-60 ml-2 uppercase">Nome Completo</span><input placeholder="Ex: Samuel Silva" value={novoNome} onChange={e => setNovoNome(e.target.value)} className={`w-full border p-4 rounded-2xl outline-none focus:border-pink-500 ${bgInput}`} /></div><div className="space-y-1"><span className="text-xs font-bold opacity-60 ml-2 uppercase">Endereço</span><input placeholder="Ex: Setor Central" value={novoEndereco} onChange={e => setNovoEndereco(e.target.value)} className={`w-full border p-4 rounded-2xl outline-none focus:border-pink-500 ${bgInput}`} /></div><p className="text-xs font-bold opacity-60 mt-6 mb-2 ml-2 uppercase">Dias de Limpeza</p><div className="grid grid-cols-4 gap-2">{diasDaSemanaNomes.map((d, i) => (<button key={i} onClick={() => alternarDiaNovoCliente(i)} className={`py-3 rounded-xl text-xs font-bold border transition-all ${novosDias.includes(i) ? gradBtn : bgInput}`}>{d.substring(0, 3)}</button>))}</div><button onClick={adicionarCliente} className={`w-full py-4 rounded-2xl font-bold mt-10 shadow-lg ${gradBtn}`}>SALVAR NOVO CLIENTE</button></div>
    </div>
  );

  if (tela === 'relatorio') return (
    <div className={`min-h-screen ${bgPrincipal} p-4 max-w-md mx-auto font-sans`}>
      <header className="flex items-center gap-4 mb-6"><button onClick={() => setTela('lista')} className="p-2 opacity-70"><ArrowLeft/></button><h2 className={`text-xl font-bold ${gradText}`}>Histórico de Clientes</h2></header>
      <div className="space-y-3">{clientes.map(c => (<button key={c.id} onClick={() => { setClienteRelatorio(c); setTela('ver_relatorio'); }} className={`w-full ${bgCard} p-5 rounded-2xl border text-left flex justify-between items-center transition-colors`}><div><p className="font-bold">{c.nome}</p><p className="text-[10px] opacity-50 uppercase font-bold tracking-tighter">Ver histórico mensal</p></div><FileText size={20} className="text-pink-500"/></button>))}</div>
    </div>
  );

  if (tela === 'ver_relatorio') {
    const clienteExibicao = clientes.find(c => c.id === clienteRelatorio.id) || clienteRelatorio;
    const historico = clienteExibicao.historicoVisitas || [];
    const ultimaVisitaReal = historico.length > 0 ? historico[historico.length - 1] : null;
    const foiVisitadoHoje = clienteExibicao.ultimaVisita === dataHojeStr;

    return (
      <div className="min-h-screen bg-gray-100 text-zinc-800 max-w-md mx-auto pb-10 font-sans relative overflow-x-hidden">
        {foiVisitadoHoje && ultimaVisitaReal?.fotoA && (
          <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -50, pointerEvents: 'none' }}>
            <div id="alerta-print" className="bg-white w-[400px] p-6">
              <div className="border-l-4 border-rose-500 pl-4 mb-4"><h2 className="text-2xl font-black text-rose-600">🚨 Atenção Técnica</h2><p className="text-sm font-bold text-zinc-500">Cliente: {clienteExibicao.nome} • {ultimaVisitaReal.d}</p></div>
              <img src={ultimaVisitaReal.fotoA} className="w-full h-64 object-cover rounded-xl mb-4 border border-zinc-200" /><div className="bg-rose-50 p-4 rounded-xl border border-rose-100"><p className="text-sm text-zinc-800 font-medium whitespace-pre-wrap">{ultimaVisitaReal.txtA || 'Nenhum detalhe adicional.'}</p></div>
              <p className="text-[10px] text-zinc-400 mt-6 text-center uppercase tracking-widest">Mão Na Água - Gestão Profissional</p>
            </div>
          </div>
        )}
        <header className="p-4 flex items-center gap-4 bg-white border-b border-zinc-200 sticky top-0 z-10 shadow-sm"><button onClick={() => setTela('relatorio')} className="text-zinc-400 p-2"><ArrowLeft /></button><h2 className="font-bold text-lg text-zinc-800">Visualizar Documento</h2></header>
        <div className="p-4 mt-2">
          {foiVisitadoHoje && <button onClick={reabrirTarefa} className="w-full mb-6 bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"><RotateCcw size={18} /> Reabrir Visita de Hoje</button>}
          <div className="flex gap-2 mb-4">
            <button onClick={() => enviarAvisoWhatsApp(clienteExibicao, clienteExibicao.ultimosProdutosFaltando)} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"><MessageSquare size={18} /> Texto</button>
            <button onClick={compartilharRelatorioVisual} className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"><Share2 size={18} /> Imagem PDF</button>
          </div>
          {foiVisitadoHoje && ultimaVisitaReal?.fotoA && <button onClick={() => compartilharAlertaSeparado(ultimaVisitaReal)} className="w-full mb-6 bg-rose-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"><AlertTriangle size={18} /> Enviar Relato do Problema</button>}
          <div id="relatorio-print" className="bg-white w-full shadow-lg rounded-sm overflow-hidden border border-zinc-200">
            <header className="p-5 border-b-4 border-b-transparent relative" style={{ borderImage: 'linear-gradient(to right, #facc15, #ec4899, #9333ea) 1' }}>
              <div className="flex justify-between items-start"><div><h1 className="text-2xl font-black tracking-tight text-pink-600 mb-0.5">Mão Na Água</h1><p className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase">Gestão Profissional</p></div><div className="text-right"><h2 className="text-xs font-bold text-zinc-800">Relatório Mensal</h2><p className="text-[10px] text-zinc-500 font-semibold">Abril / 2026</p></div></div>
              <div className="mt-5 bg-zinc-50 rounded-lg p-3 border border-zinc-100"><p className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">Cliente</p><p className="text-sm font-bold text-zinc-800">{clienteExibicao.nome}</p><div className="mt-2 inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold"><CheckCircle2 size={12} /> Água Equilibrada</div></div>
            </header>
            <div className="p-5 space-y-6">
              <section><h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-200 pb-1 mb-2 flex items-center gap-1"><Droplets size={14} className="text-pink-500" /> Histórico de Parâmetros</h3>
                <div className="overflow-x-auto rounded border border-zinc-200"><table className="w-full text-[8px] text-left"><thead className="bg-zinc-50 text-zinc-500 font-bold uppercase"><tr><th className="p-1.5 border-b">Data</th><th className="p-1.5 border-b text-center">Aspecto</th><th className="p-1.5 border-b text-center text-pink-600">Tempo</th><th className="p-1.5 border-b text-center">Cloro</th><th className="p-1.5 border-b text-center">pH</th><th className="p-1.5 border-b text-center">Alc</th></tr></thead><tbody className="divide-y divide-zinc-200">{historico.length === 0 ? <tr><td colSpan="6" className="p-3 text-center text-xs text-zinc-500">Nenhum histórico.</td></tr> : historico.map((v, i) => (<tr key={i} className="hover:bg-zinc-50"><td className="p-1.5 font-bold text-zinc-800">{v.d}</td><td className={`p-1.5 text-center font-bold ${v.a === 'Cristalina' ? 'text-green-600' : 'text-yellow-600'}`}>{v.a}</td><td className="p-1.5 text-center font-bold text-zinc-600 flex items-center justify-center gap-0.5"><Clock size={8}/> {v.t || '--'}</td><td className="p-1.5 text-center">{v.c}</td><td className="p-1.5 text-center">{v.p}</td><td className="p-1.5 text-center">{v.al}</td></tr>))}</tbody></table></div>
              </section>
              {historico.filter(v => v.fotoA).length > 0 && (
                <section className="pt-2 border-t border-zinc-200"><h3 className="text-xs font-bold text-rose-600 pb-2 flex items-center gap-1"><AlertTriangle size={14} /> Ocorrências Registradas</h3><div className="space-y-3">{historico.filter(v => v.fotoA).map((v, i) => (<div key={i} className="flex gap-3 bg-rose-50 p-2 rounded-lg border border-rose-100 items-start"><img src={v.fotoA} className="w-16 h-16 object-cover rounded shadow-sm" /><div className="flex-1"><p className="text-[8px] font-bold text-rose-800 mb-0.5">{v.d}</p><p className="text-[9px] text-zinc-700 leading-tight">{v.txtA || 'Sem descrição.'}</p></div></div>))}</div></section>
              )}
              {historico.flatMap(v => v.fotos || []).length > 0 && (
                <section className="pt-2 border-t border-zinc-200"><h3 className="text-xs font-bold text-zinc-800 pb-3 flex items-center gap-1"><Camera size={14} className="text-pink-500" /> Imagens do Local</h3><div className="grid grid-cols-4 gap-2">{historico.flatMap(v => (v.fotos || []).map(f => ({src: f, data: v.d}))).map((foto, i) => (<div key={i} className="aspect-square rounded-md overflow-hidden relative border bg-zinc-200 shadow-sm"><img src={foto.src} className="w-full h-full object-cover" /><div className="absolute bottom-0 left-0 w-full bg-black/60 text-white text-[7px] font-bold text-center py-0.5">{foto.data}</div></div>))}</div></section>
              )}
            </div>
            <footer className="bg-zinc-800 text-white p-5 text-center mt-2"><p className="text-sm font-bold mb-1">Obrigado pela confiança!</p><p className="text-[9px] text-zinc-400 mb-4">Mão Na Água - Gestão Profissional</p></footer>
          </div>
        </div>
      </div>
    );
  }
  return null;
}