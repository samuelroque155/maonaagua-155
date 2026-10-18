
import { supabase } from '../supabase';
import React, { createContext, useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import {
  doc,
  updateDoc,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import {
  getPendingVisits,
  removePendingVisit
} from '../db';
import {
  ref,
  uploadString,
  getDownloadURL
} from 'firebase/storage';

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

// eslint-disable-next-line react-refresh/only-export-components
export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const [perfil, setPerfil] = useState({
    empresa: 'Mão Na Água',
    cidade: 'Sua Cidade',
    assinaturaAtiva: true,
    whatsappSuporte: '5564999999999',
    listaProdutos: listaQuimica,
    listaAcessorios: listaAcessorios
  });

  const [clientes, setClientes] = useState([]);
  const [tela, setTela] = useState('lista');

  const [modoEscuro, setModoEscuro] = useState(() => {
    const salvo = localStorage.getItem('maonagua_tema');
    return salvo !== null ? JSON.parse(salvo) : true;
  });

  const [pendentesCount, setPendentesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const gradText =
    'bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent';

  const gradBtn =
    'bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 text-white shadow-lg active:scale-[0.98] transition-all';

  const dateObj = new Date();
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

  // Observa a sessão do Supabase.
  useEffect(() => {
    let ativo = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!ativo) return;

      const usuarioAtual = session?.user ?? null;

      setUser(usuarioAtual);
      setClientes([]);
      setAuthReady(true);
      setAuthLoading(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  // O perfil de funcionário e o vínculo com a empresa
  // ainda precisam ser migrados para o Supabase.
  const targetUid =
    user &&
    perfil?.tipoConta === 'funcionario' &&
    perfil?.vinculoEmpresa
      ? perfil.vinculoEmpresa
      : user?.id;

  // ATENÇÃO: esta função ainda grava no Firebase.
  // Não considera concluída a migração dos clientes.
  const atualizarE_SalvarClientes = async (novosClientes) => {
    if (!targetUid) {
      throw new Error('Não há usuário identificado para salvar os clientes.');
    }

    await updateDoc(doc(db, 'usuarios', targetUid), {
      clientes: novosClientes
    });

    setClientes(novosClientes);
  };

  // Sincronização antiga de fotos e visitas offline.
  // Continua dependendo do Firebase e precisa ser migrada.
  async function processarFilaSincronizacao(
    usuarioUid,
    currentClientesState,
    tUid = targetUid
  ) {
    if (
      isSyncingRef.current ||
      !navigator.onLine ||
      !usuarioUid ||
      !tUid
    ) {
      return;
    }

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
          const upImg = async (base64, caminho) => {
            if (!base64 || !base64.startsWith('data:image')) {
              return base64;
            }

            const storageRef = ref(
              storage,
              `usuarios/${usuarioUid}/${caminho}/${Date.now()}_${Math.floor(
                Math.random() * 1000
              )}.jpg`
            );

            await uploadString(storageRef, base64, 'data_url');
            return await getDownloadURL(storageRef);
          };

          const urlsPrincipais = await Promise.all(
            (pendente.fotosBase64 || []).map((foto) =>
              upImg(foto, 'visitas')
            )
          );

          const urlsAlerta = await Promise.all(
            (pendente.fotosAlertaBase64 || []).map((foto) =>
              upImg(foto, 'alertas')
            )
          );

          const q = query(
            collection(
              db,
              'usuarios',
              tUid,
              'clientes',
              String(pendente.clienteId),
              'visitas'
            ),
            where('vId', '==', pendente.id)
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            await updateDoc(querySnapshot.docs[0].ref, {
              fotos: urlsPrincipais,
              fotosA: urlsAlerta,
              pendenteSync: false
            });
          }

          await removePendingVisit(pendente.id);

          const restantes = await getPendingVisits();
          setPendentesCount(restantes.length);
        } catch (erro) {
          console.error(
            `Erro ao sincronizar a visita ${pendente.id}:`,
            erro
          );

          if (
            !navigator.onLine ||
            erro.message?.includes('network') ||
            erro.code?.includes('network') ||
            erro.message?.includes('failed-precondition')
          ) {
            break;
          }

          // Mantém o comportamento anterior do projeto.
          // O tratamento de erros será revisado na migração da fila.
          await removePendingVisit(pendente.id);

          const restantes = await getPendingVisits();
          setPendentesCount(restantes.length);
        }
      }
    } catch (erro) {
      console.error('Erro na fila de sincronização:', erro);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }

  // Mantém o evento de retorno da conexão.
  // A sincronização abaixo ainda utiliza Firebase.
  useEffect(() => {
    const handleOnline = () => {
      if (user && navigator.onLine) {
        processarFilaSincronizacao(user.id, clientes, targetUid);
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user, clientes, targetUid]);

  const values = {
    user,
    authLoading,
    authReady,
    perfil,
    setPerfil,
    clientes,
    setClientes,
    tela,
    setTela,
    modoEscuro,
    setModoEscuro,
    pendentesCount,
    setPendentesCount,
    isSyncing,
    atualizarE_SalvarClientes,
    gradText,
    gradBtn,
    diaAtual,
    dataHojeStr,
    processarFilaSincronizacao,
    targetUid
  };

  return (
    <AppContext.Provider value={values}>
      {children}
    </AppContext.Provider>
  );
};
