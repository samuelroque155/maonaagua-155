
import React, { useContext, useState, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { fileToBase64 } from '../utils/imageUtils';
import { AppContext } from '../context/AppContext.jsx';
import {
  ArrowLeft, Pencil, ShoppingCart, Plus, Trash2, Save, Briefcase, User
} from 'lucide-react';

export default function Configuracoes({ setTela, salvarConfiguracoes, handleSair }) {
  const { user, perfil, setPerfil, gradText, gradBtn, definirTipoPerfil, salvandoPerfil } = useContext(AppContext);
  const funcionario = perfil.tipoConta === 'funcionario';
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState('');
  const pedidoFoto = useRef(0);
  useEffect(() => () => { pedidoFoto.current += 1; }, [user?.id]);

  const selecionarFoto = async evento => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;
    const pedido = ++pedidoFoto.current;
    setErroFoto('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      setErroFoto('Escolha uma foto ou logo em JPEG, PNG ou WebP.');
      return;
    }
    setPreparandoFoto(true);
    try {
      const imagem = await imageCompression(arquivo, { maxSizeMB: 0.15, maxWidthOrHeight: 600,
        useWebWorker: true, fileType: arquivo.type === 'image/png' ? 'image/png' : 'image/jpeg' });
      const preview = await fileToBase64(imagem);
      if (pedido !== pedidoFoto.current) return;
      setPerfil(prev => ({ ...prev, fotoPerfilNova: imagem, fotoPerfilUrl: preview, fotoPerfilRemover: false }));
    } catch {
      if (pedido === pedidoFoto.current) setErroFoto('Não foi possível preparar esta imagem. Tente outra foto.');
    } finally { if (pedido === pedidoFoto.current) setPreparandoFoto(false); }
  };

  const alternarTipoConta = async (novoTipo) => {
    if (!user) {
      alert('Você precisa estar conectado para alterar o tipo de conta.');
      return;
    }

    try {
      await definirTipoPerfil(novoTipo);
      alert('Tipo de conta alterado para: ' + novoTipo);
    } catch (e) {
      console.error('Erro inesperado ao alterar tipo de conta:', e);
      alert('Erro ao alterar tipo de conta: ' + (e.message || 'Erro inesperado'));
    }
  };

  const addProduto = () => {
    const input = document.getElementById('novoProdInput');
    if (input?.value.trim()) {
      setPerfil(prev => ({
        ...prev,
        listaProdutos: [...prev.listaProdutos, input.value.trim()]
      }));
      input.value = '';
    }
  };

  const addAcessorio = () => {
    const input = document.getElementById('novoAcessInput');
    if (input?.value.trim()) {
      setPerfil(prev => ({
        ...prev,
        listaAcessorios: [...prev.listaAcessorios, input.value.trim()]
      }));
      input.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans transition-colors duration-300 pb-20">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => setTela('lista')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h2 className={`text-2xl font-black ${gradText}`}>Configurações</h2>
      </header>

      <div className="space-y-8">
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-6 flex items-center gap-2 uppercase tracking-widest">
            <Pencil size={16} className="text-teal-500" /> Perfil Profissional
          </h3>
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-bold text-teal-600 dark:text-teal-400">Foto de perfil ou logo</p>
              <div className="flex items-center gap-4">
                {perfil.fotoPerfilUrl
                  ? <img src={perfil.fotoPerfilUrl} alt="Sua foto ou logo" className="w-20 h-20 rounded-2xl object-contain bg-slate-50 border border-zinc-200 p-1" />
                  : <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center"><User size={32} className="text-teal-500" /></div>}
                <div className="flex-1 space-y-2">
                  <label className="block text-sm font-bold text-teal-600 cursor-pointer">
                    {preparandoFoto ? 'Preparando imagem...' : 'Escolher foto ou logo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto ou logo" disabled={preparandoFoto || salvandoPerfil} onChange={selecionarFoto} className="block w-full mt-2 text-xs" />
                  </label>
                  {(perfil.fotoPerfilUrl || perfil.fotoPerfilCaminho) && <button type="button" disabled={salvandoPerfil || preparandoFoto} onClick={() => setPerfil(prev => ({ ...prev, fotoPerfilNova: null, fotoPerfilUrl: '', fotoPerfilRemover: true }))} className="text-xs text-rose-500">Remover imagem</button>}
                </div>
              </div>
              <p className="text-xs text-zinc-500">{funcionario ? 'Sua empresa gerencia clientes, rotas e relatórios. Aqui você pode alterar sua foto de perfil.' : 'A imagem aparecerá nos relatórios junto com seu nome profissional ou da empresa. Toque em Salvar alterações para confirmar.'}</p>
              {erroFoto && <p role="alert" className="text-xs text-rose-500">{erroFoto}</p>}
            </div>
            {!funcionario && <><div className="space-y-2">
              <span className="text-[10px] font-black text-teal-600 dark:text-teal-500 uppercase tracking-widest ml-1">Nome da Empresa</span>
              <input value={perfil.empresa || ''} onChange={e => setPerfil({ ...perfil, empresa: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-400 text-sm font-bold" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black text-teal-600 dark:text-teal-500 uppercase tracking-widest ml-1">Sua Cidade / Estado</span>
              <input value={perfil.cidade || ''} onChange={e => setPerfil({ ...perfil, cidade: e.target.value })} placeholder="Ex: Jataí - GO" className="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:border-teal-400 text-sm font-bold" />
            </div>
            </>}
          </div>
        </section>

        {!funcionario && <><section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm mb-4 uppercase tracking-wider text-teal-600 flex items-center gap-2">
            <ShoppingCart size={16} /> Meus Produtos
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input id="novoProdInput" type="text" placeholder="Ex: Cloro 10kg" className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-teal-400" />
              <button onClick={addProduto} className="bg-teal-500 text-white p-3 rounded-xl">
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 scrollbar-hide border-t border-zinc-50 dark:border-zinc-800 mt-2 pt-3">
              {(perfil.listaProdutos || []).map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-[11px] font-medium">
                  <span className="text-zinc-700 dark:text-zinc-300">{p}</span>
                  <button onClick={() => setPerfil(prev => ({ ...prev, listaProdutos: prev.listaProdutos.filter((_, idx) => idx !== i) }))} className="text-rose-400 hover:text-rose-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm mb-4 uppercase tracking-wider text-teal-600 flex items-center gap-2">
            <Briefcase size={16} /> Meus Acessórios
          </h3>
          <div className="flex gap-2">
            <input id="novoAcessInput" type="text" placeholder="Ex: Aspirador" className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-teal-400" />
            <button onClick={addAcessorio} className="bg-teal-500 text-white p-3 rounded-xl">
              <Plus size={20} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {(perfil.listaAcessorios || []).map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-[11px] font-medium">
                <span>{item}</span>
                <button onClick={() => setPerfil(prev => ({ ...prev, listaAcessorios: prev.listaAcessorios.filter((_, idx) => idx !== i) }))} className="text-rose-400 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <Briefcase size={16} className="text-sky-500" /> Tipo de Conta
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => alternarTipoConta('autonomo')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${perfil.tipoConta === 'autonomo' ? 'bg-teal-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-teal-500'}`}
            >
              <User size={16} /> Autônomo
            </button>
            <button
              onClick={() => alternarTipoConta('empresa')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${perfil.tipoConta === 'empresa' ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-sky-500'}`}
            >
              <Briefcase size={16} /> Empresa
            </button>
          </div>
        </section>

        </>}
        <button onClick={salvarConfiguracoes} disabled={salvandoPerfil || preparandoFoto} className={`w-full py-4 rounded-xl font-bold ${gradBtn} flex items-center justify-center gap-2 disabled:opacity-50`}>
          <Save size={20} /> {salvandoPerfil ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
        </button>

        <button onClick={handleSair} className="w-full py-4 text-rose-500 font-bold border border-rose-200 dark:border-rose-900/30 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
          SAIR DA CONTA
        </button>
      </div>
    </div>
  );
}
