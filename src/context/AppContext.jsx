import { supabase, erroRetornoInicial } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { criarProcessadorRetorno, mensagemErroAuth } from '../services/authService';
import { carregarPerfil as obterPerfil, mapearPerfil, salvarPerfilProfissional, salvarTipoPerfil, normalizarTipoPerfil } from '../services/perfilService';
import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { consultarAssinatura } from '../services/assinaturaService';
import { getPendingVisits, removePendingVisit, savePendingVisit } from '../db';
import { sincronizarPendencia, pendenciasDaConta } from '../services/filaSupabase';
import { carregarContextoEquipe, aplicarContextoEquipe } from '../services/equipeService';

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext();

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

const processarRetornoNativo = criarProcessadorRetorno(supabase);

// eslint-disable-next-line react-refresh/only-export-components
export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [erroPerfil, setErroPerfil] = useState('');
  const [erroAuth, setErroAuth] = useState(() => erroRetornoInicial ? mensagemErroAuth(erroRetornoInicial) : '');
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [nomeEmpresaSalvo, setNomeEmpresaSalvo] = useState('');
  const ultimoUsuarioIdRef = useRef(undefined);
  const preferenciasPerfilRef = useRef({});
  const consultaAssinaturaRef = useRef(0);
  const [verificandoAssinatura, setVerificandoAssinatura] = useState(false);
  const [erroAssinatura, setErroAssinatura] = useState('');

  const [perfil, setPerfil] = useState({
    empresa: '',
    cidade: '',
    assinaturaAtiva: false,
    whatsappSuporte: '5564999999999',
    listaProdutos: listaQuimica,
    listaAcessorios: listaAcessorios
  });

  const [clientes, setClientes] = useState([]);
  const [tela, setTela] = useState('lista');

  const [modoEscuro, setModoEscuro] = useState(() => {
    try {
      const salvo = localStorage.getItem('maonagua_tema');
      return salvo !== null ? JSON.parse(salvo) : true;
    } catch (erro) {
      console.error('Erro ao carregar tema salvo:', erro);
      return true;
    }
  });

  const [pendentesCount, setPendentesCount] = useState(0);
  const [erroSincronizacao, setErroSincronizacao] = useState('');
  const [pendentesLegados, setPendentesLegados] = useState(0);
  const [contextoEquipe, setContextoEquipe] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const gradText =
    'bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent';

  const gradBtn =
    'bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 text-white shadow-lg active:scale-[0.98] transition-all';

  const [dateObj, setDateObj] = useState(() => new Date());
  useEffect(() => {
    const atualizarData = () => setDateObj(new Date());
    const timer = setInterval(atualizarData, 30000);
    window.addEventListener('focus', atualizarData);
    document.addEventListener('visibilitychange', atualizarData);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', atualizarData);
      document.removeEventListener('visibilitychange', atualizarData);
    };
  }, []);
  const diaAtual = dateObj.getDay();
  const dataHojeStr = dateObj.toDateString();

  // Aplica e salva o tema visual.
  useEffect(() => {
    localStorage.setItem('maonagua_tema', JSON.stringify(modoEscuro));

    if (modoEscuro) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [modoEscuro]);

  // Observa a sessão. Recarrega o perfil apenas quando muda o usuário.
  useEffect(() => {
    let ativo = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!ativo) return;

      const usuarioAtual = session?.user ?? null;
      const proximoId = usuarioAtual?.id ?? null;
      preferenciasPerfilRef.current = usuarioAtual?.user_metadata?.preferencias_profissionais;

      if (ultimoUsuarioIdRef.current !== proximoId) {
        ultimoUsuarioIdRef.current = proximoId;
        setAuthLoading(Boolean(usuarioAtual));
        setErroPerfil('');
        setClientes([]);
        setContextoEquipe(null);
        setPendentesCount(0);
        setErroSincronizacao('');
        consultaAssinaturaRef.current += 1;
        setVerificandoAssinatura(false);
        setErroAssinatura('');
        setNomeEmpresaSalvo('');
        setPerfil({
          empresa: '',
          cidade: '',
          assinaturaAtiva: false,
          tipoConta: null,
          vinculoEmpresa: null,
          whatsappSuporte: '5564999999999',
          listaProdutos: listaQuimica,
          listaAcessorios: listaAcessorios
        });
      }

      setUser(usuarioAtual);
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true);
      if (!usuarioAtual) setRecuperandoSenha(false);
      setAuthReady(true);
      if (!usuarioAtual) setAuthLoading(false);
    });

    // Aguarda a recuperação da sessão persistida e a troca automática do código
    // de retorno no navegador. A assinatura acima continua sendo a fonte do usuário.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo) return;
      if (error) setErroAuth(mensagemErroAuth(error));
      setAuthReady(true);
      if (!data.session) setAuthLoading(false);
    }).catch(erro => {
      if (ativo) {
        setErroAuth(mensagemErroAuth(erro));
        setAuthLoading(false);
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let ativo = true;
    let listener;
    let estado;
    const receberUrl = async ({ url }) => {
      try {
        if (await processarRetornoNativo(url)) await Browser.close();
      } catch (erro) {
        if (ativo) setErroAuth(mensagemErroAuth(erro));
      }
    };
    CapacitorApp.addListener('appUrlOpen', receberUrl).then(handle => {
      if (ativo) listener = handle;
      else handle.remove();
    });
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    }).then(handle => {
      if (ativo) estado = handle;
      else handle.remove();
    });
    CapacitorApp.getLaunchUrl().then(retorno => {
      if (ativo && retorno?.url) receberUrl(retorno);
    });
    return () => { ativo = false; listener?.remove(); estado?.remove(); };
  }, []);

  // Consulta o perfil real antes de liberar a tela inicial.
  useEffect(() => {
    if (!authReady || !user?.id) return;
    let ativo = true;

    const carregarPerfil = async () => {
      try {
        const [data, equipe] = await Promise.all([obterPerfil(supabase, user.id), carregarContextoEquipe(supabase)]);

        if (!ativo) return;
        setContextoEquipe(equipe);
        setPerfil(prev => aplicarContextoEquipe(mapearPerfil(data, preferenciasPerfilRef.current, prev), equipe));
        setNomeEmpresaSalvo(mapearPerfil(data).empresa);
        setErroPerfil('');
      } catch (erro) {
        if (!ativo) return;
        console.error('Erro ao carregar perfil:', erro);
        setErroPerfil('Não foi possível carregar seu perfil do Supabase. Verifique a conexão e tente novamente.');
      } finally {
        if (ativo) setAuthLoading(false);
      }
    };

    carregarPerfil();
    return () => { ativo = false; };
  }, [authReady, user?.id]);

  const usuarioAssinaturaId = user?.id;
  const recarregarAssinatura = useCallback(async () => {
    if (!usuarioAssinaturaId) return null;
    const userId = usuarioAssinaturaId;
    const pedido = ++consultaAssinaturaRef.current;
    const aindaAtual = () => pedido === consultaAssinaturaRef.current && ultimoUsuarioIdRef.current === userId;
    setVerificandoAssinatura(true);
    setErroAssinatura('');
    try {
      const [equipe, registro] = await Promise.all([carregarContextoEquipe(supabase), obterPerfil(supabase, userId)]);
      const ativa = equipe ? equipe.assinatura_ativa === true : await consultarAssinatura(supabase, userId);
      if (!aindaAtual()) return null;
      // Não recarrega o formulário nem altera nome, produtos ou clientes.
      setContextoEquipe(equipe);
      setPerfil(prev => aplicarContextoEquipe({ ...prev, tipoConta: normalizarTipoPerfil(registro?.tipo_conta), assinaturaAtiva: ativa }, equipe));
      return ativa;
    } catch (erro) {
      if (aindaAtual()) setErroAssinatura('Não foi possível verificar o acesso. Confira sua conexão e tente novamente.');
      console.error('Falha na consulta de assinatura:', erro.message);
      return null;
    } finally {
      if (aindaAtual()) setVerificandoAssinatura(false);
    }
  }, [usuarioAssinaturaId]);

  useEffect(() => {
    if (!user?.id || authLoading) return;
    const verificar = () => {
      if (!document.hidden) recarregarAssinatura();
    };
    const timer = setInterval(verificar, 60000);
    window.addEventListener('focus', verificar);
    document.addEventListener('visibilitychange', verificar);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', verificar);
      document.removeEventListener('visibilitychange', verificar);
      consultaAssinaturaRef.current += 1;
    };
  }, [user?.id, authLoading, recarregarAssinatura]);

  const salvarConfiguracoes = async () => {
    if (!user?.id || salvandoPerfil) return;
    const userId = user.id;
    setSalvandoPerfil(true);
    try {
      const salvo = await salvarPerfilProfissional(supabase, userId, perfil);
      if (ultimoUsuarioIdRef.current === userId) {
        setPerfil(aplicarContextoEquipe(salvo, contextoEquipe));
        setNomeEmpresaSalvo(salvo.empresa);
      }
      return salvo;
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const definirTipoPerfil = async (tipo, primeiroAcesso = false) => {
    if (!user?.id) throw new Error('Entre na sua conta para configurar o perfil.');
    const userId = user.id;
    const salvo = await salvarTipoPerfil(supabase, userId, tipo, primeiroAcesso);
    if (ultimoUsuarioIdRef.current !== userId) throw new Error('Sua sessão mudou. Entre novamente.');
    if (primeiroAcesso) setNomeEmpresaSalvo(mapearPerfil(salvo).empresa);
    setPerfil(prev => aplicarContextoEquipe(primeiroAcesso
      ? mapearPerfil(salvo, user.user_metadata?.preferencias_profissionais, prev)
      : { ...prev, tipoConta: normalizarTipoPerfil(salvo.tipo_conta) }, contextoEquipe));
  };

  const targetUid = contextoEquipe?.employer_uid || user?.id;

  const processarFilaSincronizacao = useCallback(async (usuarioUid) => {
    if (isSyncingRef.current || !usuarioUid || ultimoUsuarioIdRef.current !== usuarioUid) return false;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setErroSincronizacao('');
    const aindaAtual = () => ultimoUsuarioIdRef.current === usuarioUid;
    try {
      const pendentes = pendenciasDaConta(await getPendingVisits(), usuarioUid);
      if (aindaAtual()) setPendentesCount(pendentes.length);
      if (!navigator.onLine) return false;
      for (const pendente of pendentes) {
        await sincronizarPendencia({ client: supabase, pendente, userId: usuarioUid,
          salvar: savePendingVisit, remover: removePendingVisit, aindaAtual });
      }
      return true;
    } catch (erro) {
      if (aindaAtual()) setErroSincronizacao('Envio pendente: ' + erro.message);
      return false;
    } finally {
      try {
        const fila = await getPendingVisits();
        if (aindaAtual()) {
          setPendentesCount(pendenciasDaConta(fila, usuarioUid).length);
          setPendentesLegados(fila.filter(p => !p.userId).length);
        }
      } catch (erro) {
        if (aindaAtual()) setErroSincronizacao('Não foi possível ler a fila local: ' + erro.message);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!user?.id || authLoading) return;
    let ativo = true;
    getPendingVisits().then(fila => {
      if (!ativo) return;
      setPendentesCount(pendenciasDaConta(fila, user.id).length);
      setPendentesLegados(fila.filter(p => !p.userId).length);
    }).catch(erro => { if (ativo) setErroSincronizacao(erro.message); });
    const sincronizar = () => { void processarFilaSincronizacao(user.id); };
    sincronizar();
    window.addEventListener('online', sincronizar);
    window.addEventListener('focus', sincronizar);
    return () => {
      ativo = false;
      window.removeEventListener('online', sincronizar);
      window.removeEventListener('focus', sincronizar);
    };
  }, [user?.id, authLoading, processarFilaSincronizacao]);

  const values = {
    user,
    authLoading,
    authReady,
    erroAuth,
    setErroAuth,
    recuperandoSenha,
    setRecuperandoSenha,
    salvarConfiguracoes,
    salvandoPerfil,
    nomeEmpresaSalvo,
    definirTipoPerfil,
    recarregarAssinatura,
    verificandoAssinatura,
    erroAssinatura,
    perfil,
    setPerfil,
    clientes,
    setClientes,
    tela,
    setTela,
    modoEscuro,
    setModoEscuro,
    pendentesCount,
    pendentesLegados,
    erroSincronizacao,
    setPendentesCount,
    isSyncing,
    gradText,
    gradBtn,
    diaAtual,
    dataHojeStr,
    processarFilaSincronizacao,
    targetUid
  };

  if (erroPerfil) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-3">Erro ao carregar seu perfil</h2>
        <p className="text-zinc-300 max-w-md mb-6">{erroPerfil}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-teal-500 text-white font-bold px-6 py-3 rounded-xl"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <AppContext.Provider value={values}>
      {children}
    </AppContext.Provider>
  );
};
