import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import OrcamentoAvulso from './OrcamentoAvulso';
import { 
  ArrowLeft, FileText, Wallet
} from 'lucide-react';
import { supabase } from '../supabase.js';
import { lerCacheFinanceiro } from '../services/financeiroService.js';

export default function NovoCliente({ setTela, adicionarCliente, clienteExistente = null, salvarEdicaoCliente }) {
  const { gradText, gradBtn, user } = useContext(AppContext);
  const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const [nome, setNome] = useState(clienteExistente?.nome || '');
  const [rua, setRua] = useState(clienteExistente?.rua || '');
  const [numero, setNumero] = useState(clienteExistente?.numero || '');
  const [bairro, setBairro] = useState(clienteExistente?.bairro || '');
  const [hora, setHora] = useState(clienteExistente?.horaVisita || '');
  const [dias, setDias] = useState(clienteExistente?.diasVisita || []);
  const [telefone, setTelefone] = useState(clienteExistente?.telefone || '');
  const [orcamento, setOrcamento] = useState(false);
  const [financeiroAberto, setFinanceiroAberto] = useState(false);
  const [contas, setContas] = useState([]);
  const [financeiro, setFinanceiro] = useState(() => clienteExistente?.financeiro || {});

  useEffect(() => {
    let ativo = true;
    if (!user?.id) return undefined;
    lerCacheFinanceiro(user.id).then(cache => {
      if (ativo) setContas((cache.contas || []).filter(conta => conta.ativa !== false));
    }).catch(() => {});
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return () => { ativo = false; };
    supabase.from('contas_recebimento').select('id,instituicao,nome_titular,principal,ativa')
      .eq('user_id', user.id).eq('ativa', true).order('principal', { ascending: false })
      .then(({ data, error }) => { if (ativo && !error) setContas(data || []); }).catch(() => {});
    return () => { ativo = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return undefined;
    const atualizar = async () => {
      if (navigator.onLine === false) return;
      const { data, error } = await supabase.from('contas_recebimento').select('id,instituicao,nome_titular,principal,ativa')
        .eq('user_id', user.id).eq('ativa', true).order('principal', { ascending: false });
      if (!error) setContas(data || []);
    };
    window.addEventListener('online', atualizar);
    return () => window.removeEventListener('online', atualizar);
  }, [user?.id]);

  useEffect(() => {
    let ativo = true;
    if (!user?.id || !clienteExistente?.id) return undefined;
    supabase.from('clientes_financeiro').select('*').eq('user_id', user.id).eq('cliente_id', clienteExistente.id).maybeSingle()
      .then(({ data, error }) => { if (ativo && !error && data) setFinanceiro(data); }).catch(() => {});
    return () => { ativo = false; };
  }, [user?.id, clienteExistente?.id]);

  const alternarDia = (i) => {
    if (dias.includes(i)) setDias(dias.filter(d => d !== i));
    else setDias([...dias, i]);
  };

  const handleSalvar = () => {
    const dados = { nome, rua, numero, bairro, dias, hora, telefone, financeiro: Object.keys(financeiro).length ? { ...financeiro, telefone_cobranca: financeiro.telefone_cobranca ?? telefone } : {} };
    if (clienteExistente) salvarEdicaoCliente(clienteExistente.id, dados);
    else adicionarCliente(dados);
  };

  if (orcamento && !clienteExistente) return <OrcamentoAvulso voltar={() => setOrcamento(false)} />;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans pb-10 transition-colors duration-300">
      <header className="flex items-center gap-2 mb-10 mt-2">
        <button onClick={() => setTela(clienteExistente ? 'relatorio' : 'lista')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20} /></button>
        <h2 className={`flex-1 min-w-0 text-xl sm:text-2xl font-black ${gradText}`}>{clienteExistente ? 'Editar Cadastro' : 'Novo Cliente'}</h2>
        {!clienteExistente && <button type="button" onClick={() => setOrcamento(true)} className="shrink-0 flex items-center gap-1.5 rounded-xl border border-teal-300 dark:border-teal-700 px-3 py-2.5 text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-zinc-900"><FileText size={16} aria-hidden="true" />Orçamento</button>}
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Nome Completo</span>
          <input placeholder="Ex: Samuel Silva" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <section className="overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <button type="button" onClick={() => setFinanceiroAberto(v => !v)} aria-expanded={financeiroAberto} className="flex w-full items-center gap-3 p-4 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"><Wallet size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black">Financeiro do cliente</span><span className="block text-[11px] text-zinc-500 dark:text-zinc-400">Mensalidade, vencimento e forma de cobrança</span></span>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-300">{financeiroAberto ? 'Fechar' : 'Configurar'}</span>
          </button>
          {financeiroAberto && <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Valor mensal (R$)<input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0,00" value={financeiro.valor_mensal || ''} onChange={e => setFinanceiro(v => ({ ...v, valor_mensal: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" /></label>
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Dia do vencimento<input type="number" min="1" max="31" placeholder="1 a 31" value={financeiro.dia_vencimento || ''} onChange={e => setFinanceiro(v => ({ ...v, dia_vencimento: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" /></label>
            </div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">WhatsApp para cobrança<input type="tel" inputMode="tel" placeholder="DDD + telefone" value={financeiro.telefone_cobranca ?? telefone} onChange={e => setFinanceiro(v => ({ ...v, telefone_cobranca: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" /></label>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Forma de pagamento<select value={financeiro.forma_pagamento || 'pix'} onChange={e => setFinanceiro(v => ({ ...v, forma_pagamento: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"><option value="pix">Pix</option><option value="link">Link de pagamento</option><option value="infinitepay">InfinitePay</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option></select></label>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Conta de recebimento<select value={financeiro.conta_recebimento_id || ''} onChange={e => setFinanceiro(v => ({ ...v, conta_recebimento_id: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"><option value="">Usar conta principal</option>{contas.map(a => <option key={a.id} value={a.id}>{a.instituicao} · {a.nome_titular}{a.principal ? ' (principal)' : ''}</option>)}</select>{!contas.length && <span className="mt-1 block font-normal text-zinc-500">Cadastre contas em Financeiro → Contas.</span>}</label>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Descrição da cobrança<input maxLength={300} placeholder="Manutenção mensal de piscina" value={financeiro.descricao || ''} onChange={e => setFinanceiro(v => ({ ...v, descricao: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" /></label>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Link de pagamento (opcional)<input type="url" placeholder="https://..." value={financeiro.link_pagamento || ''} onChange={e => setFinanceiro(v => ({ ...v, link_pagamento: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" /></label>
            <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"><input type="checkbox" checked={financeiro.recorrencia_ativa === true} onChange={e => setFinanceiro(v => ({ ...v, recorrencia_ativa: e.target.checked }))} className="mt-0.5 accent-teal-600" /><span>Gerar mensalidade automaticamente no Mão na Água. Isso não debita nem confirma pagamentos.</span></label>
            <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">Alterar este contrato não altera cobranças antigas; cada mensalidade mantém seu valor original.</p>
          </div>}
        </section>

        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Rua</span>
          <input placeholder="Ex: Rua das Flores" value={rua} onChange={e => setRua(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="flex gap-3">
          <div className="space-y-2 flex-1">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Número</span>
            <input placeholder="Ex: 123" value={numero} onChange={e => setNumero(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
          </div>
          <div className="space-y-2 flex-[2]">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Bairro</span>
            <input placeholder="Ex: Setor Central" value={bairro} onChange={e => setBairro(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Hora da Visita</span>
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Telefone / WhatsApp</span>
          <input placeholder="Ex: 5564999999999" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="pt-4">
          <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 ml-2 uppercase tracking-wider">Dias de Limpeza Mensal</p>
          <div className="grid grid-cols-4 gap-2.5">
            {diasDaSemanaNomes.map((d, i) => (
              <button key={i} onClick={() => alternarDia(i)} className={`py-3.5 rounded-[1rem] text-xs font-bold border transition-all ${dias.includes(i) ? gradBtn + " shadow-md" : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-teal-300'}`}>{d.substring(0, 3)}</button>
            ))}
          </div>
        </div>

        <button onClick={handleSalvar} className={`w-full py-5 rounded-[1.25rem] font-bold text-lg mt-8 ${gradBtn}`}>{clienteExistente ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR CLIENTE'}</button>
      </div>
    </div>
  );
}
