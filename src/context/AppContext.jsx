import React, { createContext, useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { getPendingVisits, savePendingVisit, removePendingVisit } from '../db';
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
    whatsappSuporte: '5564999999999', listaProdutos: listaQuimica, listaAcessorios: listaAcessorios
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

  // Design System
  const gradText = "bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent";
  const gradBtn = "bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 text-white shadow-lg active:scale-[0.98] transition-all";

  const dateObj = new Date();
  const diaAtual = dateObj.getDay();
  const dataHojeStr = dateObj.toDateString();

  useEffect(() => {
    localStorage.setItem('maonagua_tema', JSON.stringify(modoEscuro));
    if (modoEscuro) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [modoEscuro]);

  useEffect(() => {
    const desinscrever = onAuthStateChanged(auth, async (usuarioAtual) => {
      setUser(usuarioAtual);
      if (usuarioAtual) {
        const docRef = doc(db, 'usuarios', usuarioAtual.uid);
        const docSnap = await getDoc(docRef);
        
        let perfilAtual;
        let clientesAtuais = [];
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          perfilAtual = { ...data.perfil };
        } else {
          perfilAtual = { empresa: 'Minha Piscina', cidade: 'Brasil', assinaturaAtiva: false, email: usuarioAtual.email, tipoConta: null };
          await setDoc(docRef, { clientes: [], perfil: perfilAtual });
        }

        // Verifica se é funcionário através da tabela de vínculos
        const emailKey = usuarioAtual.email ? usuarioAtual.email.toLowerCase() : '';
        if (emailKey) {
          const linkDocRef = doc(db, 'equipes_links', emailKey);
          const linkSnap = await getDoc(linkDocRef);
          
          if (linkSnap.exists()) {
            const linkData = linkSnap.data();
            perfilAtual = { ...perfilAtual, tipoConta: 'funcionario', vinculoEmpresa: linkData.employerUid, rotas: linkData.rotas || [] };
            await updateDoc(docRef, { 'perfil.tipoConta': 'funcionario', 'perfil.vinculoEmpresa': linkData.employerUid, 'perfil.rotas': linkData.rotas || [] });
          }
        }
        
        setPerfil(prev => ({ ...prev, ...perfilAtual }));

        // Carrega clientes do alvo correto e define listener real-time
        const targetId = perfilAtual.tipoConta === 'funcionario' && perfilAtual.vinculoEmpresa 
          ? perfilAtual.vinculoEmpresa 
          : usuarioAtual.uid;

        const unsubscribeSnapshot = onSnapshot(doc(db, 'usuarios', targetId), (targetSnap) => {
          let clientesAtuais = [];
          if (targetSnap.exists()) {
            clientesAtuais = targetSnap.data().clientes || [];
          }
          setClientes(clientesAtuais);
          
          if (navigator.onLine && !isSyncingRef.current) {
            // Pode tentar sincronizar se houver pendências, mas cuidado com loop
            // isSyncingRef evita chamadas sobrepostas
          }
        });
        
        // Cleanup do snapshot ao desmontar
        window.unsubscribeClientes = unsubscribeSnapshot;

        // Tenta processar fila na inicialização
        if (navigator.onLine) {
          processarFilaSincronizacao(usuarioAtual.uid, [], targetId);
        } else {
          const pendentes = await getPendingVisits();
          setPendentesCount(pendentes.length);
        }
      }
      setAuthLoading(false);
    });
    return () => {
      desinscrever();
      if (window.unsubscribeClientes) window.unsubscribeClientes();
    };
  }, []);

  const targetUid = user && perfil?.tipoConta === 'funcionario' && perfil?.vinculoEmpresa ? perfil.vinculoEmpresa : user?.uid;

  const atualizarE_SalvarClientes = async (novosClientes) => {
    setClientes(novosClientes);
    if (targetUid) await updateDoc(doc(db, 'usuarios', targetUid), { clientes: novosClientes });
  };

  async function processarFilaSincronizacao(usuarioUid, currentClientesState, tUid = targetUid) {
    if (isSyncingRef.current || !navigator.onLine || !usuarioUid) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    console.log("🔄 Iniciando sincronização...");

    try {
      const pendentes = await getPendingVisits();
      if (pendentes.length === 0) {
        setPendentesCount(0);
        return;
      }
      setPendentesCount(pendentes.length);

      for (const pendente of pendentes) {
        try {
          const upImg = async (base64, path) => {
            if (!base64 || !base64.startsWith('data:image')) return base64;
            const storageRef = ref(storage, `usuarios/${usuarioUid}/${path}/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`);
            await uploadString(storageRef, base64, 'data_url');
            return await getDownloadURL(storageRef);
          };

          const urlsPrincipais = await Promise.all(pendente.fotosBase64.map(foto => upImg(foto, 'visitas')));
          const urlsAlerta = await Promise.all(pendente.fotosAlertaBase64.map(foto => upImg(foto, 'alertas')));

          const q = query(
            collection(db, 'usuarios', tUid, 'clientes', String(pendente.clienteId), 'visitas'),
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
          const nextCount = await getPendingVisits();
          setPendentesCount(nextCount.length);
        } catch (err) {
          console.error(`❌ Falha no item ${pendente.id}`, err);
          // Se for erro de conexão/rede, interrompe a sincronização temporariamente para reprocessar mais tarde
          if (!navigator.onLine || err.message?.includes('network') || err.code?.includes('network') || err.message?.includes('failed-precondition')) {
            console.log("⚠️ Interrompendo sincronização por erro de conexão/rede. O item será mantido na fila.");
            break;
          }
          // Outros erros persistentes (dados corrompidos, permissão, etc.) remove da fila para não travar
          await removePendingVisit(pendente.id);
          const nextCount = await getPendingVisits();
          setPendentesCount(nextCount.length);
        }
      }
    } catch (error) {
      console.error("❌ Erro na fila:", error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      console.log("🏁 Fila processada.");
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      if (user && navigator.onLine) {
        processarFilaSincronizacao(user.uid, clientes, targetUid);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, clientes]);

  const values = {
    user, authLoading, perfil, setPerfil, clientes, setClientes, 
    tela, setTela, modoEscuro, setModoEscuro, pendentesCount, setPendentesCount,
    isSyncing, atualizarE_SalvarClientes, gradText, gradBtn, diaAtual, dataHojeStr,
    processarFilaSincronizacao, targetUid
  };

  return <AppContext.Provider value={values}>{children}</AppContext.Provider>;
};
