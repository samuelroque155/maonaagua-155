
import React, { useContext, useState, useEffect, useRef, useEffectEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as AppNativo } from '@capacitor/app';
import { AppContext } from './context/AppContext.jsx';
import { supabase } from './supabase';
import { savePendingVisit } from './db';
import { compressImage, fileToBase64 } from './utils/imageUtils';

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
import AdiarVisita from './pages/AdiarVisita';
import { listarAntecipacoes, descricaoAntecipacao } from './services/antecipacaoService.js';
import { cancelarAtendimento as registrarCancelamento, prepararRascunhoCancelamento, listarCancelamentos, atendimentoJaCancelado } from './services/cancelamentoVisitaService.js';
import AcessoPendente from './pages/AcessoPendente';
import { temAcessoAoApp } from './services/assinaturaService';

import { enviarFotoVisita } from './services/fotosService';
import { lerProgresso, salvarProgresso, removerProgresso } from './services/progressoVisita';
import { criarControleBusca, fotosDaVisita } from './services/visitaEstado';
import { preencherProdutosDaEmpresa } from './services/equipeService';
import { executarVoltar, registrarVoltarWeb, registrarVoltarAndroid } from './services/navegacaoService';
import { dataBrasil, estadoAgendaCliente, FUSO_AGENDA } from './services/agendaService';
import { listarAdiamentos, salvarAdiamento, adiamentoParaRelatorio, enviarFotoAdiamento, paginaConclusoesAgenda } from './services/adiamentoService';
import { observarLembretes } from './services/lembretesService';
import { configurarPush } from './services/pushService';

