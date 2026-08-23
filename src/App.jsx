import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from './context/AppContext.jsx';
import { auth, db, storage } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, deleteDoc, doc, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { ref, deleteObject, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { savePendingVisit, getPendingVisits, removePendingVisit } from './db';
import { compressImage, fileToBase64 } from './utils/imageUtils';

// Componentes das Páginas
import Home from './pages/Home';
import Login from './pages/Login';
import Relatorios from './pages/Relatorios';
import VerRelatorio from './pages/VerRelatorio';
import Visita from './pages/Visita';
import NovoCliente from './pages/NovoCliente';
import Agenda from './pages/Agenda';
import AdminPanel from './pages/AdminPanel';
import Configuracoes from './pages/Configuracoes';
import Onboarding from './pages/Onboarding';
import GestaoEquipe from './pages/GestaoEquipe';

// Ícones Globais
import { AlertTriangle } from 'lucide-react';

const ADMIN_EMAIL = 'samuelroque155@gmail.com';

export default function App() {
  const { 
    user, authLoading, perfil, setPerfil, clientes, setClientes, 
    tela, setTela, atualizarE_SalvarClientes, dataHojeStr, 
    gradBtn, processarFilaSincronizacao, setPendentesCount, targetUid
  } = useContext(AppContext);

  const [clienteAtual, setClienteAtual] = useState(null);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [historicoDoRelatorio, setHistoricoDoRelatorio] = useState([]);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [toast, setToast] = useState(null);
  const [salvandoVisita, setSalvandoVisita] = useState(false);
  const relatorioUnsubscribeRef = useRef(null);

  // Estados dos Formulários
  const [aspecto, setAspecto] = useState('Cristalina');
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [fotosVisita, setFotosVisita] = useState([]);
  const [fotosAlerta, setFotosAlerta] = useState([]);
  const [textoAlerta, setTextoAlerta] = useState('');
  const [produtosFaltando, setProdutosFaltando] = useState([]);
  const [horaInicioVisita, setHoraInicioVisita] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSair = async () => {
    if (window.confirm("Sair da conta?")) await signOut(auth);
  };

  // Efeito para salvar o progresso da visita no localStorage para não perder ao fechar o app
  useEffect(() => {
    if (tela === 'visita' && clienteAtual) {
      const progresso = {
        clienteId: clienteAtual.id,
        ph, cloro, alcalinidade, temperatura, aspecto, textoAlerta,
        fotosVisita, fotosAlerta, produtosFaltando,
        horaInicioVisita: horaInicioVisita ? horaInicioVisita.getTime() : null
      };
      localStorage.setItem('maonagua_visita_progresso', JSON.stringify(progresso));
    }
  }, [ph, cloro, alcalinidade, temperatura, aspecto, textoAlerta, fotosVisita, fotosAlerta, produtosFaltando, clienteAtual, tela, horaInicioVisita]);

  useEffect(() => () => {
    relatorioUnsubscribeRef.current?.();
  }, []);

  const abrirRelatorio = (cliente) => {
    relatorioUnsubscribeRef.current?.();
    setClienteAtual(cliente);
    setTela('ver_relatorio');
    setCarregandoRelatorio(true);
    const q = query(collection(db, 'usuarios', targetUid, 'clientes', String(cliente.id), 'visitas'));

    // O relatório acompanha alterações em tempo real: quando o upload termina,
    // as fotos aparecem sem o usuário precisar fechar e abrir novamente.
    relatorioUnsubscribeRef.current = onSnapshot(q, (snap) => {
      const hist = snap.docs.map(d => d.data()).sort((a, b) => b.ts - a.ts);
      setHistoricoDoRelatorio(hist);
      setCarregandoRelatorio(false);
    }, (error) => {
      console.error('Erro ao carregar relatório:', error);
      setCarregandoRelatorio(false);
    });
  };

  const abrirEdicaoCliente = (cliente) => {
    setClienteEditando(cliente);
    setTela('editar_cliente');
  };

  const iniciarVisita = async (cliente) => {
    const horaInicioMs = Date.now();
    const estavaEmAndamento = cliente.visitaEmAndamentoData === dataHojeStr;
    let novosClientes;

    if (!estavaEmAndamento) {
      // Começando visita do zero
      novosClientes = clientes.map(c => 
        c.id === cliente.id 
          ? { 
              ...c, 
              visitaEmAndamentoData: dataHojeStr, 
              tempoTrabalhadoAcumulado: 0, 
              horaInicioVisitaMs: horaInicioMs 
            } 
          : c
      );
      await atualizarE_SalvarClientes(novosClientes);
      setHoraInicioVisita(new Date(horaInicioMs));
    } else {
      // Retomando visita pausada
      novosClientes = clientes.map(c => 
        c.id === cliente.id 
          ? { ...c, horaInicioVisitaMs: horaInicioMs } 
          : c
      );
      await atualizarE_SalvarClientes(novosClientes);
      setHoraInicioVisita(new Date(horaInicioMs));
    }

    const clienteAtualizado = novosClientes.find(c => c.id === cliente.id) || cliente;
    setClienteAtual(clienteAtualizado);

    // Tenta carregar progresso salvo do localStorage
    const salvo = localStorage.getItem('maonagua_visita_progresso');
    if (salvo) {
      try {
        const progresso = JSON.parse(salvo);
        if (progresso.clienteId === cliente.id) {
          setAspecto(progresso.aspecto || 'Cristalina');
          setPh(progresso.ph || '');
          setCloro(progresso.cloro || '');
          setAlcalinidade(progresso.alcalinidade || '');
          setTemperatura(progresso.temperatura || '');
          setFotosVisita(progresso.fotosVisita || []);
          setFotosAlerta(progresso.fotosAlerta || []);
          setTextoAlerta(progresso.textoAlerta || '');
          setProdutosFaltando(progresso.produtosFaltando || []);
          setTela('visita');
          return;
        }
      } catch (e) {
        console.error("Erro ao carregar progresso da visita:", e);
      }
    }

    setAspecto('Cristalina'); setPh(''); setCloro(''); setAlcalinidade(''); setTemperatura('');
    setFotosVisita([]); setFotosAlerta([]); setTextoAlerta(''); setProdutosFaltando([]);
    setTela('visita');
  };

  const pausarVisita = async () => {
    if (!clienteAtual) return;
    const agora = Date.now();
    const tempoSessao = horaInicioVisita ? Math.floor((agora - horaInicioVisita.getTime()) / 1000) : 0;
    
    const cliente = clientes.find(c => c.id === clienteAtual.id);
    const acumuladoAnterior = cliente?.tempoTrabalhadoAcumulado || 0;
    const novoAcumulado = acumuladoAnterior + tempoSessao;
    
    const novosClientes = clientes.map(c => 
      c.id === clienteAtual.id 
        ? { ...c, tempoTrabalhadoAcumulado: novoAcumulado, horaInicioVisitaMs: null } 
        : c
    );
    
    await atualizarE_SalvarClientes(novosClientes);
    
    const progresso = {
      clienteId: clienteAtual.id,
      ph, cloro, alcalinidade, temperatura, aspecto, textoAlerta,
      fotosVisita, fotosAlerta, produtosFaltando,
      horaInicioVisita: null
    };
    localStorage.setItem('maonagua_visita_progresso', JSON.stringify(progresso));
    
    showToast("Visita pausada. Tempo salvo!");
    setTela('lista');
  };

  const handleNovaFoto = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const tempId = Date.now() + Math.random().toString(36).substr(2, 9);
      const localUrl = URL.createObjectURL(file);
      setFotosVisita(prev => [...prev, { id: tempId, url: localUrl, status: 'compressing' }]);
      try {
        const compressedFile = await compressImage(file);
        const base64 = await fileToBase64(compressedFile);
        const compressedUrl = URL.createObjectURL(compressedFile);
        setFotosVisita(prev => prev.map(f => f.id === tempId ? { id: tempId, url: compressedUrl, base64, blob: compressedFile, status: 'ready' } : f));
      } catch (error) {
        console.error("Erro na compressão:", error);
        setFotosVisita(prev => prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f));
      }
    }
  };

  const handleFotoAlerta = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const tempId = Date.now() + Math.random().toString(36).substr(2, 9);
      const localUrl = URL.createObjectURL(file);
      setFotosAlerta(prev => [...prev, { id: tempId, url: localUrl, status: 'compressing' }]);
      try {
        const compressedFile = await compressImage(file);
        const base64 = await fileToBase64(compressedFile);
        const compressedUrl = URL.createObjectURL(compressedFile);
        setFotosAlerta(prev => prev.map(f => f.id === tempId ? { id: tempId, url: compressedUrl, base64, blob: compressedFile, status: 'ready' } : f));
      } catch (error) {
        console.error("Erro na compressão:", error);
        setFotosAlerta(prev => prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f));
      }
    }
  };

  const salvarVisita = async () => {
    if (fotosVisita.length < 3) return alert("Adicione pelo menos 3 fotos da piscina.");
    
    // Verifica se alguma foto ainda está sendo compactada
    const compactando = fotosVisita.some(f => f.status === 'compressing') || fotosAlerta.some(f => f.status === 'compressing');
    if (compactando) {
      return alert("Aguarde a compactação das fotos ser concluída.");
    }

    setSalvandoVisita(true);

    const dataFim = new Date();
    const tempoSessaoSegundos = horaInicioVisita ? Math.floor((dataFim.getTime() - horaInicioVisita.getTime()) / 1000) : 0;
    const cliente = clientes.find(c => c.id === clienteAtual.id);
    const acumuladoAnterior = cliente?.tempoTrabalhadoAcumulado || 0;
    const totalSegundos = acumuladoAnterior + tempoSessaoSegundos;

    // Formata o tempo total
    const totalMinutos = Math.max(1, Math.round(totalSegundos / 60));
    const tempoFormatado = totalMinutos >= 60 
      ? `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}m` 
      : `${totalMinutos}m`;

    const strInicio = horaInicioVisita ? horaInicioVisita.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const strFim = dataFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const base64Principais = fotosVisita.map(f => f.base64).filter(Boolean);
    const base64Alerta = fotosAlerta.map(f => f.base64).filter(Boolean);
    const arquivosPrincipais = fotosVisita.map(f => f.blob).filter(Boolean);
    const arquivosAlerta = fotosAlerta.map(f => f.blob).filter(Boolean);

    const visitaId = Date.now();
    let novaVisita = {
      id: visitaId, vId: visitaId, clienteId: clienteAtual.id,
      d: dataFim.toLocaleDateString('pt-BR'), 
      h: strInicio ? `${strInicio} - ${strFim} (${tempoFormatado})` : strFim,
      ts: Date.now(), p: ph, c: cloro, al: alcalinidade, t: temperatura, asp: aspecto,
      fotosBase64: arquivosPrincipais.length ? [] : base64Principais,
      fotosAlertaBase64: arquivosAlerta.length ? [] : base64Alerta,
      fotosArquivos: arquivosPrincipais,
      fotosAlertaArquivos: arquivosAlerta,
      txtA: textoAlerta,
      prods: produtosFaltando, pendenteSync: true,
      tempoTrabalhadoAcumulado: totalSegundos,
      tipo: 'visita',
      fotos: [], fotosA: []
    };

    try {
      // Salva imediatamente no banco local (IndexedDB) para garantir persistência offline
      await savePendingVisit(novaVisita);

      if (navigator.onLine && produtosFaltando && produtosFaltando.length > 0) {
        await addDoc(collection(db, 'usuarios', targetUid, 'alertasProdutos'), {
          clienteId: clienteAtual.id,
          clienteNome: clienteAtual.nome,
          clienteTel: clienteAtual.telefone || '',
          data: dataHojeStr,
          produtos: produtosFaltando,
          lido: false,
          ts: Date.now(),
          funcionarioAtivo: perfil?.nome || user?.email
        });
      }

      const novosClientes = clientes.map(c => 
        c.id === clienteAtual.id 
          ? { 
              ...c, 
              ultimaVisita: dataHojeStr, 
              ultimosProdutosFaltando: produtosFaltando,
              visitaEmAndamentoData: null,
              tempoTrabalhadoAcumulado: 0,
              horaInicioVisitaMs: null
            } 
          : c
      );
      if (navigator.onLine) {
        await atualizarE_SalvarClientes(novosClientes);
        localStorage.removeItem('maonagua_visita_progresso');
        const pendentes = await getPendingVisits();
        setPendentesCount(pendentes.length);
        showToast("Visita salva no celular. Enviando fotos em segundo plano...");
        setTela('lista');
        processarFilaSincronizacao(user.uid, novosClientes, targetUid).catch(error => {
          console.error('Erro ao iniciar sincronização em segundo plano:', error);
        });
      } else {
        setClientes(novosClientes);
        const pendentes = await getPendingVisits();
        setPendentesCount(pendentes.length);
        localStorage.removeItem('maonagua_visita_progresso');
        showToast("Sem internet: visita salva localmente e aguardando envio.");
        setTela('lista');
      }
    } catch (e) {
      alert("Erro ao salvar visita: " + e.message);
    } finally {
      setSalvandoVisita(false);
    }
  };

  const enviarOcorrenciaImediata = async (base64Foto, descricao) => {
    if (!clienteAtual) return false;
    if (!base64Foto) {
      alert("Por favor, anexe uma foto da ocorrência.");
      return false;
    }
    if (!descricao) {
      alert("Por favor, descreva a ocorrência.");
      return false;
    }

    const ocorrenciaId = Date.now();
    const dataOcorrencia = new Date();

    let novaOcorrencia = {
      id: ocorrenciaId, vId: ocorrenciaId, clienteId: clienteAtual.id,
      tipo: 'problema',
      d: dataOcorrencia.toLocaleDateString('pt-BR'),
      h: dataOcorrencia.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ts: Date.now(),
      fotosBase64: [],
      fotosAlertaBase64: [base64Foto],
      txtA: descricao,
      pendenteSync: true,
      fotos: [], fotosA: []
    };

    try {
      await savePendingVisit(novaOcorrencia);
      processarFilaSincronizacao(user.uid, clientes, targetUid).catch(err => console.error(err));
      showToast("Ocorrência enviada com sucesso!");
      return true;
    } catch (e) {
      alert("Erro ao salvar ocorrência: " + e.message);
      return false;
    }
  };

  const reabrirTarefaDaHome = async (cliente) => {
    const novosClientes = clientes.map(c => c.id === cliente.id ? { ...c, ultimaVisita: null } : c);
    await atualizarE_SalvarClientes(novosClientes);
    showToast("Visita reaberta.");
  };

  const excluirCliente = async (id) => {
    if (window.confirm("Excluir este cliente permanentemente?")) {
      const novos = clientes.filter(c => c.id !== id);
      await atualizarE_SalvarClientes(novos);
      setTela('lista');
    }
  };

  if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-teal-400 font-bold">Carregando Mão Na Água...</div>;
  if (!user) return <Login />;
  if (!perfil.tipoConta) return <Onboarding />;
  
  const funcionarioVinculado = perfil.tipoConta === 'funcionario' && Boolean(perfil.vinculoEmpresa);

  if (!perfil.assinaturaAtiva && !funcionarioVinculado && tela !== 'configuracoes' && user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white text-center">
        <AlertTriangle size={64} className="text-rose-500 mb-6" />
        <h2 className="text-2xl font-black mb-4">Assinatura Suspensa</h2>
        <p className="text-zinc-400 mb-8">Regularize sua conta para continuar usando o app.</p>
        <button onClick={() => window.open('https://kiwify.com.br', '_blank')} className={`w-full max-w-xs py-4 rounded-xl font-bold ${gradBtn}`}>REGULARIZAR AGORA</button>
        <button onClick={handleSair} className="mt-6 text-zinc-500 font-bold">Sair da Conta</button>
      </div>
    );
  }

  // Router Simples
  switch (tela) {
    case 'lista': return <Home setTela={setTela} iniciarVisita={iniciarVisita} reabrirTarefaDaHome={reabrirTarefaDaHome} toast={toast} />;
    case 'relatorio': return <Relatorios setTela={setTela} abrirRelatorio={abrirRelatorio} excluirCliente={excluirCliente} irParaNovoCliente={() => setTela('novo_cliente')} abrirEdicaoCliente={abrirEdicaoCliente} />;
    case 'ver_relatorio': return <VerRelatorio setTela={setTela} cliente={clienteAtual} historico={historicoDoRelatorio} carregando={carregandoRelatorio} />;
    case 'visita': return <Visita 
      setTela={setTela} clienteAtual={clienteAtual} salvarVisita={salvarVisita}
      aspecto={aspecto} setAspecto={setAspecto} ph={ph} setPh={setPh} cloro={cloro} setCloro={setCloro} 
      alcalinidade={alcalinidade} setAlcalinidade={setAlcalinidade} temperatura={temperatura} setTemperatura={setTemperatura}
      fotosVisita={fotosVisita} fotosContagem={fotosVisita.length} fotosAlerta={fotosAlerta} 
      textoAlerta={textoAlerta} setTextoAlerta={setTextoAlerta} produtosFaltando={produtosFaltando}
      salvando={salvandoVisita}
      handleNovaFoto={handleNovaFoto}
      removerFoto={(i) => setFotosVisita(prev => prev.filter((_, idx) => idx !== i))}
      handleFotoAlerta={handleFotoAlerta}
      removerFotoAlerta={(i) => setFotosAlerta(prev => prev.filter((_, idx) => idx !== i))}
      toggleProduto={(nome) => {
        const existe = produtosFaltando.find(p => p.nome === nome);
        if (existe) setProdutosFaltando(produtosFaltando.filter(p => p.nome !== nome));
        else setProdutosFaltando([...produtosFaltando, { nome, qtd: 1, preco: 0 }]);
      }}
      updateQtdProduto={(nome, delta) => setProdutosFaltando(produtosFaltando.map(p => p.nome === nome ? { ...p, qtd: Math.max(1, p.qtd + delta) } : p))}
      updatePrecoProduto={(nome, preco) => setProdutosFaltando(produtosFaltando.map(p => p.nome === nome ? { ...p, preco } : p))}
      pausarVisita={pausarVisita}
      enviarOcorrenciaImediata={enviarOcorrenciaImediata}
    />;
    case 'novo_cliente': return <NovoCliente setTela={setTela} adicionarCliente={async (d) => {
      const novo = { id: Date.now(), ...d, endereco: `${d.rua}, ${d.numero}, ${d.bairro}`, diasVisita: d.dias, horaVisita: d.hora };
      await atualizarE_SalvarClientes([...clientes, novo]);
      setTela('lista');
    }} />;
    case 'editar_cliente': return <NovoCliente setTela={setTela} clienteExistente={clienteEditando} salvarEdicaoCliente={async (id, dados) => {
      const novoEndereco = `${dados.rua}, ${dados.numero}, ${dados.bairro}`;
      const novos = clientes.map(c => c.id === id ? { ...c, ...dados, endereco: novoEndereco, diasVisita: dados.dias, horaVisita: dados.hora } : c);
      await atualizarE_SalvarClientes(novos);
      showToast("Cliente atualizado com sucesso!");
      setTela('relatorio');
    }} />;
    case 'agenda': return <Agenda setTela={setTela} />;
    case 'configuracoes': return <Configuracoes setTela={setTela} salvarConfiguracoes={() => {
      atualizarE_SalvarClientes(clientes); // Salva perfil e clientes
      showToast("Configurações salvas!");
      setTela('lista');
    }} handleSair={handleSair} />;
    case 'admin_panel': return <AdminPanel setTela={setTela} todosUsuarios={[]} carregandoAdmin={false} />;
    case 'gestao_equipe': return <GestaoEquipe setTela={setTela} />;
    default: return <Home setTela={setTela} iniciarVisita={iniciarVisita} />;
  }
}
