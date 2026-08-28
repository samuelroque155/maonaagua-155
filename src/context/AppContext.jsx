import React, { createContext, useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { getPendingVisits, removePendingVisit } from '../db';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { createReportThumbnail } from '../utils/imageUtils';

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
          const upImg = async (imagem, path) => {
            if (!imagem) return imagem;
            const storageRef = ref(storage, `usuarios/${donoUid}/${path}/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`);
            if (imagem instanceof Blob) {
              await uploadBytes(storageRef, imagem, { contentType: 'image/jpeg' });
            } else if (typeof imagem === 'string' && imagem.startsWith('data:image')) {
              // Mantém compatibilidade com fotos salvas antes desta otimização.
              await uploadString(storageRef, imagem, 'data_url');
            } else {
              return imagem;
            }
            return getDownloadURL(storageRef);
          };

          const fotosPrincipais = pendente.fotosArquivos?.length ? pendente.fotosArquivos : (pendente.fotosBase64 || []);
          const fotosDeAlerta = pendente.fotosAlertaArquivos?.length ? pendente.fotosAlertaArquivos : (pendente.fotosAlertaBase64 || []);
          const novasUrlsPrincipais = await Promise.all(fotosPrincipais.map(foto => upImg(foto, 'visitas')));
          const novasUrlsAlerta = await Promise.all(fotosDeAlerta.map(foto => upImg(foto, 'alertas')));
          const urlsPrincipais = [...new Set([...(pendente.fotosExistentes || []), ...novasUrlsPrincipais].filter(Boolean))];
          const urlsAlerta = [...new Set([...(pendente.fotosAlertaExistentes || []), ...novasUrlsAlerta].filter(Boolean))];

          const completarMiniaturas = async (miniaturasSalvas = [], fotosOriginais = [], limite = 8) => {
            const miniaturas = miniaturasSalvas.filter(Boolean).slice(0, limite);
            const faltam = Math.max(0, limite - miniaturas.length);
            if (faltam === 0) return miniaturas;

            const geradas = await Promise.all(
              fotosOriginais.slice(0, faltam).map(async (foto) => {
                try {
                  return await createReportThumbnail(foto);
                } catch (thumbnailError) {
                  console.warn('Não foi possível criar uma miniatura para o relatório:', thumbnailError);
                  return null;
                }
              })
            );
            return [...miniaturas, ...geradas.filter(Boolean)];
          };

          const miniaturasPrincipais = await completarMiniaturas(pendente.fotosMiniaturas || [], fotosPrincipais, 8);
          const miniaturasAlerta = await completarMiniaturas(pendente.fotosAlertaMiniaturas || [], fotosDeAlerta, 4);
          const visitasRef = collection(db, 'usuarios', donoUid, 'clientes', String(pendente.clienteId), 'visitas');
          const visitaQuery = query(visitasRef, where('vId', '==', pendente.vId || pendente.id));
          const querySnapshot = await getDocs(visitaQuery);

          const visitaSincronizada = {
            ...pendente,
            // Arquivos grandes pertencem somente ao aparelho. No Firestore ficam
            // apenas as URLs, que são o que o relatório e o PDF conseguem abrir.
            fotosBase64: [],
            fotosAlertaBase64: [],
            fotosArquivos: [],
            fotosAlertaArquivos: [],
            fotosExistentes: [],
            fotosAlertaExistentes: [],
            fotos: urlsPrincipais,
            fotosA: urlsAlerta,
            fotosMiniaturas: miniaturasPrincipais,
            fotosAlertaMiniaturas: miniaturasAlerta,
            pendenteSync: false
          };

          if (querySnapshot.empty) {
            // Usa um id estável para não criar duas visitas ao repetir o envio.
            await setDoc(doc(visitasRef, String(pendente.vId || pendente.id)), visitaSincronizada);
          } else {
            await updateDoc(querySnapshot.docs[0].ref, visitaSincronizada);
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

          setAuthLoading(false);

          // A tela inicial não pode aguardar uploads. A sincronização continua em
          // segundo plano e a fila permanece guardada se a internet cair.
          if (navigator.onLine) {
            void processarFilaSincronizacao(usuarioAtual.uid, [], targetId);
          } else {
            setPendentesCount((await getPendingVisits()).length);
          }
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