const normalizarTipoConta = (tipo) => {
  return String(tipo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function App() {
  const {
    user,
    authLoading,
    perfil,
    clientes,
    setClientes,
    tela,
    setTela,
    voltarTela,
    dataHojeStr,
    processarFilaSincronizacao,
    targetUid,
    salvarConfiguracoes,
    recuperandoSenha,
    dataHojeISO, adiamentos, setAdiamentos, setErroAgenda, versaoAgenda, recarregarAgenda,
    antecipacoes, setAntecipacoes, setErroAntecipacoes, setAntecipacoesDisponiveis, antecipacoesDisponiveis
  } = useContext(AppContext);

  const [clienteAtual, setClienteAtual] = useState(null);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [adiamentoAtual, setAdiamentoAtual] = useState(null);
  const fotoAdiamentoEnviada = useRef(null);
  const fotoCancelamentoEnviada = useRef(null);

  const [historicoDoRelatorio, setHistoricoDoRelatorio] =
    useState([]);

  const [carregandoRelatorio, setCarregandoRelatorio] =
    useState(false);

  const [toast, setToast] = useState(null);
  const [salvandoVisita, setSalvandoVisita] = useState(false);

  const [aspecto, setAspecto] = useState('Cristalina');
  const [ph, setPh] = useState('');
  const [cloro, setCloro] = useState('');
  const [alcalinidade, setAlcalinidade] = useState('');
  const [temperatura, setTemperatura] = useState('');

  const [fotosVisita, setFotosVisita] = useState([]);
  const [fotosAlerta, setFotosAlerta] = useState([]);
  const [textoAlerta, setTextoAlerta] = useState('');
  const [produtosFaltando, setProdutosFaltando] = useState([]);

  const [horaInicioVisita, setHoraInicioVisita] =
    useState(null);

  const [progressoPausado, setProgressoPausado] = useState(null);
  const [progressoCarregado, setProgressoCarregado] = useState(null);
  const controleRelatorio = useRef(criarControleBusca());
  const controleEdicao = useRef(criarControleBusca());
  const sessaoFoto = useRef(0);
  const pausandoVisita = useRef(false);
  // Identifica qual visita finalizada está sendo editada.
  const [visitaEmEdicao, setVisitaEmEdicao] = useState(null);
  const agendaLembretes = useRef({ clientes, adiamentos, antecipacoes });
  useEffect(() => { agendaLembretes.current = { clientes, adiamentos, antecipacoes }; }, [clientes, adiamentos, antecipacoes]);
  useEffect(() => {
    if (!user?.id || authLoading || import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY) return;
    return observarLembretes({ uid: user.id, obterAgenda: () => agendaLembretes.current, notificar: async aviso => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
      const registro = await navigator.serviceWorker.ready;
      await registro.showNotification(aviso.titulo, { body: aviso.texto, icon: '/logo.png', tag: 'limpezas-do-dia' });
    } });
  }, [user?.id, authLoading]);

  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => {
      if (!ativo) return null;
      setProgressoPausado(null);
      setProgressoCarregado(null);
      setClienteAtual(null);
      setVisitaEmEdicao(null);
      setHoraInicioVisita(null);
      pausandoVisita.current = false;
      setFotosVisita([]);
      setFotosAlerta([]);
      setTela('lista');
      return user?.id ? lerProgresso(user.id) : null;
    }).then(progresso => {
      if (ativo && user?.id) {
        setProgressoPausado(progresso);
        setProgressoCarregado(user.id);
      }
    }).catch(erro => {
      console.error('Erro ao recuperar rascunho:', erro);
      if (ativo) alert('Não foi possível recuperar a limpeza pausada. Reabra o app antes de iniciar outra.');
    });
    return () => { ativo = false; sessaoFoto.current += 1; };
  }, [user?.id, setTela]);

  useEffect(() => {
    if (tela !== 'ver_relatorio') controleRelatorio.current.invalidar();
    if (tela !== 'ver_relatorio' && tela !== 'editar_visita') controleEdicao.current.invalidar();
  }, [tela, user?.id]);

  useEffect(() => {
    const relatorio = controleRelatorio.current;
    const edicao = controleEdicao.current;
    return () => { relatorio.invalidar(); edicao.invalidar(); };
  }, [user?.id]);

  const tipoConta = normalizarTipoConta(perfil?.tipoConta);

  const funcionario = tipoConta === 'funcionario';

  const podeEditarVisita =
    tipoConta === 'autonomo' ||
    tipoConta === 'empresa';

  const showToast = (message) => {
    setToast(message);

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const chaveRotas = JSON.stringify(perfil.rotas || []);

  // CLIENTES DO SUPABASE
  useEffect(() => {
    if (!user?.id) return;

    let ativo = true;

    const carregarClientes = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', targetUid)
        .order('created_at', {
          ascending: true
        });

      if (!ativo) return;

      if (error) {
        setClientes([]);
        console.error(
          'Erro ao carregar clientes:',
          error
        );

        return;
      }

      // Recupera o estado a partir das visitas existentes, sem alterar registros.
      const ultimas = new Map();
      const concluidas = new Map();
      const tamanhoPagina = 500;
      for (let inicio = 0; ; inicio += tamanhoPagina) {
        const { data: visitas, error: erroVisitas } = await paginaConclusoesAgenda(supabase, targetUid, inicio, tamanhoPagina);
        if (!ativo) return;
        if (erroVisitas) {
          console.error('Erro ao recuperar conclusões:', erroVisitas);
          alert('Não foi possível recuperar as limpezas concluídas. Verifique a conexão e reabra o app.');
          return;
        }
        for (const visita of visitas || []) {
          const dataVisita = visita.data_visita || visita.created_at;
          const chave = String(visita.cliente_id);
          if (!concluidas.has(chave)) concluidas.set(chave, new Set());
          concluidas.get(chave).add(dataBrasil(dataVisita));
          if (!ultimas.has(chave) || new Date(dataVisita) > new Date(ultimas.get(chave))) {
            ultimas.set(chave, dataVisita);
          }
        }
        if ((visitas || []).length < tamanhoPagina) break;
      }
      try {
        const registros = await listarAdiamentos(supabase, targetUid);
        if (!ativo) return;
        setAdiamentos(registros);
        setErroAgenda('');
      } catch (erro) {
        if (!ativo) return;
        console.error('Erro ao carregar adiamentos:', erro);
        setErroAgenda('Não foi possível carregar os adiamentos neste ambiente. Verifique a conexão e a configuração do banco antes de reagendar.');
      }
      try {
        const registros = await listarAntecipacoes(supabase, targetUid);
        if (!ativo) return;
        setAntecipacoes(registros); setErroAntecipacoes(''); setAntecipacoesDisponiveis(true);
      } catch (erro) {
        if (!ativo) return;
        setAntecipacoesDisponiveis(false);
        const ausente = erro.code === '42P01' || erro.code === 'PGRST205';
        if (ausente) setAntecipacoes([]);
        setErroAntecipacoes(ausente ? '' : 'Não foi possível sincronizar as antecipações. Atualize a agenda antes de iniciar uma visita.');
      }
      setClientes(
        (data || []).map(c => ({
          ...c,
          diasVisita: c.dias_visita || [],
          horaVisita: c.hora_visita || '',
          ultimaVisita: ultimas.get(String(c.id)) || null,
          datasConcluidas: [...(concluidas.get(String(c.id)) || [])]
        }))
      );
    };

    carregarClientes();

    return () => {
      ativo = false;
    };
  }, [user?.id, targetUid, chaveRotas, setClientes, dataHojeISO, versaoAgenda, setAdiamentos, setErroAgenda, setAntecipacoes, setAntecipacoesDisponiveis, setErroAntecipacoes]);

  useEffect(() => {
    if (!user?.id) return;
    const atualizar = () => { if (!document.hidden) recarregarAgenda(); };
    const timer = setInterval(atualizar, 60000);
    window.addEventListener('focus', atualizar);
    window.addEventListener('online', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', atualizar);
      window.removeEventListener('online', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [user?.id, recarregarAgenda]);

  const abrirAdiamento = cliente => {
    if (!estadoAgendaCliente(cliente, dataHojeISO, adiamentos, antecipacoes).pendente) {
      alert('Somente uma visita pendente de hoje pode ser adiada.');
      return;
    }
    fotoAdiamentoEnviada.current = null;
    setAdiamentoAtual({ id: crypto.randomUUID(), cliente, dataOriginal: dataHojeISO });
    setTela('adiar_visita');
  };

  const confirmarAdiamento = async ({ motivo, novaData, compareceu, foto }) => {
    if (!adiamentoAtual || salvandoVisita) return;
    setSalvandoVisita(true);
    try {
      let fotoCaminho = null;
      if (foto) {
        if (fotoAdiamentoEnviada.current?.arquivo !== foto) {
          fotoAdiamentoEnviada.current = { arquivo: foto, caminho: await enviarFotoAdiamento(supabase, user.id, foto) };
        }
        fotoCaminho = fotoAdiamentoEnviada.current.caminho;
      }
      const registro = await salvarAdiamento(supabase, { id: adiamentoAtual.id,
        userId: user.id, ownerId: targetUid, clienteId: adiamentoAtual.cliente.id,
        dataOriginal: adiamentoAtual.dataOriginal, novaData, motivo, compareceu, fotoCaminho });
      setAdiamentos(prev => [registro, ...prev.filter(a => a.id !== registro.id)]);
      recarregarAgenda();
      showToast('Visita adiada. Histórico e nova data preservados.');
      setTela('lista');
    } catch (erro) { alert('Não foi possível adiar a visita: ' + erro.message); }
    finally { setSalvandoVisita(false); }
  };

  const handleSair = async () => {
    if (!window.confirm('Sair da conta?')) return;

    if (user?.id && 'serviceWorker' in navigator) {
      try { await configurarPush(supabase, user.id, { ativo: false }, import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY); }
      catch (e) { console.error('Não foi possível atualizar as notificações no servidor:', e.message); }
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(
        'Não foi possível sair: ' +
        error.message
      );

      return;
    }

    setTela('lista');
  };

  // SALVAMENTO AUTOMÁTICO DE VISITA EM ANDAMENTO
  useEffect(() => {
    // Não sobrescreve uma visita pausada ao editar relatório.
    if (
      tela !== 'visita' ||
      !clienteAtual ||
      visitaEmEdicao ||
      pausandoVisita.current ||
      progressoCarregado !== user?.id
    ) {
      return;
    }

    const progresso = {
      userId: user.id,
      salvoEm: Date.now(),
      clienteId: clienteAtual.id,
      dataAgenda: clienteAtual.dataAgenda,
      atendimentoId: clienteAtual.atendimentoId,
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
        : null,
      inicioOriginalMs:
        clienteAtual.inicioOriginalMs ||
        horaInicioVisita?.getTime() ||
        null,
      tempoTrabalhadoAcumulado:
        clienteAtual.tempoTrabalhadoAcumulado || 0
    };

    salvarProgresso(user.id, progresso).catch(erro => {
      console.error('Erro ao salvar rascunho:', erro);
      alert('Não foi possível guardar o progresso neste aparelho. Mantenha o app aberto e tente pausar novamente.');
    });
  }, [
    tela,
    clienteAtual,
    visitaEmEdicao,
    ph,
    cloro,
    alcalinidade,
    temperatura,
    aspecto,
    textoAlerta,
    fotosVisita,
    fotosAlerta,
    produtosFaltando,
    horaInicioVisita,
    user?.id,
    progressoCarregado
  ]);

  // RELATÓRIOS DO SUPABASE
  const abrirRelatorio = async (cliente, filtro = {}) => {
    const pedido = controleRelatorio.current.iniciar();
    controleEdicao.current.invalidar();
    setClienteAtual(cliente);
    setTela('ver_relatorio');
    setCarregandoRelatorio(true);
    setHistoricoDoRelatorio([]);

    try {
      let consulta = supabase.from('visitas').select('*')
        .eq('cliente_id', cliente.id).eq('user_id', targetUid);
      if (filtro.visitaId) consulta = consulta.eq('id', filtro.visitaId);
      const { data, error } = await consulta.order('data_visita', { ascending: false });

      if (error) throw error;

      const criarLinks = async (caminhos = []) => {
        const links = await Promise.all(
          (Array.isArray(caminhos) ? caminhos : []).map(
            async caminho => {
              if (typeof caminho !== 'string') {
                return null;
              }

              const { data: urlData, error: urlError } =
                await supabase.storage
                  .from('fotos-visitas')
                  .createSignedUrl(caminho, 3600);

              if (urlError) {
                console.error(
                  'Erro ao abrir foto:',
                  urlError
                );

                return null;
              }

              return urlData.signedUrl;
            }
          )
        );

        return links.filter(Boolean);
      };

      const { data: dadosEquipe, error: erroEquipe } = await supabase.rpc('dados_equipe');
      if (erroEquipe) throw erroEquipe;
      const antecipacoesCliente = await listarAntecipacoes(supabase, targetUid, cliente.id, true);
      const visitasComProdutos = await preencherProdutosDaEmpresa(supabase, targetUid, filtro.adiamentoId ? [] : data || []);
      const historico = await Promise.all(
        visitasComProdutos.map(async visita => {
          const fotos = await criarLinks(
            visita.fotos
          );

          const fotosA = await criarLinks(
            visita.fotos_alerta
          );

          const dataVisita = new Date(
            visita.data_visita ||
            visita.created_at
          );

          return {
            id: visita.id,
            vId: visita.id,
            clienteId: visita.cliente_id,
            funcionarioNome: filtro.nome || dadosEquipe?.funcionarios?.find(f => f.usuario_id === visita.criado_por)?.nome || (visita.criado_por !== visita.user_id ? 'Funcionário (vínculo encerrado)' : null),
            criadoPor: visita.criado_por,
            d: dataVisita.toLocaleDateString('pt-BR', { timeZone: FUSO_AGENDA }),
            dataISO: dataBrasil(dataVisita),
            h: visita.horario || '',
            ts: dataVisita.getTime(),
            p: visita.ph || '',
            c: visita.cloro || '',
            al: visita.alcalinidade || '',
            t: visita.temperatura || '',
            asp: visita.aspecto || '',
            txtA: visita.observacoes || '',
            prods: visita.produtos || [],
            fotosCaminhos: visita.fotos || [],
            fotosAlertaCaminhos: visita.fotos_alerta || [],
            fotos,
            fotosA,
            fotosBase64: [],
            fotosAlertaBase64: [],
            tipo: visita.tipo || 'visita',
            antecipacaoId: visita.antecipacao_id,
            antecipacaoDados: antecipacoesCliente.find(a => a.id === visita.antecipacao_id),
            antecipacaoDescricao: antecipacoesCliente.find(a => a.id === visita.antecipacao_id) ? descricaoAntecipacao(antecipacoesCliente.find(a => a.id === visita.antecipacao_id)) : ''
          };
        })
      );

      if (!controleRelatorio.current.atual(pedido)) return;
      const reagendamentos = await listarAdiamentos(supabase, targetUid, cliente.id, true);
      const eventos = await Promise.all(reagendamentos.filter(a => !filtro.visitaId && (!filtro.adiamentoId || a.id === filtro.adiamentoId)).map(async a => {
        const [foto] = await criarLinks(a.foto_caminho ? [a.foto_caminho] : []);
        return { ...adiamentoParaRelatorio(a, foto), funcionarioNome: filtro.nome || dadosEquipe?.funcionarios?.find(f => f.usuario_id === a.criado_por)?.nome || null };
      }));
      if (!controleRelatorio.current.atual(pedido)) return;
      const eventosAntecipados = filtro.visitaId || filtro.adiamentoId ? [] : antecipacoesCliente.map(a => {
        const realizada = historico.find(v => v.antecipacaoId === a.id);
        return {
          id: `antecipacao:${a.id}`, antecipacaoId: a.id, antecipacaoDados: a, clienteId: a.cliente_id, tipo: 'antecipacao',
          dataISO: a.nova_data, d: a.nova_data.split('-').reverse().join('/'),
          ts: new Date(a.criado_em).getTime(), descricao: descricaoAntecipacao(a),
          criadoEm: a.criado_em, criadoPor: a.criado_por, canceladoEm: a.cancelado_em,
          status: a.cancelado_em ? 'Cancelada; data original restaurada' : realizada ? 'Limpeza concluída' : 'Pendente',
          dataEfetiva: realizada?.d || '', fotos: [], fotosA: [], prods: []
        };
      });
      const cancelamentos = filtro.visitaId || filtro.adiamentoId ? [] : await listarCancelamentos(supabase, targetUid, cliente.id);
      const eventosCancelados = await Promise.all(cancelamentos.map(async c => ({
        id: c.id, clienteId: c.cliente_id, tipo: 'cancelamento', dataISO: dataBrasil(c.cancelado_em), d: dataBrasil(c.cancelado_em).split('-').reverse().join('/'),
        ts: Date.parse(c.cancelado_em), iniciadoEm: c.iniciado_em, canceladoEm: c.cancelado_em, criadoPor: c.criado_por,
        funcionarioNome: dadosEquipe?.funcionarios?.find(f => f.usuario_id === c.criado_por)?.nome || (c.criado_por === user.id ? 'Você' : 'Responsável pelo atendimento'),
        motivo: c.motivo, dataOriginal: c.data_original, novaData: c.nova_data, rascunho: c.rascunho,
        fotos: await criarLinks([...(c.rascunho?.fotos || []), ...(c.rascunho?.fotos_alerta || [])]), fotosA: [], prods: []
      })));
      if (!controleRelatorio.current.atual(pedido)) return;
      setHistoricoDoRelatorio([...historico, ...eventos, ...eventosAntecipados, ...eventosCancelados].sort((a, b) => b.ts - a.ts));
    } catch (erro) {
      if (!controleRelatorio.current.atual(pedido)) return;
      console.error(
        'Erro ao carregar relatório:',
        erro
      );

      alert(
        'Não foi possível abrir o relatório: ' +
        erro.message
      );
    } finally {
      if (controleRelatorio.current.atual(pedido)) setCarregandoRelatorio(false);
    }
  };

  const abrirEdicaoCliente = (cliente) => {
    setClienteEditando(cliente);
    setTela('editar_cliente');
  };

  // ABRIR VISITA FINALIZADA PARA CORREÇÃO
  const editarVisitaFinalizada = async (visita) => {
    const pedido = controleEdicao.current.iniciar();
    if (!podeEditarVisita || funcionario) {
      alert(
        'Você não tem autorização para editar esta visita.'
      );

      return;
    }

    if (!clienteAtual?.id || !visita?.id) {
      alert('Visita não identificada.');
      return;
    }

    // Evita misturar visita finalizada com outra pausada.
    let progresso;
    try {
      progresso = await lerProgresso(user.id);
    } catch (erro) {
      console.error('Erro ao recuperar rascunho:', erro);
      alert('Não foi possível conferir a limpeza pausada. Tente novamente.');
      return;
    }
    if (!controleEdicao.current.atual(pedido)) return;

    if (progresso) {
      alert(
        'Existe uma visita pausada. Finalize essa visita antes de editar um relatório antigo.'
      );

      return;
    }

    try {
      const { data, error } = await supabase
        .from('visitas')
        .select('*')
        .eq('id', visita.id)
        .eq('cliente_id', clienteAtual.id)
        .eq('user_id', targetUid)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Visita não encontrada ou sem permissão.'
        );
      }

      const prepararFotos = async (caminhos) => {
        const lista = Array.isArray(caminhos)
          ? caminhos
          : [];

        const resultado = await Promise.all(
          lista.map(async (caminho, index) => {
            const { data: link, error: erroLink } =
              await supabase.storage
                .from('fotos-visitas')
                .createSignedUrl(caminho, 3600);

            return {
              id: `existente-${index}-${caminho}`,
              caminho,
              url: erroLink
                ? ''
                : link.signedUrl,
              status: 'ready'
            };
          })
        );

        return resultado;
      };

      const [dadosComProdutos] = await preencherProdutosDaEmpresa(supabase, targetUid, [data]);
      const fotos = await prepararFotos(
        data.fotos
      );

      const alertas = await prepararFotos(
        data.fotos_alerta
      );

      if (!controleEdicao.current.atual(pedido)) return;
      sessaoFoto.current += 1;
      setVisitaEmEdicao(data);
      setAspecto(data.aspecto || 'Cristalina');
      setPh(data.ph || '');
      setCloro(data.cloro || '');
      setAlcalinidade(data.alcalinidade || '');
      setTemperatura(data.temperatura || '');
      setTextoAlerta(data.observacoes || '');
      setProdutosFaltando(dadosComProdutos.produtos || []);
      setFotosVisita(fotos);
      setFotosAlerta(alertas);

      // A edição não inicia nem altera o cronômetro.
      setHoraInicioVisita(null);

      setTela('editar_visita');
    } catch (erro) {
      if (!controleEdicao.current.atual(pedido)) return;
      console.error(
        'Erro ao abrir visita para edição:',
        erro
      );

      alert(
        'Não foi possível abrir a visita: ' +
        erro.message
      );
    }
  };

  // ATUALIZAR A MESMA VISITA NO SUPABASE
  const salvarEdicaoVisita = async () => {
    if (!visitaEmEdicao) return;

    if (!podeEditarVisita || funcionario) {
      alert('Você não tem autorização.');
      return;
    }

    if (fotosVisita.length < 3) {
      alert(
        'A visita precisa manter pelo menos 3 fotos.'
      );

      return;
    }

    const todasFotos = [
      ...fotosVisita,
      ...fotosAlerta
    ];

    if (!fotosDaVisita(todasFotos, user.id, clienteAtual.id, visitaEmEdicao.id)) {
      alert('Há fotos de outra visita neste formulário. Reabra a visita antes de salvar.');
      return;
    }

    if (
      todasFotos.some(
        foto =>
          foto.status !== 'ready' ||
          !foto.caminho
      )
    ) {
      alert(
        'Aguarde o envio das fotos antes de salvar.'
      );

      return;
    }

    setSalvandoVisita(true);

    try {
      const {
        data: { user: usuario },
        error: erroAuth
      } = await supabase.auth.getUser();

      if (erroAuth || !usuario || usuario.id !== user.id) {
        throw new Error(
          'Faça login novamente.'
        );
      }

      const alteracoes = {
        aspecto: aspecto || '',
        ph: ph || '',
        cloro: cloro || '',
        alcalinidade: alcalinidade || '',
        temperatura: temperatura || '',
        observacoes: textoAlerta || '',
        produtos: produtosFaltando,
        fotos: fotosVisita.map(
          foto => foto.caminho
        ),
        fotos_alerta: fotosAlerta.map(
          foto => foto.caminho
        )
      };

      const { data, error } = await supabase
        .from('visitas')
        .update(alteracoes)
        .eq('id', visitaEmEdicao.id)
        .eq('cliente_id', clienteAtual.id)
        .eq('user_id', usuario.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Visita não encontrada ou atualização não permitida.'
        );
      }

      // Não altera data, horário ou duração originais.
      setVisitaEmEdicao(null);

      showToast(
        'Relatório atualizado com sucesso!'
      );

      await abrirRelatorio(clienteAtual);
    } catch (erro) {
      console.error(
        'Erro ao atualizar visita:',
        erro
      );

      alert(
        'Não foi possível salvar a edição: ' +
        erro.message
      );
    } finally {
      setSalvandoVisita(false);
    }
  };

  const cancelarEdicaoVisita = () => {
    setVisitaEmEdicao(null);
    abrirRelatorio(clienteAtual);
  };

  // SOLICITAÇÕES DE FUNCIONÁRIOS
  const solicitarCorrecaoVisita = async () => {
    alert(
      'As solicitações de funcionários serão ativadas depois de configurar as permissões da equipe no Supabase.'
    );
  };

  // INICIAR OU CONTINUAR VISITA
  const iniciarVisita = async (cliente) => {
    if (progressoCarregado !== user?.id) {
      alert('Aguarde a recuperação da limpeza pausada.');
      return;
    }
    const pedido = controleEdicao.current.iniciar();
    setVisitaEmEdicao(null);

    const agora = new Date().getTime();
    let salvo;
    try {
      salvo = await lerProgresso(user.id);
      if (salvo?.atendimentoId && await atendimentoJaCancelado(supabase, salvo.atendimentoId, user.id)) {
        await removerProgresso(user.id); salvo = null;
      }
      if (!controleEdicao.current.atual(pedido)) return;
    } catch (erro) {
      console.error('Erro ao recuperar limpeza:', erro);
      alert('Não foi possível recuperar a limpeza. Tente novamente antes de iniciar outra.');
      return;
    }

    const retomando =
      salvo &&
      String(salvo.clienteId) ===
        String(cliente.id);

    if (
      salvo &&
      !retomando &&
      !window.confirm(
        'Existe outra visita pausada. Iniciar uma nova visita substituirá o progresso não finalizado. Deseja continuar?'
      )
    ) {
      return;
    }

    const acumulado = retomando
      ? Number(
          salvo.tempoTrabalhadoAcumulado || 0
        ) + (salvo.horaInicioVisita && salvo.salvoEm
          ? Math.max(0, Math.floor((salvo.salvoEm - salvo.horaInicioVisita) / 1000))
          : 0)
      : 0;

    const inicioOriginalMs = retomando
      ? Number(
          salvo.inicioOriginalMs || agora
        )
      : agora;

    const clienteAtualizado = {
      ...cliente,
      atendimentoId: retomando && salvo.atendimentoId ? salvo.atendimentoId : crypto.randomUUID(),
      dataAgenda: retomando ? salvo.dataAgenda || dataBrasil(inicioOriginalMs) : dataHojeISO,
      visitaEmAndamentoData: dataHojeStr,
      tempoTrabalhadoAcumulado: acumulado,
      inicioOriginalMs,
      horaInicioVisitaMs: agora
    };

    setClientes(anteriores =>
      anteriores.map(c =>
        c.id === cliente.id
          ? clienteAtualizado
          : c
      )
    );

    setClienteAtual(clienteAtualizado);
    pausandoVisita.current = false;
    sessaoFoto.current += 1;
    setHoraInicioVisita(new Date(agora));
    setProgressoPausado(null);

    if (retomando) {
      setAspecto(
        salvo.aspecto || 'Cristalina'
      );
      setPh(salvo.ph || '');
      setCloro(salvo.cloro || '');
      setAlcalinidade(
        salvo.alcalinidade || ''
      );
      setTemperatura(
        salvo.temperatura || ''
      );
      setFotosVisita(
        (salvo.fotosVisita || []).map(restaurarPreview)
      );
      setFotosAlerta(
        (salvo.fotosAlerta || []).map(restaurarPreview)
      );
      setTextoAlerta(
        salvo.textoAlerta || ''
      );
      setProdutosFaltando(
        salvo.produtosFaltando || []
      );
    } else {
      setAspecto('Cristalina');
      setPh('');
      setCloro('');
      setAlcalinidade('');
      setTemperatura('');
      setFotosVisita([]);
      setFotosAlerta([]);
      setTextoAlerta('');
      setProdutosFaltando([]);
    }

    setTela('visita');
    if (retomando) {
      // Retoma também envios interrompidos quando o app foi fechado.
      for (const [fotos, setter] of [
        [salvo.fotosVisita || [], setFotosVisita],
        [salvo.fotosAlerta || [], setFotosAlerta]
      ]) {
        for (const foto of fotos) recuperarFoto(foto, setter, sessaoFoto.current);
      }
    }
  };

  // PAUSAR VISITA
  const cancelarAtendimentoIniciado = async ({ motivo, novaData, preservar, ocorrencia }) => {
    if (!clienteAtual || visitaEmEdicao || salvandoVisita) throw new Error('O atendimento não está disponível para cancelamento.');
    if (!clienteAtual.atendimentoId) throw new Error('Reabra o atendimento para identificá-lo antes de cancelar.');
    const sessao = sessaoFoto.current;
    setSalvandoVisita(true); pausandoVisita.current = true;
    try {
      const rascunho = preservar ? prepararRascunhoCancelamento({ ph, cloro, alcalinidade, temperatura, aspecto, textoAlerta, produtosFaltando, fotosVisita, fotosAlerta }, user.id, clienteAtual.id) : {};
      if (preservar && ocorrencia) {
        rascunho.observacao_tecnica = ocorrencia.texto || '';
        if (ocorrencia.foto) {
          if (ocorrencia.foto.status !== 'ready') throw new Error('Aguarde o preparo da foto da ocorrência antes de preservar o rascunho.');
          const salvo = fotoCancelamentoEnviada.current;
          if (salvo?.id !== clienteAtual.atendimentoId || salvo?.base64 !== ocorrencia.foto.base64) {
            const arquivo = await (await fetch(ocorrencia.foto.base64)).blob();
            fotoCancelamentoEnviada.current = { id: clienteAtual.atendimentoId, base64: ocorrencia.foto.base64, caminho: await enviarFotoVisita(arquivo) };
          }
          rascunho.fotos_alerta.push(fotoCancelamentoEnviada.current.caminho);
        }
      }
      await registrarCancelamento(supabase, { id: clienteAtual.atendimentoId, userId: user.id, ownerId: targetUid, clienteId: clienteAtual.id, iniciadoEm: new Date(clienteAtual.inicioOriginalMs).toISOString(), dataOriginal: clienteAtual.dataAgenda, novaData, motivo, rascunho });
      if (sessaoFoto.current !== sessao) throw new Error('A sessão mudou. O cancelamento registrado será recuperado ao reabrir esta conta.');
      await removerProgresso(user.id);
      sessaoFoto.current += 1;
      setProgressoPausado(null); setHoraInicioVisita(null); setFotosVisita([]); setFotosAlerta([]);
      setClientes(anteriores => anteriores.map(c => c.id === clienteAtual.id ? { ...c, visitaEmAndamentoData: null, horaInicioVisitaMs: null, tempoTrabalhadoAcumulado: 0 } : c));
      setClienteAtual(null); setTela('lista'); recarregarAgenda();
      showToast(novaData ? 'Atendimento cancelado e limpeza remarcada.' : 'Atendimento cancelado. A limpeza continua pendente.');
    } finally { if (sessaoFoto.current === sessao) pausandoVisita.current = false; setSalvandoVisita(false); }
  };

  const pausarVisita = async () => {
    if (!clienteAtual || pausandoVisita.current || salvandoVisita) return;
    pausandoVisita.current = true;

    const agora = Date.now();

    const tempoSessao = horaInicioVisita
      ? Math.max(
          0,
          Math.floor(
            (agora -
              horaInicioVisita.getTime()) /
              1000
          )
        )
      : 0;

    const novoAcumulado =
      Number(
        clienteAtual.tempoTrabalhadoAcumulado || 0
      ) + tempoSessao;

    const progresso = {
      userId: user.id,
      clienteId: clienteAtual.id,
      dataAgenda: clienteAtual.dataAgenda,
      atendimentoId: clienteAtual.atendimentoId,
      ph,
      cloro,
      alcalinidade,
      temperatura,
      aspecto,
      textoAlerta,
      fotosVisita,
      fotosAlerta,
      produtosFaltando,
      horaInicioVisita: null,
      inicioOriginalMs:
        clienteAtual.inicioOriginalMs ||
        horaInicioVisita?.getTime() ||
        agora,
      tempoTrabalhadoAcumulado: novoAcumulado
    };

    try {
      await salvarProgresso(user.id, progresso);
    } catch (erro) {
      pausandoVisita.current = false;
      console.error('Erro ao pausar:', erro);
      alert('Não foi possível salvar a pausa. Mantenha o app aberto e tente novamente.');
      return;
    }

    setClientes(anteriores =>
      anteriores.map(c =>
        c.id === clienteAtual.id
          ? {
              ...c,
              visitaEmAndamentoData: dataHojeStr,
              tempoTrabalhadoAcumulado:
                novoAcumulado,
              horaInicioVisitaMs: null
            }
          : c
      )
    );

    setProgressoPausado(progresso);
    setHoraInicioVisita(null);

    showToast(
      'Visita pausada. Tempo acumulado salvo!'
    );

    setTela('lista');
    pausandoVisita.current = false;
  };

  // ENVIO DE FOTOS
  function restaurarPreview(foto) {
    return { ...foto, url: foto.base64 || (foto.arquivo ? URL.createObjectURL(foto.arquivo) : '') };
  }

  async function recuperarFoto(foto, setter, sessao) {
    const atualizar = alteracoes => {
      if (sessaoFoto.current !== sessao) return;
      setter(anteriores => anteriores.map(item => item.id === foto.id ? { ...item, ...alteracoes } : item));
    };
    try {
      if (foto.caminho) {
        const { data, error } = await supabase.storage.from('fotos-visitas').createSignedUrl(foto.caminho, 3600);
        if (error && !foto.base64 && !foto.arquivo) throw error;
        atualizar({ url: foto.base64 || (foto.arquivo ? URL.createObjectURL(foto.arquivo) : data.signedUrl), status: 'ready' });
      } else {
        const arquivo = foto.arquivo || (foto.base64 ? await (await fetch(foto.base64)).blob() : null);
        if (!arquivo) throw new Error('Esta foto antiga não tem arquivo recuperável. Remova e adicione a foto novamente.');
        const comprimida = await compressImage(arquivo);
        const base64 = await fileToBase64(comprimida);
        atualizar({ base64, url: base64 });
        const caminho = await enviarFotoVisita(comprimida);
        atualizar({ caminho, status: 'ready' });
      }
    } catch (erro) {
      atualizar({ status: 'error' });
      console.error('Erro ao recuperar foto:', erro);
    }
  }

  const adicionarFoto = async (
    evento,
    atualizarEstado
  ) => {
    const arquivo = evento.target.files?.[0];

    if (!arquivo) return;
    const sessao = sessaoFoto.current;

    const id =
      `${Date.now()}-` +
      Math.random().toString(36).slice(2);

    const urlLocal = URL.createObjectURL(
      arquivo
    );

    atualizarEstado(anteriores => [
      ...anteriores,
      {
        id,
        arquivo,
        userId: user.id,
        clienteId: clienteAtual.id,
        visitaId: visitaEmEdicao?.id || null,
        url: urlLocal,
        status: 'compressing'
      }
    ]);

    try {
      const comprimida = await compressImage(
        arquivo
      );

      const base64 = await fileToBase64(
        comprimida
      );
      if (sessaoFoto.current !== sessao) return;
      atualizarEstado(anteriores => anteriores.map(foto => foto.id === id ? { ...foto, base64, url: base64 } : foto));

      const caminho = await enviarFotoVisita(
        comprimida
      );
      if (sessaoFoto.current !== sessao) return;

      atualizarEstado(anteriores =>
        anteriores.map(foto =>
          foto.id === id
            ? {
                ...foto,
                base64,
                caminho,
                status: 'ready'
              }
            : foto
        )
      );
    } catch (erro) {
      if (sessaoFoto.current !== sessao) return;
      console.error(
        'Erro ao enviar foto:',
        erro
      );

      atualizarEstado(anteriores =>
        anteriores.map(foto =>
          foto.id === id
            ? {
                ...foto,
                status: 'error'
              }
            : foto
        )
      );

      alert(
        'Não foi possível enviar a foto: ' +
        erro.message
      );
    }

    evento.target.value = '';
  };

  const handleNovaFoto = evento =>
    adicionarFoto(
      evento,
      setFotosVisita
    );

  const handleFotoAlerta = evento =>
    adicionarFoto(
      evento,
      setFotosAlerta
    );

  // FINALIZAR VISITA NOVA
  const salvarVisita = async () => {
    if (!clienteAtual) {
      alert('Selecione um cliente.');
      return;
    }

    if (fotosVisita.length < 3) {
      alert(
        'Adicione pelo menos 3 fotos da piscina.'
      );
      return;
    }

    const todasFotos = [
      ...fotosVisita,
      ...fotosAlerta
    ];

    if (!fotosDaVisita(todasFotos, user.id, clienteAtual.id)) {
      alert('Há fotos de outra visita neste formulário. Reabra a limpeza antes de salvar.');
      return;
    }

    if (
      todasFotos.some(
        foto =>
          foto.status !== 'ready' ||
          !foto.caminho
      )
    ) {
      alert(
        'Aguarde todas as fotos serem enviadas.'
      );
      return;
    }

    setSalvandoVisita(true);

    try {
      const {
        data: { user: usuario },
        error: erroAuth
      } = await supabase.auth.getUser();

      if (erroAuth || !usuario || usuario.id !== user.id) {
        throw new Error(
          'Faça login novamente.'
        );
      }

      const fim = new Date();

      const inicio = new Date(
        clienteAtual.inicioOriginalMs ||
          horaInicioVisita?.getTime() ||
          fim.getTime()
      );

      const tempoAtual = horaInicioVisita
        ? Math.max(
            0,
            Math.floor(
              (fim.getTime() -
                horaInicioVisita.getTime()) /
                1000
            )
          )
        : 0;

      const segundosTotais =
        Number(
          clienteAtual.tempoTrabalhadoAcumulado ||
            0
        ) + tempoAtual;

      const minutos = Math.max(
        1,
        Math.round(
          segundosTotais / 60
        )
      );

      const horario =
        `${inicio.toLocaleTimeString('pt-BR', {
          timeZone: FUSO_AGENDA,
          hour: '2-digit',
          minute: '2-digit'
        })} - ` +
        `${fim.toLocaleTimeString('pt-BR', {
          timeZone: FUSO_AGENDA,
          hour: '2-digit',
          minute: '2-digit'
        })} (${minutos}m)`;

      const { error } = await supabase
        .from('visitas')
        .insert({
          user_id: targetUid,
          criado_por: usuario.id,
          cliente_id: clienteAtual.id,
          data_visita: fim.toISOString(),
          ...(antecipacoesDisponiveis ? { data_agendada: clienteAtual.dataAgenda || dataBrasil(inicio) } : {}),
          horario,
          cloro: cloro || '',
          ph: ph || '',
          alcalinidade: alcalinidade || '',
          temperatura: temperatura || '',
          aspecto: aspecto || '',
          observacoes: textoAlerta || '',
          produtos: produtosFaltando,
          fotos: fotosVisita.map(
            foto => foto.caminho
          ),
          fotos_alerta: fotosAlerta.map(
            foto => foto.caminho
          )
        });

      if (error) throw error;

      setClientes(anteriores =>
        anteriores.map(c =>
          c.id === clienteAtual.id
            ? {
                ...c,
                ultimaVisita: fim.toISOString(),
                datasConcluidas: [...new Set([...(c.datasConcluidas || []), antecipacoesDisponiveis ? clienteAtual.dataAgenda || dataBrasil(inicio) : dataBrasil(fim)])],
                visitaEmAndamentoData: null
              }
            : c
        )
      );

      await removerProgresso(usuario.id);

      setProgressoPausado(null);
      setFotosVisita([]);
      setFotosAlerta([]);

      showToast(
        'Visita salva no Supabase!'
      );

      setTela('lista');
      recarregarAgenda();
    } catch (erro) {
      console.error(
        'Erro ao salvar visita:',
        erro
      );

      alert(
        'Erro ao salvar visita: ' +
        erro.message
      );
    } finally {
      setSalvandoVisita(false);
    }
  };

  // OCORRÊNCIAS TÉCNICAS
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

    const ocorrenciaId = crypto.randomUUID();
    const dataOcorrencia = new Date();

    const novaOcorrencia = {
      id: ocorrenciaId,
      supabaseId: ocorrenciaId,
      userId: user.id,
      ownerId: targetUid,
      vId: ocorrenciaId,
      clienteId: clienteAtual.id,
      tipo: 'problema',
      d: dataOcorrencia.toLocaleDateString(
        'pt-BR', { timeZone: FUSO_AGENDA }
      ),
      h: dataOcorrencia.toLocaleTimeString(
        'pt-BR',
        {
          timeZone: FUSO_AGENDA,
          hour: '2-digit',
          minute: '2-digit'
        }
      ),
      ts: Date.now(),
      fotosBase64: [],
      fotosAlertaBase64: [
        base64Foto
      ],
      txtA: descricao,
      pendenteSync: true,
      fotos: [],
      fotosA: []
    };

    try {
      await savePendingVisit(
        novaOcorrencia
      );

      const enviada = await processarFilaSincronizacao(user.id);
      showToast(enviada ? 'Ocorrência enviada ao Supabase!' : 'Ocorrência salva no aparelho; aguardando envio.');

      return novaOcorrencia;
    } catch (erro) {
      alert(
        'Erro ao salvar ocorrência: ' +
        erro.message
      );

      return false;
    }
  };

  // BOTÃO REABRIR VISITA DA HOME
  const reabrirTarefaDaHome = async (cliente) => {
    if (!podeEditarVisita || funcionario) {
      alert(
        'Somente o autônomo ou o responsável pode corrigir uma visita finalizada.'
      );
      return;
    }

    // Busca a visita finalizada mais recente.
    try {
      const { data, error } = await supabase
        .from('visitas')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('user_id', targetUid)
        .order('data_visita', {
          ascending: false
        })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert(
          'Nenhuma visita finalizada foi encontrada.'
        );
        return;
      }

      setClienteAtual(cliente);

      // O estado será carregado pela função de edição
      // quando o relatório for aberto.
      await abrirRelatorio(cliente);

      showToast(
        'Selecione EDITAR VISITA no relatório.'
      );
    } catch (erro) {
      alert(
        'Erro ao localizar visita: ' +
        erro.message
      );
    }
  };

  // EXCLUSÃO SEGURA DE CLIENTES
  const excluirCliente = async (id) => {
    try {
      const {
        data: { user: usuario },
        error: erroAuth
      } = await supabase.auth.getUser();

      if (erroAuth || !usuario) {
        throw new Error(
          'Faça login novamente.'
        );
      }

      const { count, error: erroVisitas } =
        await supabase
          .from('visitas')
          .select('id', {
            count: 'exact',
            head: true
          })
          .eq('cliente_id', id)
          .eq('user_id', usuario.id);

      if (erroVisitas) throw erroVisitas;

      if ((count || 0) > 0) {
        alert(
          `Este cliente possui ${count} visita(s) registrada(s). ` +
          'Para proteger os relatórios e as fotos, não é possível excluí-lo.'
        );

        return;
      }

      const cliente = clientes.find(
        c => c.id === id
      );

      const confirmado = window.confirm(
        `Excluir permanentemente o cliente "${cliente?.nome || 'selecionado'}"?`
      );

      if (!confirmado) return;

      const {
        data: excluido,
        error: erroExclusao
      } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
        .eq('user_id', usuario.id)
        .select('id')
        .maybeSingle();

      if (erroExclusao) {
        throw erroExclusao;
      }

      if (!excluido) {
        throw new Error(
          'Cliente não encontrado.'
        );
      }

      setClientes(anteriores =>
        anteriores.filter(
          c => c.id !== id
        )
      );

      setClienteAtual(atual =>
        atual?.id === id ? null : atual
      );

      setClienteEditando(atual =>
        atual?.id === id ? null : atual
      );

      showToast(
        'Cliente excluído do Supabase!'
      );

      setTela('lista');
    } catch (erro) {
      console.error(
        'Erro ao excluir cliente:',
        erro
      );

      alert(
        'Não foi possível excluir o cliente: ' +
        erro.message
      );
    }
  };

  const voltarDoSistema = useEffectEvent(() => executarVoltar({
    tela, salvando: salvandoVisita,
    pausarVisita, cancelarEdicao: cancelarEdicaoVisita, voltarTela,
    avisarInicio: () => showToast('Você já está na tela inicial do app.')
  }));

  useEffect(() => {
    if (!user?.id || authLoading) return;
    const voltar = () => { void voltarDoSistema(); };
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'android') return registrarVoltarAndroid(AppNativo, voltar);
      return;
    }
    return registrarVoltarWeb(window, voltar);
  }, [user?.id, authLoading]);

  // AUTENTICAÇÃO
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-teal-400 font-bold">
        Carregando Mão Na Água...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (recuperandoSenha) return <Login redefinindoSenha />;

  if (!perfil.tipoConta) {
    return <Onboarding />;
  }

  if (
    !temAcessoAoApp(user, perfil) &&
    tela !== 'configuracoes'
  ) {
    return <AcessoPendente handleSair={handleSair} />;
  }

  // NAVEGAÇÃO
  const telaPermitida = funcionario && !['lista', 'agenda', 'visita', 'adiar_visita', 'configuracoes'].includes(tela) ? 'lista' : tela;
  switch (telaPermitida) {
    case 'adiar_visita':
      return <AdiarVisita cliente={adiamentoAtual?.cliente} dataOriginal={adiamentoAtual?.dataOriginal} salvando={salvandoVisita} salvar={confirmarAdiamento} voltar={voltarTela} />;
    case 'lista':
      return (
        <Home
          adiarVisita={abrirAdiamento}
          setTela={setTela}
          iniciarVisita={iniciarVisita}
          reabrirTarefaDaHome={
            reabrirTarefaDaHome
          }
          toast={toast}
          progressoPausado={progressoPausado}
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
          abrirEdicaoCliente={
            abrirEdicaoCliente
          }
        />
      );

    case 'ver_relatorio':
      return (
        <VerRelatorio
          setTela={setTela}
          cliente={clienteAtual}
          historico={historicoDoRelatorio}
          carregando={carregandoRelatorio}
          editarVisitaFinalizada={
            editarVisitaFinalizada
          }
          solicitarCorrecaoVisita={
            solicitarCorrecaoVisita
          }
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
          removerFoto={i =>
            setFotosVisita(prev =>
              prev.filter(
                (_, idx) => idx !== i
              )
            )
          }
          handleFotoAlerta={handleFotoAlerta}
          removerFotoAlerta={i =>
            setFotosAlerta(prev =>
              prev.filter(
                (_, idx) => idx !== i
              )
            )
          }
          toggleProduto={nome => {
            const existe =
              produtosFaltando.find(
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
                  preco: perfil.tipoConta === 'funcionario' ? null : perfil.precosProdutos?.[nome] ?? perfil.precosAcessorios?.[nome] ?? null
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
          cancelarAtendimento={cancelarAtendimentoIniciado}
          enviarOcorrenciaImediata={
            enviarOcorrenciaImediata
          }
        />
      );

    // TELA DE EDIÇÃO DE VISITA FINALIZADA
    case 'editar_visita':
      return (
        <Visita
          setTela={setTela}
          clienteAtual={clienteAtual}
          modoEdicao={true}
          visitaEmEdicao={visitaEmEdicao}
          salvarVisita={salvarEdicaoVisita}
          cancelarEdicao={cancelarEdicaoVisita}
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
          removerFoto={i =>
            setFotosVisita(prev =>
              prev.filter(
                (_, idx) => idx !== i
              )
            )
          }
          handleFotoAlerta={handleFotoAlerta}
          removerFotoAlerta={i =>
            setFotosAlerta(prev =>
              prev.filter(
                (_, idx) => idx !== i
              )
            )
          }
          toggleProduto={nome => {
            const existe =
              produtosFaltando.find(
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
                  preco: perfil.tipoConta === 'funcionario' ? null : perfil.precosProdutos?.[nome] ?? perfil.precosAcessorios?.[nome] ?? null
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
          pausarVisita={cancelarEdicaoVisita}
          enviarOcorrenciaImediata={
            enviarOcorrenciaImediata
          }
        />
      );

    // CADASTRO DE CLIENTES
    case 'novo_cliente':
      return (
        <NovoCliente
          setTela={setTela}
          adicionarCliente={async d => {
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
                  'Faça login novamente.'
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
                    `${d.rua || ''}, ` +
                    `${d.numero || ''}, ` +
                    `${d.bairro || ''}`,
                  dias_visita: d.dias || [],
                  hora_visita: d.hora || null
                })
                .select()
                .single();

              if (error) throw error;

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
                'Erro ao cadastrar cliente:',
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

    // EDITAR CLIENTE
    case 'editar_cliente':
      return (
        <NovoCliente
          setTela={setTela}
          clienteExistente={clienteEditando}
          salvarEdicaoCliente={async (
            id,
            dados
          ) => {
            try {
              const nome = dados.nome?.trim();

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
                  'Faça login novamente.'
                );
              }

              const endereco =
                `${dados.rua || ''}, ` +
                `${dados.numero || ''}, ` +
                `${dados.bairro || ''}`;

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

              const {
                data: clienteSalvo,
                error
              } = await supabase
                .from('clientes')
                .update(alteracoes)
                .eq('id', id)
                .eq('user_id', usuario.id)
                .select()
                .single();

              if (error) throw error;

              const clienteAtualizado = {
                ...clienteSalvo,
                diasVisita:
                  clienteSalvo.dias_visita || [],
                horaVisita:
                  clienteSalvo.hora_visita || ''
              };

              setClientes(anteriores =>
                anteriores.map(c =>
                  c.id === id
                    ? {
                        ...c,
                        ...clienteAtualizado
                      }
                    : c
                )
              );

              setClienteEditando(null);

              showToast(
                'Cliente atualizado no Supabase!'
              );

              setTela('relatorio');
            } catch (erro) {
              console.error(
                'Erro ao editar cliente:',
                erro
              );

              alert(
                'Erro ao editar cliente: ' +
                erro.message
              );
            }
          }}
        />
      );

    case 'agenda':
      return (
        <Agenda setTela={setTela} iniciarVisita={iniciarVisita} adiarVisita={abrirAdiamento} />
      );

    case 'configuracoes':
      return (
        <Configuracoes
          setTela={setTela}
          salvarConfiguracoes={async () => {
            try {
              await salvarConfiguracoes();
              showToast('Configurações salvas!');
              setTela('lista');
            } catch (erro) {
              alert('Não foi possível salvar: ' + erro.message);
            }
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
        <GestaoEquipe
          abrirRelatorio={abrirRelatorio}
          setTela={setTela}
        />
      );

    default:
      return (
        <Home
          adiarVisita={abrirAdiamento}
          setTela={setTela}
          iniciarVisita={iniciarVisita}
          reabrirTarefaDaHome={
            reabrirTarefaDaHome
          }
          progressoPausado={progressoPausado}
        />
      );
  }
}
