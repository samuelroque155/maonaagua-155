import React, { createContext, useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { getPendingVisits, removePendingVisit } from '../db';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext();

const listaQuimica = [
  'CLORO BALDE 10 KL', 'CLORO 1 KL', 'ELEVADOR DE ALCALINIDADE 2 KL', 'BARRILHA 2KL',
  'SULFATO DE ALUMÍNIO 2KL', 'LIMPA BORDAS 1LT', 'CLARIFICANTE 1LT', 'CLARIFICANTE EM GEL',
  'REDUTOR DE PH E ALCALINIDADE 1LT', 'ALGICIDA SEM COBRE 1LT', 'ALGICIDA DE MANUTENÇÃO 1LT',
  'ALGICIDA DE CHOQUE 1LT', 'SAL PRA GERADOR DE CLORO 25 KL'
];

const listaAcessorios = [
  'ESCOVA PRA PISCINA', 'ASPIRADOR', 'CABO TELESCÓPIO 4MTs', 'CABO TELESCÓPIO 6 MTs',
  'CAPA TÉRMICA', 'MANGUEIRA DE ASPIRAÇÃO', 'PENEIRA TIPO PELICANO'
];

// eslint-disable-next-line react-refresh/only-export-components
export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [perfil, setPerfil] = useState({
    empresa: 'Mão Na Água', cidade: 'Sua Cidade', assinaturaAtiva: true,
    whatsappSuporte: '5564999999999', listaProdutos: listaQuimica, listaAcessorios
  });
  const [clientes, setClientes] = useState([]);
  const [tela, setTela] = useState('lista');
  const [modoEscuro, setModoEscuro] = useState(() => {
    try {
      const salvo = localStorage.getItem('maonagua_tema');
      return salvo !== null ? JSON.parse(salvo) : true;
    } catch (error) {
      console.error('Erro ao carregar tema salvo:', error);
      localStorage.removeItem('maonagua_tema');
      return true;
    }
  });

  const [pendentesCount, setPendentesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const targetUidRef = useRef(null);

  const gradText = 'bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent';
  const gradBtn = 'bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 text-white shadow-lg active:scale-[0.98] transition-all';

  const dateObj = new Date();
  const diaAtual = dateObj.getDay();
  const dataHojeStr = dateObj.toDateString();

  useEffect(() => {
    localStorage.setItem('maonagua_tema', JSON.stringify(modoEscuro));
    if (modoEscuro) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [modoEscuro]);

  async function processarFilaSincronizacao(usuarioUid, currentClientesState, tUid) {
    void currentClientesState;
    const donoUid = tUid || targetUidRef.current;
    if (isSyncingRef.current || !navigator.onLine || !usuarioUid || !donoUid) return false;

    isSyncingRef.current = true;
    setIsSyncing(true);
    console.log('🔄 Iniciando sincronização...');

    try {
      const pendentes = await getPendingVisits();
      if (pendentes.length === 0) {
        setPendentesCount(0);
        return true;
      }
      setPendentesCount(pendentes.length);

      for (const pendente of pendentes) {
        try {
          const upImg = async (base64, path) => {
            if (!base64 || !base64.startsWith('data:image')) return base64;
            const storageRef = ref(storage, `usuarios/${donoUid}/${path}/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`);
            await uploadString(storageRef, base64, 'data_url');
            return getDownloadURL(storageRef);
          };

          const urlsPrincipais = await Promise.all((pendente.fotosBase64 || []).map(foto => upImg(foto, 'visitas')));
          const urlsAlerta = await Promise.all((pendente.fotosAlertaBase64 || []).map(foto => upImg(foto, 'alertas')));
          const visitasRef = collection(db, 'usuarios', donoUid, 'clientes', String(pendente.clienteId), 'visitas');
          const visitaQuery = query(visitasRef, where('vId', '==', pendente.id));
          const querySnapshot = await getDocs(visitaQuery);

          if (querySnapshot.empty) {
            await addDoc(visitasRef, {
              ...pendente,
              fotosBase64: [],
              fotosAlertaBase64: [],
              fotos: urlsPrincipais,
              fotosA: urlsAlerta,
              pendenteSync: false
            });
          } else {
            await updateDoc(querySnapshot.docs[0].ref, {
              fotos: urlsPrincipais,
              fotosA: urlsAlerta,
              pendenteSync: false
            });
          }

          await removePendingVisit(pendente.id);
          const restantes = await getPendingVisits();
          setPendentesCount(restantes.length);
        } catch (error) {
          console.error(`❌ Falha no item ${pendente.id}`, error);
          console.log('⚠️ O item será mantido na fila para uma nova tentativa.');
          break;
        }
      }

      const restantes = await getPendingVisits();
      setPendentesCount(restantes.length);
      return restantes.length === 0;
    } catch (error) {
      console.error('❌ Erro na fila:', error);
      return false;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      console.log('🏁 Fila processada.');
    }
  }

  useEffect(() => {
    let unsubscribeLink = null;
    let unsubscribeClientes = null;

    const limparSnapshots = () => {
      unsubscribeLink?.();
      unsubscribeClientes?.();
      unsubscribeLink = null;
      unsubscribeClientes = null;
    };

    const desinscreverAuth = onAuthStateChanged(auth, async (usuarioAtual) => {
      limparSnapshots();
      setUser(usuarioAtual);

      if (!usuarioAtual) {
        targetUidRef.current = null;
        setClientes([]);
        setAuthLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'usuarios', usuarioAtual.uid);
        const userSnap = await getDoc(userDocRef);
        let perfilBase;

        if (userSnap.exists()) {
          perfilBase = { ...userSnap.data().perfil };
        } else {
          perfilBase = { empresa: 'Minha Piscina', cidade: 'Brasil', assinaturaAtiva: false, email: usuarioAtual.email, tipoConta: null };
          await setDoc(userDocRef, { clientes: [], perfil: perfilBase });
        }

        const aplicarVinculo = async (linkData) => {
          const perfilAtual = linkData
            ? {
                ...perfilBase,
                tipoConta: 'funcionario',
                vinculoEmpresa: linkData.employerUid,
                rotas: linkData.rotas || [],
                assinaturaAtiva: true
              }
            : perfilBase;
          const targetId = perfilAtual.tipoConta === 'funcionario' && perfilAtual.vinculoEmpresa
            ? perfilAtual.vinculoEmpresa
            : usuarioAtual.uid;

          targetUidRef.current = targetId;
          setPerfil(prev => ({ ...prev, ...perfilAtual }));

          if (linkData) {
            await updateDoc(userDocRef, {
              'perfil.tipoConta': 'funcionario',
              'perfil.vinculoEmpresa': linkData.employerUid,
              'perfil.rotas': linkData.rotas || [],
              'perfil.assinaturaAtiva': true
            });
          }

          unsubscribeClientes?.();
          unsubscribeClientes = onSnapshot(doc(db, 'usuarios', targetId), (targetSnap) => {
            setClientes(targetSnap.exists() ? targetSnap.data().clientes || [] : []);
          });

          if (navigator.onLine) await processarFilaSincronizacao(usuarioAtual.uid, [], targetId);
          else setPendentesCount((await getPendingVisits()).length);
          setAuthLoading(false);
        };

        const emailKey = usuarioAtual.email?.trim().toLowerCase();
        if (emailKey) {
          unsubscribeLink = onSnapshot(
            doc(db, 'equipes_links', emailKey),
            (linkSnap) => aplicarVinculo(linkSnap.exists() ? linkSnap.data() : null).catch(console.error),
            (error) => {
              console.error('Erro ao acompanhar vínculo da equipe:', error);
              aplicarVinculo(null).catch(console.error);
            }
          );
        } else {
          await aplicarVinculo(null);
        }
      } catch (error) {
        console.error('Erro ao inicializar dados do usuário:', error);
        setAuthLoading(false);
      }
    });

    return () => {
      desinscreverAuth();
      limparSnapshots();
    };
  }, []);

  const targetUid = user && perfil?.tipoConta === 'funcionario' && perfil?.vinculoEmpresa ? perfil.vinculoEmpresa : user?.uid;

  useEffect(() => {
    targetUidRef.current = targetUid;
  }, [targetUid]);

  const atualizarE_SalvarClientes = async (novosClientes) => {
    setClientes(novosClientes);
    if (targetUid) await updateDoc(doc(db, 'usuarios', targetUid), { clientes: novosClientes });
  };

  useEffect(() => {
    const handleOnline = () => {
      if (user && navigator.onLine) processarFilaSincronizacao(user.uid, clientes, targetUid);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, clientes, targetUid]);

  const values = {
    user, authLoading, perfil, setPerfil, clientes, setClientes,
    tela, setTela, modoEscuro, setModoEscuro, pendentesCount, setPendentesCount,
    isSyncing, atualizarE_SalvarClientes, gradText, gradBtn, diaAtual, dataHojeStr,
    processarFilaSincronizacao, targetUid
  };

  return <AppContext.Provider value={values}>{children}</AppContext.Provider>;
};
