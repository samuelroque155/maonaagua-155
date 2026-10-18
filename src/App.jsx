
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from './context/AppContext.jsx';
import { supabase } from './supabase';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { savePendingVisit } from './db';
import imageCompression from 'browser-image-compression';

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
import { enviarFotoVisita } from './services/fotosService';

const ADMIN_EMAIL = 'samuelroque155@gmail.com';

const compressImage = async (file) => {
  const options = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg'
  };
  return await imageCompression(file, options);
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

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

  // Carrega os clientes cadastrados no Supabase
  useEffect(() => {
    if (!user?.id) return;

    let ativo = true;

    const carregarClientes = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!ativo) return;

      if (error) {
        console.error('Erro ao carregar clientes do Supabase:', error);
        return;
      }

      setClientes((data || []).map(c => ({
        ...c,
        diasVisita: c.dias_visita || [],
        horaVisita: c.hora_visita || ''
      })));
    };

    carregarClientes();

    return () => {
      ativo = false;
    };
  }, [user?.id, setClientes]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSair = async () => {
    if (!window.confirm('Sair da conta?')) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Erro ao sair da conta:', error);
      alert('Não foi possível sair da conta: ' + error.message);
      return;
    }

    setTela('lista');
  };

  // Salva o progresso da visita no navegador
  useEffect(() => {
    if (tela === 'visita' && clienteAtual) {
      const progresso = {
        clienteId: clienteAtual.id,
        ph,
        cloro,
        alcalinidade,
        temperatura,
        aspecto,
        textoAlerta,
        fotosVisita,
        fotosAlerta,
        produtosFaltando,
        horaInicioVisita: horaInicioVisita
          ? horaInicioVisita.getTime()
          : null
      };

      localStorage.setItem(
        'maonagua_visita_progresso',
        JSON.stringify(progresso)
      );
    }
  }, [
    ph,
    cloro,
    alcalinidade,
    temperatura,
    aspecto,
    textoAlerta,
    fotosVisita,
    fotosAlerta,
    produtosFaltando,
    clienteAtual,
    tela,
    horaInicioVisita
  ]);

  // Busca visitas no Supabase e gera links temporários para fotos privadas.
  const abrirRelatorio = async (cliente) => {
    setClienteAtual(cliente);
    setTela('ver_relatorio');
    setCarregandoRelatorio(true);
    setHistoricoDoRelatorio([]);
    try {
      const { data, error } = await supabase
        .from('visitas')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('data_visita', { ascending: false });
      if (error) throw error;

      const criarLinks = async (caminhos = []) => {
        const links = await Promise.all((Array.isArray(caminhos) ? caminhos : []).map(async caminho => {
          if (typeof caminho !== 'string') return null;
          const { data: urlData, error: urlError } = await supabase.storage
            .from('fotos-visitas').createSignedUrl(caminho, 3600);
          if (urlError) {
            console.error('Erro ao abrir foto:', urlError);
            return null;
          }
          return urlData.signedUrl;
        }));
        return links.filter(Boolean);
      };

      const historico = await Promise.all((data || []).map(async visita => {
        const fotos = await criarLinks(visita.fotos);
        const fotosA = await criarLinks(visita.fotos_alerta);
        const dataVisita = new Date(visita.data_visita || visita.created_at);
        return {
          id: visita.id,
          vId: visita.id,
          clienteId: visita.cliente_id,
          d: dataVisita.toLocaleDateString('pt-BR'),
          h: visita.horario || '',
          ts: dataVisita.getTime(),
          p: visita.ph || '',
          c: visita.cloro || '',
          al: visita.alcalinidade || '',
          t: visita.temperatura || '',
          asp: visita.aspecto || '',
          txtA: visita.observacoes || '',
          prods: visita.produtos || [],
          fotos,
          fotosA,
          fotosBase64: [],
          fotosAlertaBase64: [],
          tipo: 'visita'
        };
      }));
      setHistoricoDoRelatorio(historico);
    } catch (erro) {
      console.error('Erro ao carregar relatório:', erro);
      alert('Não foi possível abrir o relatório: ' + erro.message);
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const abrirEdicaoCliente = (cliente) => {
    setClienteEditando(cliente);
    setTela('editar_cliente');
  };

  const iniciarVisita = async (cliente) => {
    const horaInicioMs = Date.now();

    const estavaEmAndamento =
      cliente.visitaEmAndamentoData === dataHojeStr;

    let novosClientes;

    if (!estavaEmAndamento) {
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

      setClientes(novosClientes);
      setHoraInicioVisita(new Date(horaInicioMs));
    } else {
      novosClientes = clientes.map(c =>
        c.id === cliente.id
          ? {
              ...c,
              horaInicioVisitaMs: horaInicioMs
            }
          : c
      );

      setClientes(novosClientes);
      setHoraInicioVisita(new Date(horaInicioMs));
    }

    const clienteAtualizado =
      novosClientes.find(c => c.id === cliente.id) || cliente;

    setClienteAtual(clienteAtualizado);

    // Recupera uma visita em andamento
    const salvo = localStorage.getItem(
      'maonagua_visita_progresso'
    );

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
        console.error(
          'Erro ao carregar progresso da visita:',
          e
        );
      }
    }

    setAspecto('Cristalina');
    setPh('');
    setCloro('');
    setAlcalinidade('');
    setTemperatura('');
    setFotosVisita([]);
    setFotosAlerta([]);
    setTextoAlerta('');
    setProdutosFaltando([]);
    setTela('visita');
  };

  const pausarVisita = async () => {
    if (!clienteAtual) return;

    const agora = Date.now();

    const tempoSessao = horaInicioVisita
      ? Math.floor(
          (agora - horaInicioVisita.getTime()) / 1000
        )
      : 0;

    const cliente = clientes.find(
      c => c.id === clienteAtual.id
    );

    const acumuladoAnterior =
      cliente?.tempoTrabalhadoAcumulado || 0;

    const novoAcumulado =
      acumuladoAnterior + tempoSessao;

    const novosClientes = clientes.map(c =>
      c.id === clienteAtual.id
        ? {
            ...c,
            tempoTrabalhadoAcumulado: novoAcumulado,
            horaInicioVisitaMs: null
          }
        : c
    );

    setClientes(novosClientes);

    const progresso = {
      clienteId: clienteAtual.id,
      ph,
      cloro,
      alcalinidade,
      temperatura,
      aspecto,
      textoAlerta,
      fotosVisita,
      fotosAlerta,
      produtosFaltando,
      horaInicioVisita: null
    };

    localStorage.setItem(
      'maonagua_visita_progresso',
      JSON.stringify(progresso)
    );

    showToast('Visita pausada. Tempo salvo!');
    setTela('lista');
  };

  // Compacta primeiro; depois envia ao Storage e mantém o caminho salvo no estado.
  const adicionarFoto = async (evento, atualizarEstado) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const urlLocal = URL.createObjectURL(arquivo);
    atualizarEstado(anteriores => [...anteriores, { id, url: urlLocal, status: 'compressing' }]);
    try {
      const comprimida = await compressImage(arquivo);
      const base64 = await fileToBase64(comprimida);
      const caminho = await enviarFotoVisita(comprimida);
      atualizarEstado(anteriores => anteriores.map(foto =>
        foto.id === id
          ? { ...foto, base64, caminho, status: 'ready' }
          : foto
      ));
    } catch (erro) {
      console.error('Erro ao enviar foto ao Supabase:', erro);
      atualizarEstado(anteriores => anteriores.map(foto =>
        foto.id === id ? { ...foto, status: 'error' } : foto
      ));
      alert('Não foi possível enviar a foto: ' + erro.message);
    }
    evento.target.value = '';
  };

  const handleNovaFoto = (evento) => adicionarFoto(evento, setFotosVisita);
  const handleFotoAlerta = (evento) => adicionarFoto(evento, setFotosAlerta);

  // Salva a visita e os caminhos das imagens na tabela public.visitas.
  const salvarVisita = async () => {
    if (!clienteAtual) return alert('Selecione um cliente.');
    if (fotosVisita.length < 3) return alert('Adicione pelo menos 3 fotos da piscina.');
    const todasFotos = [...fotosVisita, ...fotosAlerta];
    if (todasFotos.some(f => f.status !== 'ready' || !f.caminho)) {
      return alert('Aguarde todas as fotos serem enviadas. Se alguma falhou, remova e envie novamente.');
    }

    setSalvandoVisita(true);
    try {
      const { data: { user: usuario }, error: erroAuth } = await supabase.auth.getUser();
      if (erroAuth || !usuario) throw new Error('Faça login novamente.');

      const fim = new Date();
      const inicio = horaInicioVisita || fim;
      const minutos = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 60000));
      const horario = `${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${minutos}m)`;
      const { error } = await supabase.from('visitas').insert({
        user_id: usuario.id,
        cliente_id: clienteAtual.id,
        data_visita: fim.toISOString(),
        horario,
        cloro: cloro || '',
        ph: ph || '',
        alcalinidade: alcalinidade || '',
        temperatura: temperatura || '',
        aspecto: aspecto || '',
        observacoes: textoAlerta || '',
        produtos: produtosFaltando,
        fotos: fotosVisita.map(f => f.caminho),
        fotos_alerta: fotosAlerta.map(f => f.caminho)
      });
      if (error) throw error;

      // Não chama mais o sincronizador Firebase para esta visita.
      setClientes(anteriores => anteriores.map(c =>
        c.id === clienteAtual.id
          ? { ...c, ultimaVisita: dataHojeStr, visitaEmAndamentoData: null }
          : c
      ));
      localStorage.removeItem('maonagua_visita_progresso');
      setFotosVisita([]);
      setFotosAlerta([]);
      showToast('Visita salva no Supabase!');
      setTela('lista');
    } catch (erro) {
      console.error('Erro ao salvar visita no Supabase:', erro);
      alert('Erro ao salvar visita: ' + erro.message);
    } finally {
      setSalvandoVisita(false);
    }
  };

  const enviarOcorrenciaImediata = async (
    base64Foto,
    descricao
  ) => {
    if (!clienteAtual) return false;

    if (!base64Foto) {
      alert(
        'Por favor, anexe uma foto da ocorrência.'
      );
      return false;
    }

    if (!descricao) {
      alert(
        'Por favor, descreva a ocorrência.'
      );
      return false;
    }

    const ocorrenciaId = Date.now();
    const dataOcorrencia = new Date();

    let novaOcorrencia = {
      id: ocorrenciaId,
      vId: ocorrenciaId,
      clienteId: clienteAtual.id,
      tipo: 'problema',
      d: dataOcorrencia.toLocaleDateString('pt-BR'),
      h: dataOcorrencia.toLocaleTimeString(
        'pt-BR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      ),
      ts: Date.now(),
      fotosBase64: [],
      fotosAlertaBase64: [base64Foto],
      txtA: descricao,
      pendenteSync: true,
      fotos: [],
      fotosA: []
    };

    try {
      await savePendingVisit(novaOcorrencia);

      await addDoc(
        collection(
          db,
          'usuarios',
          targetUid,
          'clientes',
          String(clienteAtual.id),
          'visitas'
        ),
        {
          ...novaOcorrencia,
          fotosBase64: [],
          fotosAlertaBase64: [],
          fotos: [],
          fotosA: []
        }
      );

      processarFilaSincronizacao(
        user.id,
        clientes
      ).catch(err =>
        console.error(err)
      );

      showToast(
        'Ocorrência enviada com sucesso!'
      );

      return true;
    } catch (e) {
      alert(
        'Erro ao salvar ocorrência: ' + e.message
      );

      return false;
    }
  };

  const reabrirTarefaDaHome = async (cliente) => {
    const novosClientes = clientes.map(c =>
      c.id === cliente.id
        ? {
            ...c,
            ultimaVisita: null
          }
        : c
    );

    await atualizarE_SalvarClientes(novosClientes);
    showToast('Visita reaberta.');
  };

  const excluirCliente = async (id) => {
    if (
      window.confirm(
        'Excluir este cliente permanentemente?'
      )
    ) {
      const novos = clientes.filter(
        c => c.id !== id
      );

      await atualizarE_SalvarClientes(novos);
      setTela('lista');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-teal-400 font-bold">
        Carregando Mão Na Água...
      </div>
    );
  }

  if (!user) return <Login />;

  if (!perfil.tipoConta) {
    return <Onboarding />;
  }

  if (
    !perfil.assinaturaAtiva &&
    tela !== 'configuracoes' &&
    user.email !== ADMIN_EMAIL
  ) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white text-center">
        <AlertTriangle
          size={64}
          className="text-rose-500 mb-6"
        />

        <h2 className="text-2xl font-black mb-4">
          Assinatura Suspensa
        </h2>

        <p className="text-zinc-400 mb-8">
          Regularize sua conta para continuar usando o app.
        </p>

        <button
          onClick={() =>
            window.open(
              'https://kiwify.com.br',
              '_blank'
            )
          }
          className={`w-full max-w-xs py-4 rounded-xl font-bold ${gradBtn}`}
        >
          REGULARIZAR AGORA
        </button>

        <button
          onClick={handleSair}
          className="mt-6 text-zinc-500 font-bold"
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  // Navegação entre as telas do aplicativo
  switch (tela) {
    case 'lista':
      return (
        <Home
          setTela={setTela}
          iniciarVisita={iniciarVisita}
          reabrirTarefaDaHome={reabrirTarefaDaHome}
          toast={toast}
        />
      );

    case 'relatorio':
      return (
        <Relatorios
          setTela={setTela}
          abrirRelatorio={abrirRelatorio}
          excluirCliente={excluirCliente}
          irParaNovoCliente={() =>
            setTela('novo_cliente')
          }
          abrirEdicaoCliente={abrirEdicaoCliente}
        />
      );

    case 'ver_relatorio':
      return (
        <VerRelatorio
          setTela={setTela}
          cliente={clienteAtual}
          historico={historicoDoRelatorio}
          carregando={carregandoRelatorio}
        />
      );

    case 'visita':
      return (
        <Visita
          setTela={setTela}
          clienteAtual={clienteAtual}
          salvarVisita={salvarVisita}
          aspecto={aspecto}
          setAspecto={setAspecto}
          ph={ph}
          setPh={setPh}
          cloro={cloro}
          setCloro={setCloro}
          alcalinidade={alcalinidade}
          setAlcalinidade={setAlcalinidade}
          temperatura={temperatura}
          setTemperatura={setTemperatura}
          fotosVisita={fotosVisita}
          fotosContagem={fotosVisita.length}
          fotosAlerta={fotosAlerta}
          textoAlerta={textoAlerta}
          setTextoAlerta={setTextoAlerta}
          produtosFaltando={produtosFaltando}
          salvando={salvandoVisita}
          handleNovaFoto={handleNovaFoto}
          removerFoto={(i) =>
            setFotosVisita(prev =>
              prev.filter((_, idx) => idx !== i)
            )
          }
          handleFotoAlerta={handleFotoAlerta}
          removerFotoAlerta={(i) =>
            setFotosAlerta(prev =>
              prev.filter((_, idx) => idx !== i)
            )
          }
          toggleProduto={(nome) => {
            const existe = produtosFaltando.find(
              p => p.nome === nome
            );

            if (existe) {
              setProdutosFaltando(
                produtosFaltando.filter(
                  p => p.nome !== nome
                )
              );
            } else {
              setProdutosFaltando([
                ...produtosFaltando,
                {
                  nome,
                  qtd: 1,
                  preco: 0
                }
              ]);
            }
          }}
          updateQtdProduto={(nome, delta) =>
            setProdutosFaltando(
              produtosFaltando.map(p =>
                p.nome === nome
                  ? {
                      ...p,
                      qtd: Math.max(
                        1,
                        p.qtd + delta
                      )
                    }
                  : p
              )
            )
          }
          updatePrecoProduto={(nome, preco) =>
            setProdutosFaltando(
              produtosFaltando.map(p =>
                p.nome === nome
                  ? {
                      ...p,
                      preco
                    }
                  : p
              )
            )
          }
          pausarVisita={pausarVisita}
          enviarOcorrenciaImediata={
            enviarOcorrenciaImediata
          }
        />
      );

    // CADASTRO DE CLIENTES PELO SUPABASE
    case 'novo_cliente':
      return (
        <NovoCliente
          setTela={setTela}
          adicionarCliente={async (d) => {
            try {
              const nome = d.nome?.trim();

              if (!nome) {
                alert(
                  'Informe o nome do cliente.'
                );
                return;
              }

              const {
                data: { user: usuario },
                error: erroAuth
              } = await supabase.auth.getUser();

              if (erroAuth || !usuario) {
                throw new Error(
                  'Sua sessão expirou. Faça login novamente.'
                );
              }

              const {
                data: clienteSalvo,
                error
              } = await supabase
                .from('clientes')
                .insert({
                  user_id: usuario.id,
                  nome,
                  telefone: d.telefone || '',
                  rua: d.rua || '',
                  numero: d.numero || '',
                  bairro: d.bairro || '',
                  endereco:
                    `${d.rua || ''}, ${d.numero || ''}, ${d.bairro || ''}`,
                  dias_visita: d.dias || [],
                  hora_visita: d.hora || null
                })
                .select()
                .single();

              if (error) {
                throw error;
              }

              const novo = {
                ...clienteSalvo,
                diasVisita:
                  clienteSalvo.dias_visita || [],
                horaVisita:
                  clienteSalvo.hora_visita || ''
              };

              setClientes(anteriores => [
                ...anteriores.filter(
                  c => c.id !== novo.id
                ),
                novo
              ]);

              setTela('lista');

              showToast(
                'Cliente cadastrado com sucesso!'
              );
            } catch (erro) {
              console.error(
                'Erro ao cadastrar cliente no Supabase:',
                erro
              );

              alert(
                'Erro ao cadastrar cliente: ' +
                erro.message
              );
            }
          }}
        />
      );

    // EDIÇÃO DE CLIENTES: atualiza apenas o registro do usuário autenticado.
    case 'editar_cliente':
      return (
        <NovoCliente
          setTela={setTela}
          clienteExistente={clienteEditando}
          salvarEdicaoCliente={async (id, dados) => {
            try {
              const nome = dados.nome?.trim();
              if (!nome) {
                alert('Informe o nome do cliente.');
                return;
              }

              const { data: { user: usuario }, error: erroAuth } =
                await supabase.auth.getUser();
              if (erroAuth || !usuario) {
                throw new Error('Sua sessão expirou. Faça login novamente.');
              }

              const endereco = `${dados.rua || ''}, ${dados.numero || ''}, ${dados.bairro || ''}`;
              const alteracoes = {
                nome,
                telefone: dados.telefone || '',
                rua: dados.rua || '',
                numero: dados.numero || '',
                bairro: dados.bairro || '',
                endereco,
                dias_visita: dados.dias || [],
                hora_visita: dados.hora || null
              };

              const { data: clienteSalvo, error } = await supabase
                .from('clientes')
                .update(alteracoes)
                .eq('id', id)
                .eq('user_id', usuario.id)
                .select()
                .single();

              if (error) throw error;
              if (!clienteSalvo) throw new Error('Cliente não encontrado.');

              // Mantém os nomes de campos esperados pelas telas existentes.
              const clienteAtualizado = {
                ...clienteSalvo,
                diasVisita: clienteSalvo.dias_visita || [],
                horaVisita: clienteSalvo.hora_visita || ''
              };

              setClientes(anteriores => anteriores.map(c =>
                c.id === id ? { ...c, ...clienteAtualizado } : c
              ));
              setClienteEditando(null);
              showToast('Cliente atualizado no Supabase!');
              setTela('relatorio');
            } catch (erro) {
              console.error('Erro ao editar cliente no Supabase:', erro);
              alert('Erro ao editar cliente: ' + erro.message);
            }
          }}
        />
      );

    case 'agenda':
      return (
        <Agenda setTela={setTela} />
      );

    case 'configuracoes':
      return (
        <Configuracoes
          setTela={setTela}
          salvarConfiguracoes={() => {
            atualizarE_SalvarClientes(clientes);

            showToast(
              'Configurações salvas!'
            );

            setTela('lista');
          }}
          handleSair={handleSair}
        />
      );

    case 'admin_panel':
      return (
        <AdminPanel
          setTela={setTela}
          todosUsuarios={[]}
          carregandoAdmin={false}
        />
      );

    case 'gestao_equipe':
      return (
        <GestaoEquipe setTela={setTela} />
      );

    default:
      return (
        <Home
          setTela={setTela}
          iniciarVisita={iniciarVisita}
        />
      );
  }
}
