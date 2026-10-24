import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { lerLembretes, salvarLembretes, solicitarPermissaoLembretes } from '../services/lembretesService';
import { configurarPush } from '../services/pushService';
import { supabase } from '../supabase';
import { carregarPreferencias, salvarPreferencias, padraoLembretes } from '../services/preferenciasLembretesService.js';
export default function ConfiguracaoLembretes({ clienteSupabase = supabase, configurar = configurarPush }) {
  const { user, gradBtn } = useContext(AppContext);
  const [opcoes, setOpcoes] = useState(() => ({ ...padraoLembretes, ...lerLembretes(user.id) }));
  const [salvas, setSalvas] = useState(opcoes);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let ativo = true;
    carregarPreferencias(clienteSupabase, user.id, lerLembretes(user.id)).then(valor => {
      if (ativo) { setOpcoes(valor); setSalvas(valor); setCarregado(user.id); setErro(''); }
    }).catch(() => { if (ativo) { setCarregado(false); setErro('Não foi possível carregar as preferências. Confira a conexão e a migração deste ambiente.'); } });
    return () => { ativo = false; };
  }, [clienteSupabase, user.id]);
  const salvar = async e => {
    e.preventDefault(); setOcupado(true); setErro(''); setMensagem('');
    try {
      if (opcoes.ativo) await solicitarPermissaoLembretes();
      if (opcoes.ativo || salvas.ativo) await configurar(clienteSupabase, user.id, { ...opcoes, preservarInscricao: true }, import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY);
      await salvarPreferencias(clienteSupabase, user.id, opcoes);
      salvarLembretes(user.id, opcoes); setSalvas(opcoes); setMensagem('Preferências salvas nesta conta.');
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  };
  const alterar = campo => e => { setMensagem(''); setOpcoes(v => ({ ...v, [campo]: e.target.value })); };
  const campo = 'block w-full mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100';
  return <form onSubmit={salvar} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-4">
    <h3 className="font-bold text-sm text-teal-600 uppercase">Notificações de limpeza</h3>
    <fieldset disabled={ocupado || carregado !== user.id} className="space-y-4 disabled:opacity-60">
      <label className="flex gap-3 text-sm items-center"><input type="checkbox" checked={opcoes.ativo} onChange={e => setOpcoes(v => ({ ...v, ativo: e.target.checked }))} />Lembrar das piscinas pendentes</label>
      <label className="block text-sm">Tipo de lembrete<select value={opcoes.modo} onChange={alterar('modo')} className={campo}><option value="resumo">Resumo diário</option><option value="individual">Lembretes individuais</option><option value="ambos">Resumo e individuais</option></select></label>
      {opcoes.modo !== 'individual' && <label className="block text-sm">Horário do resumo<input required type="time" value={opcoes.horario} onChange={alterar('horario')} className={campo} /></label>}
      {opcoes.modo !== 'resumo' && <label className="block text-sm">Avisar antes da limpeza<select value={opcoes.antecedencia} onChange={alterar('antecedencia')} className={campo}><option value={15}>15 minutos antes</option><option value={30}>30 minutos antes</option><option value={60}>1 hora antes</option></select></label>}
      <label className="block text-sm">Fuso horário<select value={opcoes.fuso} onChange={alterar('fuso')} className={campo}>{[...new Set(['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Rio_Branco', 'America/Noronha', opcoes.fuso])].map(fuso => <option key={fuso} value={fuso}>{fuso === 'America/Sao_Paulo' ? 'Brasília' : fuso.replace('America/', '').replaceAll('_', ' ')}</option>)}</select></label>
      <button disabled={opcoes.ativo && !import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY} className={`min-h-11 px-4 rounded-xl text-sm font-bold disabled:opacity-40 ${gradBtn}`}>{ocupado ? 'Salvando…' : 'Salvar lembretes'}</button>
    </fieldset>
    <p className="text-xs text-zinc-500">O resumo mostra somente as limpezas pendentes. Clientes sem horário continuam na agenda e não recebem lembretes individuais. Autorize as notificações em cada aparelho para receber com o app fechado.</p>
    {!import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY && <p className="text-xs text-amber-600">Este ambiente ainda precisa da chave pública de notificações.</p>}
    {erro && <p role="alert" className="text-xs text-rose-500">{erro}</p>}
    {mensagem && <p role="status" className="text-xs text-teal-600">{mensagem}</p>}
  </form>;
}
