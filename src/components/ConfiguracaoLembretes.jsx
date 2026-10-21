import { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { lerLembretes, salvarLembretes, solicitarPermissaoLembretes } from '../services/lembretesService';
import { configurarPush } from '../services/pushService';
import { supabase } from '../supabase';
export default function ConfiguracaoLembretes() {
  const { user } = useContext(AppContext);
  const [opcoes, setOpcoes] = useState(() => lerLembretes(user.id));
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const alterar = async nova => {
    setOcupado(true); setErro('');
    try {
      if (nova.ativo && !opcoes.ativo) await solicitarPermissaoLembretes();
      if (nova.ativo || opcoes.ativo) await configurarPush(supabase, user.id, nova, import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY);
      salvarLembretes(user.id, nova); setOpcoes(nova);
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  };
  return <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-4">
    <h3 className="font-bold text-sm text-teal-600 uppercase">Notificações de limpeza</h3>
    <label className="flex gap-3 text-sm items-center"><input type="checkbox" checked={opcoes.ativo} disabled={ocupado || (!opcoes.ativo && !import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY)} onChange={e => alterar({ ...opcoes, ativo: e.target.checked })} />Lembrar das piscinas pendentes</label>
    <label className="block text-sm">Horário do lembrete (Brasília)<input type="time" value={opcoes.horario} disabled={ocupado} onChange={e => alterar({ ...opcoes, horario: e.target.value })} className="block mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3" /></label>
    <p className="text-xs text-zinc-500">Horário de Brasília. Com o envio pelo servidor ativado, o aviso chega mesmo com o app fechado. Autorize as notificações neste aparelho; a entrega também depende da conexão e das permissões do celular.</p>
    {!import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY && <p className="text-xs text-amber-600">Envio com o app fechado aguardando ativação no servidor.</p>}
    {erro && <p role="alert" className="text-xs text-rose-500">{erro}</p>}
  </section>;
}
