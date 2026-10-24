import { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft, BadgeCheck, Banknote, CalendarDays, Check, CircleAlert,
  Clock3, Copy, ExternalLink, History, Link2, LoaderCircle, Plus, RefreshCw,
  Search, Send, ShieldCheck, X
} from 'lucide-react';
import { AppContext } from '../context/AppContext.jsx';
import {
  INSTITUICOES, calcularResumo, centavos, chavePixTemFormatoPlausivel,
  competenciaMes, gerarPixCopiaECola, moeda, mensagemCobranca, saldoCobranca,
  statusCobranca
} from '../services/financeiro.js';
import {
  carregarFinanceiro, cancelarCobranca, estornarPagamento, lerCacheFinanceiro,
  registrarPagamentoManual, salvarContaRecebimento
} from '../services/financeiroService.js';
import { estadoFinanceiroVazio, sincronizarFilaFinanceira } from '../services/financeiroSync.js';
import { supabase } from '../supabase.js';
import { urlWhatsApp } from '../services/whatsappService.js';

const CHAVES = [
  ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'Email'], ['telefone', 'Telefone'], ['aleatoria', 'Aleatória']
];
const ABAS = [['resumo', 'Resumo'], ['cobrancas', 'Cobranças'], ['contas', 'Contas']];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ESTADOS = {
  pago: ['Pago', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'],
  pendente: ['Pendente', 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'],
  atrasado: ['Atrasado', 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'],
  parcial: ['Parcial', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'],
  cancelada: ['Cancelado', 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300']
};
const campo = 'w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-teal-500';
const botaoBase = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-[.98] disabled:opacity-50';

function Status({ status }) {
  const [rotulo, cores] = ESTADOS[status] || ESTADOS.pendente;
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${cores}`}>{rotulo}</span>;
}

function Modal({ titulo, fechar, children, compact = false }) {
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
    <section role="dialog" aria-modal="true" aria-label={titulo} className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] border border-zinc-200 bg-slate-50 p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-[2rem] ${compact ? 'max-w-md' : 'max-w-xl'}`}>
      <header className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-zinc-900 dark:text-white">{titulo}</h2><button type="button" onClick={fechar} aria-label="Fechar" className="rounded-xl bg-white p-2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"><X size={18} /></button></header>
      {children}
    </section>
  </div>;
}

export default function Financeiro({ voltar }) {
  const { user, perfil, clientes, gradText, gradBtn } = useContext(AppContext);
  const hoje = new Date();
  const [competencia, setCompetencia] = useState(() => `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [estado, setEstado] = useState(() => estadoFinanceiroVazio());
  const [aba, setAba] = useState('resumo');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState('');
  const [busca, setBusca] = useState('');
  const [clienteAberto, setClienteAberto] = useState(null);
  const [cobrancaAberta, setCobrancaAberta] = useState(null);
  const [contaEditando, setContaEditando] = useState(null);
  const [pagamentoAberto, setPagamentoAberto] = useState(null);
  const [mensagemAberta, setMensagemAberta] = useState(null);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [pixImagem, setPixImagem] = useState('');

  const carregar = useCallback(async ({ semCarga = false } = {}) => {
    if (!user?.id || perfil?.tipoConta === 'funcionario') return;
    setCarregando(true); setErro('');
    try {
      if (!semCarga) {
        const cache = await lerCacheFinanceiro(user.id);
        setEstado(cache);
      }
      const dados = await carregarFinanceiro(supabase, user.id, competencia);
      setEstado(dados);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar o financeiro.');
    } finally { setCarregando(false); }
  }, [user, perfil, competencia]);

  useEffect(() => { const timer = setTimeout(() => carregar(), 0); return () => clearTimeout(timer); }, [carregar]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return undefined;
    const sincronizar = async () => {
      if (navigator.onLine === false) return;
      try {
        const cache = await lerCacheFinanceiro(user.id);
        if (!cache.fila?.length) return;
        const atualizado = await sincronizarFilaFinanceira(supabase, cache, user.id);
        setEstado(atualizado);
        if (!atualizado.fila?.length) void carregar({ semCarga: true });
      } catch { /* A fila permanece no IndexedDB para a próxima tentativa. */ }
    };
    window.addEventListener('online', sincronizar);
    return () => window.removeEventListener('online', sincronizar);
  }, [user?.id, carregar]);

  const mapaClientes = useMemo(() => new Map((clientes || []).map(c => [String(c.id), c])), [clientes]);
  const mapaContas = useMemo(() => new Map((estado.contas || []).map(a => [String(a.id), a])), [estado.contas]);
  const porCobranca = useCallback(id => estado.pagamentos.filter(p => p.cobranca_id === id), [estado.pagamentos]);
  const cobrancasDoMes = useMemo(() => estado.cobrancas.filter(c => String(c.competencia).slice(0, 7) === competencia), [estado.cobrancas, competencia]);
  const resumo = useMemo(() => calcularResumo(estado.cobrancas, estado.pagamentos, competencia), [estado.cobrancas, estado.pagamentos, competencia]);
  const clientesFinanceiros = useMemo(() => {
    const filtrados = (estado.cadastros || []).filter(c => cadastroVisivel(c, busca, mapaClientes));
    return filtrados.map(c => ({ cadastro: c, cliente: mapaClientes.get(String(c.cliente_id)) })).filter(x => x.cliente);
  }, [estado.cadastros, mapaClientes, busca]);
  const historico = useMemo(() => [...estado.cobrancas].sort((a, b) => String(b.created_at || b.competencia).localeCompare(String(a.created_at || a.competencia))).slice(0, 8), [estado.cobrancas]);
  const mesSelecionado = Number(competencia.slice(5, 7));
  const anoSelecionado = Number(competencia.slice(0, 4));
  const porMes = useMemo(() => {
    const itens = [];
    for (let i = 5; i >= 0; i--) {
      const data = new Date(Date.UTC(anoSelecionado, mesSelecionado - 1 - i, 1));
      const chave = data.toISOString().slice(0, 7);
      const valor = estado.pagamentos.filter(p => String(p.pago_em || '').slice(0, 7) === chave && p.sync_status !== 'pendente').reduce((s, p) => s + centavos(p.valor), 0);
      itens.push({ label: MESES[data.getUTCMonth()].slice(0, 3), valor: Math.max(0, valor) });
    }
    return itens;
  }, [estado.pagamentos, anoSelecionado, mesSelecionado]);

  useEffect(() => {
    let ativo = true;
    const gerar = async () => {
      const cobranca = estado.cobrancas.find(c => c.id === cobrancaAberta);
      const conta = cobranca && mapaContas.get(String(cobranca.conta_recebimento_id));
      if (!cobranca || !conta?.chave_pix) { setPixImagem(''); return; }
      try {
        const { default: QRCode } = await import('qrcode');
        const code = gerarPixCopiaECola({ chave: conta.chave_pix, nome: conta.nome_titular, cidade: perfil?.cidade || 'Brasil', valor: saldoCobranca(cobranca, porCobranca(cobranca.id)), referencia: `${cobranca.id.slice(0, 20)}` });
        const url = await QRCode.toDataURL(code, { width: 240, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#082f2d', light: '#ffffff' } });
        if (ativo) setPixImagem(url);
      } catch { if (ativo) setPixImagem(''); }
    };
    gerar();
    return () => { ativo = false; };
  }, [cobrancaAberta, estado.cobrancas, estado.pagamentos, estado.contas, perfil?.cidade, mapaContas, porCobranca]);

  function avisar(mensagem) { setToast(mensagem); }
  async function copiar(texto, nome = 'Copiado') {
    if (!texto) return;
    try { await navigator.clipboard.writeText(texto); avisar(`${nome} copiado.`); }
    catch { avisar('O navegador não permitiu copiar. Selecione o texto manualmente.'); }
  }

  async function salvarConta(e) {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (contaEditando.chave_pix && !chavePixTemFormatoPlausivel(contaEditando.tipo_chave_pix, contaEditando.chave_pix)) throw new Error('Confira o formato da chave Pix para o tipo selecionado.');
      const result = await salvarContaRecebimento(supabase, user.id, contaEditando, estado);
      setEstado(result.estado); setContaEditando(null); avisar(result.pendente ? 'Conta salva no aparelho; sincronização pendente.' : 'Conta de recebimento salva.');
    } catch (e2) { setErro(e2.message || 'Não foi possível salvar a conta.'); }
    finally { setSalvando(false); }
  }

  async function baixarPagamento(form, parcela) {
    form.preventDefault(); setSalvando(true); setErro('');
    try {
      const cobranca = estado.cobrancas.find(c => c.id === parcela.cobranca_id);
      const result = await registrarPagamentoManual(supabase, user.id, cobranca, parcela.valor, parcela.forma, estado);
      setEstado(result.estado); setPagamentoAberto(null); avisar(result.pendente ? 'Pagamento anotado no aparelho. Confirme a sincronização antes de contar no recebido.' : 'Pagamento manual registrado. A confirmação bancária não foi consultada.');
    } catch (e) { setErro(e.message || 'Não foi possível registrar o pagamento.'); }
    finally { setSalvando(false); }
  }

  async function estornar(pagamento) {
    if (!window.confirm('Criar um estorno de correção para este pagamento? O registro original será preservado no histórico.')) return;
    setSalvando(true); setErro('');
    try {
      const result = await estornarPagamento(supabase, user.id, pagamento, estado);
      setEstado(result.estado); avisar(result.pendente ? 'Estorno salvo no aparelho; sincronização pendente.' : 'Estorno de correção registrado no histórico.');
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  }

  async function cancelar(cobranca) {
    const motivo = window.prompt('Motivo para cancelar esta cobrança:');
    if (motivo == null) return;
    setSalvando(true); setErro('');
    try {
      const result = await cancelarCobranca(supabase, user.id, cobranca, motivo, estado);
      setEstado(result.estado); avisar(result.pendente ? 'Cancelamento salvo no aparelho; sincronização pendente.' : 'Cobrança cancelada; histórico preservado.');
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  }

  function abrirMensagem(cobranca) {
    const cliente = mapaClientes.get(String(cobranca.cliente_id));
    const conta = mapaContas.get(String(cobranca.conta_recebimento_id));
    const cadastro = estado.cadastros.find(c => String(c.cliente_id) === String(cobranca.cliente_id));
    if (!cliente) { setErro('O cliente dessa cobrança não está disponível nesta conta.'); return; }
    let code = '';
    if (conta?.chave_pix) {
      try { code = gerarPixCopiaECola({ chave: conta.chave_pix, nome: conta.nome_titular, cidade: perfil?.cidade || 'Brasil', valor: saldoCobranca(cobranca, porCobranca(cobranca.id)), referencia: cobranca.id.slice(0, 20) }); }
      catch { /* A chave continua visível para copiar manualmente. */ }
    }
    try {
      setMensagemAberta({ cobranca, cliente });
      setTextoMensagem(mensagemCobranca({ cliente, cobranca: { ...cobranca, link_pagamento: cobranca.link_pagamento || cadastro?.link_pagamento, valor: saldoCobranca(cobranca, porCobranca(cobranca.id)) / 100 }, conta, perfil, codigoPix: code }));
    } catch (e) { setErro(e.message); }
  }

  const tituloCompetencia = `${MESES[mesSelecionado - 1]} ${anoSelecionado}`;

  return <div className="min-h-screen bg-slate-50 pb-28 font-sans text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <button type="button" onClick={voltar} aria-label="Voltar" className="rounded-xl bg-slate-100 p-2.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><ArrowLeft size={19} /></button>
        <div className="min-w-0 flex-1"><p className={`text-lg font-black ${gradText}`}>Financeiro</p><p className="text-[11px] text-zinc-500 dark:text-zinc-400">Cobranças e recebimentos da sua conta</p></div>
        <button type="button" onClick={() => carregar({ semCarga: true })} disabled={carregando} aria-label="Sincronizar" className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"><RefreshCw size={17} className={carregando ? 'animate-spin' : ''} /></button>
      </div>
    </header>

    <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6">
      {toast && <div role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200">{toast}</div>}
      {erro && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><CircleAlert size={16} className="shrink-0" /><span>{erro}</span></div>}
      {estado.offline && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Modo offline: exibindo a cópia sincronizada e preservando alterações pendentes.</div>}
      {estado.fila?.length > 0 && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{estado.fila.length} alteração(ões) aguardam sincronização. Valores pendentes não entram no total recebido confirmado.</div>}
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {ABAS.map(([id, nome]) => <button key={id} type="button" onClick={() => { setAba(id); setErro(''); }} className={`min-h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-black transition ${aba === id ? `${gradBtn} shadow-sm` : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>{nome}</button>)}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div><p className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Competência</p><p className="mt-1 font-bold">{tituloCompetencia}</p></div>
        <div className="flex gap-2">
          <select aria-label="Mês" className={`${campo} w-auto min-w-32 py-2.5`} value={mesSelecionado} onChange={e => setCompetencia(competenciaMes(anoSelecionado, Number(e.target.value)))}>{MESES.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}</select>
          <select aria-label="Ano" className={`${campo} w-auto min-w-24 py-2.5`} value={anoSelecionado} onChange={e => setCompetencia(competenciaMes(Number(e.target.value), mesSelecionado))}>{Array.from({ length: 8 }, (_, i) => hoje.getFullYear() - 5 + i).map(ano => <option key={ano}>{ano}</option>)}</select>
        </div>
      </section>

      {aba === 'resumo' && <>
        <section className="grid grid-cols-2 gap-3">
          <Metrica titulo="Previsto" valor={resumo.previsto} icone={<CalendarDays size={16} />} tonalidade="sky" />
          <Metrica titulo="Recebido" valor={resumo.recebido} icone={<BadgeCheck size={16} />} tonalidade="emerald" />
          <Metrica titulo="A receber" valor={resumo.aReceber} icone={<Clock3 size={16} />} tonalidade="teal" />
          <Metrica titulo="Em atraso" valor={resumo.atrasado} icone={<CircleAlert size={16} />} tonalidade="rose" />
        </section>
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs text-zinc-500 dark:text-zinc-400">Clientes pagantes</p><p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{resumo.clientesPagantes}</p></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs text-zinc-500 dark:text-zinc-400">Pendentes</p><p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{resumo.clientesPendentes}</p></div>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-black">Recebimentos recentes</h2><Banknote size={17} className="text-teal-500" /></div>
          <div className="flex h-32 items-end gap-3 border-b border-zinc-200 px-1 dark:border-zinc-800">{porMes.map(m => { const max = Math.max(1, ...porMes.map(x => x.valor)); return <div key={`${m.label}-${m.valor}`} className="flex h-full flex-1 flex-col justify-end gap-1 text-center"><span className="text-[9px] text-zinc-400">{m.valor ? moeda(m.valor) : ''}</span><div className="min-h-1 rounded-t-lg bg-gradient-to-t from-sky-500 to-emerald-400" style={{ height: `${Math.max(4, m.valor / max * 78)}%` }} /><span className="pb-1 text-[10px] font-bold text-zinc-500">{m.label}</span></div>; })}</div>
          <p className="mt-3 text-[10px] text-zinc-400">Valores confirmados no registro financeiro, não consultados automaticamente ao banco.</p>
        </section>
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Cobranças do mês</h2>
          {carregando && !cobrancasDoMes.length ? <Carregando /> : cobrancasDoMes.length ? cobrancasDoMes.map(c => <CartaoCobranca key={c.id} cobranca={c} cliente={mapaClientes.get(String(c.cliente_id))} pagamentos={porCobranca(c.id)} abrir={() => setCobrancaAberta(c.id)} />) : <Vazio texto="Não há cobranças nesta competência. Configure mensalidades em Clientes e sincronize." />}
        </section>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400"><History size={14} /> Histórico financeiro</h2>
          {historico.length ? historico.map(c => <CartaoCobranca key={c.id} cobranca={c} cliente={mapaClientes.get(String(c.cliente_id))} pagamentos={porCobranca(c.id)} abrir={() => setCobrancaAberta(c.id)} />) : <Vazio texto="Os lançamentos aparecerão aqui depois de gerar as mensalidades." />}
        </section>
      </>}

      {aba === 'cobrancas' && <>
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
          <p className="font-black">Mensalidades automáticas do app</p><p className="mt-1 leading-relaxed">Ao abrir uma competência, o Supabase cria no máximo uma cobrança por cliente configurado. O valor e a descrição ficam como retrato daquele mês; alterações futuras não mudam lançamentos antigos.</p>
          <button type="button" onClick={() => carregar({ semCarga: true })} disabled={carregando} className={`${botaoBase} mt-3 bg-sky-700 text-white dark:bg-sky-600`}><RefreshCw size={14} /> Gerar / atualizar competência</button>
        </section>
        <div className="relative"><Search size={17} className="absolute left-3.5 top-3.5 text-zinc-400" /><input className={`${campo} pl-10`} placeholder="Filtrar clientes" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <section className="space-y-3">
          {clientesFinanceiros.length ? clientesFinanceiros.map(({ cliente, cadastro }) => {
            const cobranca = cobrancasDoMes.find(c => String(c.cliente_id) === String(cliente.id));
            const status = cobranca ? statusCobranca(cobranca, porCobranca(cobranca.id)) : null;
            return <button key={cliente.id} type="button" onClick={() => setClienteAberto(cliente.id)} className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-teal-700">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{cliente.nome}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Vence dia {cadastro.dia_vencimento} · {moeda(centavos(cadastro.valor_mensal))}</p></div>{status ? <Status status={status} /> : <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">Sem lançamento</span>}</div>
              {cadastro.sync_status === 'pendente' && <p className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">Cadastro financeiro aguardando sincronização</p>}
            </button>;
          }) : <Vazio texto="Adicione o valor mensal e o vencimento no cadastro ou edição de cada cliente." />}
        </section>
      </>}

      {aba === 'contas' && <>
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-teal-500" size={18} /><p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">O Mão na Água guarda somente dados de recebimento e não movimenta nem custodia valores. Nunca informe senha bancária ou chave secreta de API neste cadastro. O dinheiro segue diretamente ao titular da conta selecionada.</p></div>
        </section>
        <button type="button" onClick={() => setContaEditando(contaVazia())} className={`${botaoBase} w-full ${gradBtn}`}><Plus size={16} /> Nova conta de recebimento</button>
        <section className="space-y-3">{estado.contas.length ? estado.contas.map(a => <article key={a.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{a.instituicao === 'Outros bancos' ? a.nome_instituicao || a.instituicao : a.instituicao}</h3>{a.principal && <span className="rounded-md bg-teal-100 px-2 py-1 text-[9px] font-black uppercase text-teal-800 dark:bg-teal-900/40 dark:text-teal-200">Principal</span>}{!a.ativa && <span className="rounded-md bg-zinc-200 px-2 py-1 text-[9px] font-black uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Inativa</span>}</div><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Titular: {a.nome_titular}</p><p className="mt-1 break-all text-xs text-zinc-600 dark:text-zinc-300">{a.chave_pix ? `Pix ${a.tipo_chave_pix}: ${a.chave_pix}` : a.link_pagamento || a.link_recorrencia || 'Sem chave Pix ou link cadastrado'}</p>{a.identificador_infinitepay && <p className="mt-1 text-[10px] text-zinc-400">InfiniteTag: {a.identificador_infinitepay}</p>}{a.sync_status === 'pendente' && <p className="mt-1 text-[10px] font-bold text-amber-600">Aguardando sincronização</p>}</div><button type="button" onClick={() => setContaEditando({ ...a })} className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Editar</button></div>
        </article>) : <Vazio texto="Cadastre sua conta para gerar Pix e organizar os recebimentos." />}</section>
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">InfinitePay: você pode informar um link de pagamento ou de recorrência criado na própria conta. A API para geração/consulta automática não está configurada. Cobranças compartilhadas pelo app não ativam cobrança automática de plano.</p>
      </>}
    </main>

    {contaEditando && <Modal titulo={contaEditando.id ? 'Editar conta' : 'Nova conta'} fechar={() => setContaEditando(null)}>
      <form onSubmit={salvarConta} className="space-y-4">
        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Instituição<select required className={`${campo} mt-1`} value={contaEditando.instituicao || ''} onChange={e => setContaEditando(v => ({ ...v, instituicao: e.target.value, tipo_integracao: e.target.value === 'InfinitePay' ? 'infinitepay_plano' : 'pix_manual' }))}><option value="">Selecione</option>{INSTITUICOES.map(b => <option key={b}>{b}</option>)}</select></label>
        {contaEditando.instituicao === 'Outros bancos' && <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Nome da instituição<input maxLength={100} className={`${campo} mt-1`} value={contaEditando.nome_instituicao || ''} onChange={e => setContaEditando(v => ({ ...v, nome_instituicao: e.target.value }))} /></label>}
        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Nome do titular<input required maxLength={160} className={`${campo} mt-1`} value={contaEditando.nome_titular || ''} onChange={e => setContaEditando(v => ({ ...v, nome_titular: e.target.value }))} /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Tipo da chave Pix<select className={`${campo} mt-1`} value={contaEditando.tipo_chave_pix || ''} onChange={e => setContaEditando(v => ({ ...v, tipo_chave_pix: e.target.value }))}><option value="">Sem chave Pix</option>{CHAVES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label><label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Chave Pix<input className={`${campo} mt-1`} autoComplete="off" value={contaEditando.chave_pix || ''} onChange={e => setContaEditando(v => ({ ...v, chave_pix: e.target.value }))} /></label></div>
        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Link de cobrança (opcional)<input type="url" placeholder="https://..." className={`${campo} mt-1`} value={contaEditando.link_pagamento || ''} onChange={e => setContaEditando(v => ({ ...v, link_pagamento: e.target.value }))} /></label>
        {contaEditando.instituicao === 'InfinitePay' && <>
          <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">InfiniteTag (opcional)<input maxLength={120} autoComplete="off" className={`${campo} mt-1`} value={contaEditando.identificador_infinitepay || ''} onChange={e => setContaEditando(v => ({ ...v, identificador_infinitepay: e.target.value.replace(/^\$/, '') }))} /></label>
          <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">Link de plano/recorrência criado na InfinitePay<input type="url" placeholder="https://..." className={`${campo} mt-1`} value={contaEditando.link_recorrencia || ''} onChange={e => setContaEditando(v => ({ ...v, link_recorrencia: e.target.value }))} /></label>
          <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">O Financeiro não consulta Planos e Recorrências. Confira os recebimentos no app InfinitePay e registre-os manualmente aqui. Não informe credenciais financeiras neste formulário.</p>
        </>}
        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={contaEditando.principal === true} onChange={e => setContaEditando(v => ({ ...v, principal: e.target.checked }))} />Usar como principal</label>
        {contaEditando.id && <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={contaEditando.ativa !== false} onChange={e => setContaEditando(v => ({ ...v, ativa: e.target.checked, principal: e.target.checked ? v.principal : false }))} />Conta ativa</label>}
        <div className="flex gap-2"><button type="button" onClick={() => setContaEditando(null)} className={`${botaoBase} flex-1 bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>Voltar</button><button disabled={salvando} className={`${botaoBase} flex-1 ${gradBtn}`}>{salvando ? 'Salvando…' : 'Salvar conta'}</button></div>
      </form>
    </Modal>}

    {cobrancaAberta && (() => {
      const cobranca = estado.cobrancas.find(c => c.id === cobrancaAberta);
      if (!cobranca) return null;
      const cliente = mapaClientes.get(String(cobranca.cliente_id));
      const conta = mapaContas.get(String(cobranca.conta_recebimento_id));
      const cadastroCliente = estado.cadastros.find(c => String(c.cliente_id) === String(cobranca.cliente_id));
      const pagamentos = porCobranca(cobranca.id);
      const saldo = saldoCobranca(cobranca, pagamentos);
      let code = '';
      if (conta?.chave_pix && saldo > 0) { try { code = gerarPixCopiaECola({ chave: conta.chave_pix, nome: conta.nome_titular, cidade: perfil?.cidade || 'Brasil', valor: saldo / 100, referencia: cobranca.id.slice(0, 20) }); } catch { code = ''; } }
      return <Modal titulo="Detalhes da cobrança" fechar={() => setCobrancaAberta(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-100 p-4 dark:bg-zinc-800"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{cliente?.nome || 'Cliente'}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{new Date(`${cobranca.competencia}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })} · vence {new Date(`${cobranca.vencimento}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p></div><Status status={statusCobranca(cobranca, pagamentos)} /></div><div className="mt-4 grid grid-cols-2 gap-3"><ValorMini nome="Cobrança" valor={moeda(centavos(cobranca.valor))} /><ValorMini nome="Saldo" valor={moeda(saldo)} /></div><p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">{cobranca.descricao}</p>{cobranca.sync_status === 'pendente' && <p className="mt-2 text-[10px] font-bold text-amber-600">Cobrança aguardando sincronização.</p>}</div>
          {saldo > 0 && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPagamentoAberto({ cobranca_id: cobranca.id, valor: (saldo / 100).toFixed(2), forma: 'pix_manual' })} className={`${botaoBase} bg-emerald-600 text-white`}><Check size={14} /> Marcar como pago</button><button type="button" onClick={() => abrirMensagem(cobranca)} className={`${botaoBase} bg-[#25D366] text-white`}><Send size={14} /> WhatsApp</button></div>}
          {(cobranca.forma_pagamento === 'infinitepay' || cobranca.link_pagamento || cadastroCliente?.link_pagamento) && <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Link/assinatura existente: este lançamento é apenas para controle interno. Não será criado outro link. Confirme o recebimento no app InfinitePay e registre manualmente.</p>}
          {(cobranca.link_pagamento || cadastroCliente?.link_pagamento) && <a href={cobranca.link_pagamento || cadastroCliente.link_pagamento} target="_blank" rel="noreferrer" className={`${botaoBase} w-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200`}><ExternalLink size={14} />{cobranca.forma_pagamento === 'infinitepay' ? 'Abrir assinatura existente' : 'Abrir link de pagamento'}</a>}
          {conta?.link_recorrencia && <a href={conta.link_recorrencia} target="_blank" rel="noreferrer" className={`${botaoBase} w-full border border-sky-200 text-sky-800 dark:border-sky-900 dark:text-sky-200`}><Link2 size={14} /> Abrir plano recorrente</a>}
          {conta?.chave_pix && saldo > 0 && <div className="rounded-2xl border border-zinc-200 p-4 text-center dark:border-zinc-800"><p className="mb-2 text-xs font-bold">Pix estático para este saldo</p>{pixImagem ? <img src={pixImagem} alt="QR Code Pix da cobrança" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" /> : <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">Gerando QR Code…</div>}<button type="button" onClick={() => copiar(code, 'Pix Copia e Cola')} className={`${botaoBase} mt-3 border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200`}><Copy size={13} /> Copiar Pix Copia e Cola</button><p className="mt-2 break-all text-[10px] text-zinc-400">Recebedor: {conta.nome_titular} · {conta.chave_pix}</p></div>}
          <section><h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500"><History size={14} /> Histórico de pagamentos</h3>{pagamentos.length ? <div className="space-y-2">{pagamentos.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(p => <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-xs dark:bg-zinc-800"><div><p className="font-bold">{p.tipo === 'estorno' ? 'Estorno de correção' : p.origem_confirmacao === 'provedor' ? 'Confirmado pelo provedor' : 'Registro manual'} · {p.forma_pagamento}</p><p className="mt-1 text-[10px] text-zinc-500">{p.pago_em}{p.sync_status === 'pendente' ? ' · pendente de sincronização' : ''}</p></div><div className="flex items-center gap-2"><strong className={Number(p.valor)<0?'text-rose-600 dark:text-rose-300':'text-emerald-600 dark:text-emerald-300'}>{Number(p.valor)<0?'−':''}{moeda(Math.abs(centavos(p.valor)))}</strong>{p.tipo === 'pagamento' && p.origem_confirmacao === 'manual' && <button type="button" title="Corrigir por estorno" onClick={() => estornar(p)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"><RefreshCw size={13} /></button>}</div></div>)}</div> : <p className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Nenhum pagamento registrado.</p>}</section>
          {cobranca.status !== 'cancelada' && saldo === centavos(cobranca.valor) && <button type="button" onClick={() => cancelar(cobranca)} className={`${botaoBase} w-full border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300`}>Cancelar cobrança</button>}
          <p className="text-[10px] leading-relaxed text-zinc-500">Marcar como pago registra um lançamento manual no Mão na Água. Isso não consulta nem confirma o pagamento junto ao banco ou à InfinitePay.</p>
        </div>
      </Modal>;
    })()}

    {clienteAberto && (() => {
      const cliente = mapaClientes.get(String(clienteAberto));
      const cadastro = estado.cadastros.find(c => String(c.cliente_id) === String(clienteAberto));
      const anteriores = estado.cobrancas.filter(c => String(c.cliente_id) === String(clienteAberto)).sort((a,b)=>String(b.competencia).localeCompare(String(a.competencia)));
      if (!cliente) return null;
      return <Modal titulo={`Financeiro · ${cliente.nome}`} fechar={() => setClienteAberto(null)}>
        <div className="space-y-4"><div className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-zinc-800"><p>Mensalidade: <b>{cadastro ? moeda(centavos(cadastro.valor_mensal)) : 'Não configurada'}</b></p><p className="mt-1 text-xs text-zinc-500">Vencimento dia {cadastro?.dia_vencimento || '—'} · {cadastro?.recorrencia_ativa ? 'geração mensal ativada no app' : 'geração mensal desativada'}</p>{cadastro?.telefone_cobranca && <p className="mt-1 text-xs text-zinc-500">WhatsApp: {cadastro.telefone_cobranca}</p>}</div><h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Histórico de mensalidades</h3>{anteriores.length ? anteriores.map(c => <CartaoCobranca key={c.id} cobranca={c} cliente={cliente} pagamentos={porCobranca(c.id)} abrir={() => { setClienteAberto(null); setCobrancaAberta(c.id); }} />) : <Vazio texto="Nenhum lançamento financeiro foi gerado para este cliente." />}</div>
      </Modal>;
    })()}

    {pagamentoAberto && <Modal titulo="Registrar pagamento manual" fechar={() => setPagamentoAberto(null)} compact>
      <form onSubmit={e => baixarPagamento(e, pagamentoAberto)} className="space-y-4">
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Registro manual não confirma o recebimento no banco. Pagamento parcial é permitido; a correção gera um estorno separado e preserva o lançamento anterior.</p>
        <label className="block text-xs font-bold">Valor pago<input required min="0.01" max={(saldoCobranca(estado.cobrancas.find(c=>c.id===pagamentoAberto.cobranca_id), porCobranca(pagamentoAberto.cobranca_id))/100).toFixed(2)} step="0.01" type="number" className={`${campo} mt-1`} value={pagamentoAberto.valor} onChange={e => setPagamentoAberto(v => ({ ...v, valor: e.target.value }))} /></label>
        <label className="block text-xs font-bold">Forma de pagamento<select className={`${campo} mt-1`} value={pagamentoAberto.forma} onChange={e => setPagamentoAberto(v => ({ ...v, forma: e.target.value }))}><option value="pix_manual">Pix manual</option><option value="link_manual">Link manual</option><option value="infinitepay">InfinitePay (confirmado manualmente)</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option></select></label>
        <div className="flex gap-2"><button type="button" onClick={() => setPagamentoAberto(null)} className={`${botaoBase} flex-1 bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>Cancelar</button><button disabled={salvando} className={`${botaoBase} flex-1 bg-emerald-600 text-white`}>{salvando ? 'Salvando…' : 'Registrar'}</button></div>
      </form>
    </Modal>}

    {mensagemAberta && <Modal titulo="Revisar cobrança no WhatsApp" fechar={() => setMensagemAberta(null)}>
      <div className="space-y-4"><p className="text-xs text-zinc-500 dark:text-zinc-400">Confira e edite a mensagem. O app só abre o WhatsApp; você confirma o envio lá.</p><textarea className={`${campo} min-h-56 resize-y`} value={textoMensagem} onChange={e => setTextoMensagem(e.target.value)} /><div className="flex gap-2"><button type="button" onClick={() => setMensagemAberta(null)} className={`${botaoBase} flex-1 bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>Voltar</button><button type="button" onClick={() => window.open(urlWhatsApp(mensagemAberta.cliente.telefone || estado.cadastros.find(c=>String(c.cliente_id)===String(mensagemAberta.cliente.id))?.telefone_cobranca, textoMensagem), '_blank', 'noopener,noreferrer')} className={`${botaoBase} flex-1 bg-[#25D366] text-white`}><Send size={14} /> Abrir WhatsApp</button></div></div>
    </Modal>}
  </div>;
}

function cadastroVisivel(cadastro, busca, clientes) {
  if (!busca) return true;
  return String(clientes.get(String(cadastro.cliente_id))?.nome || cadastro.cliente_id).toLowerCase().includes(busca.toLowerCase());
}
function contaVazia() { return { instituicao: '', nome_instituicao: '', nome_titular: '', tipo_chave_pix: '', chave_pix: '', link_pagamento: '', link_recorrencia: '', tipo_integracao: 'pix_manual', identificador_infinitepay: '', principal: false, ativa: true }; }
function Metrica({ titulo, valor, icone, tonalidade }) {
  const paleta = { sky: 'bg-sky-50 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300', emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300', teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300', rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300' };
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${paleta[tonalidade]}`}>{icone}</div><p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{titulo}</p><p className="mt-1 text-xl font-black text-zinc-900 dark:text-white">{moeda(valor)}</p></div>;
}
function ValorMini({ nome, valor }) { return <div className="rounded-xl bg-white p-3 dark:bg-zinc-900"><p className="text-[10px] text-zinc-500">{nome}</p><p className="mt-1 font-black">{valor}</p></div>; }
function Vazio({ texto }) { return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-center text-xs leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">{texto}</div>; }
function Carregando() { return <div className="flex justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-teal-600 dark:border-zinc-800 dark:bg-zinc-900"><LoaderCircle size={20} className="animate-spin" /></div>; }
function CartaoCobranca({ cobranca, cliente, pagamentos, abrir }) {
  const status = statusCobranca(cobranca, pagamentos);
  return <button type="button" onClick={abrir} className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-teal-800">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{cliente?.nome || 'Cliente indisponível'}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Vencimento {new Date(`${cobranca.vencimento}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · {cobranca.descricao}</p></div><Status status={status} /></div>
    <div className="mt-3 flex items-center justify-between"><span className="text-xs text-zinc-500 dark:text-zinc-400">Saldo {moeda(saldoCobranca(cobranca, pagamentos))}</span><strong className="text-sm">{moeda(centavos(cobranca.valor))}</strong></div>
    {cobranca.sync_status === 'pendente' && <p className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">Aguardando sincronização</p>}
  </button>;
}
