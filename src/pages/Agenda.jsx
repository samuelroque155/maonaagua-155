import { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { ArrowLeft } from 'lucide-react';
import AcoesVisita from '../components/AcoesVisita.jsx';
import ModalAntecipacao from '../components/ModalAntecipacao.jsx';
import { anteciparVisita, cancelarAntecipacao } from '../services/antecipacaoService.js';
import { supabase } from '../supabase';
import { dataBrasil, diaSemanaAgenda, estadoAgendaCliente, formatarDataAgenda, somarDiasAgenda, semanaDaData } from '../services/agendaService';

export default function Agenda({ setTela, iniciarVisita, adiarVisita, clienteSupabase = supabase }) {
  const { clientes, adiamentos = [], antecipacoes = [], antecipacoesDisponiveis, erroAgenda, erroAntecipacoes, targetUid, recarregarAgenda, gradText, gradBtn, dataHojeISO = dataBrasil() } = useContext(AppContext);
  const [semana, setSemana] = useState(0);
  const [selecionada, setSelecionada] = useState(null);
  const [erro, setErro] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [busca, setBusca] = useState('');
  const cancelar = async id => {
    setCancelando(true); setErro('');
    try { await cancelarAntecipacao(clienteSupabase, id); recarregarAgenda(); } catch (e) { setErro(e.message); } finally { setCancelando(false); }
  };
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const inicioSemana = somarDiasAgenda(dataHojeISO, -diaSemanaAgenda(dataHojeISO) + semana * 7);
  return <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto text-zinc-900 dark:text-zinc-100 font-sans pb-20 transition-colors duration-300">
    <header className="flex items-center gap-4 mb-6 pt-2">
      <button onClick={() => setTela('lista')} aria-label="Voltar" className="p-2 text-sky-500 bg-sky-50 dark:bg-sky-500/10 rounded-xl"><ArrowLeft size={20} /></button>
      <h2 className={`text-2xl font-black ${gradText}`}>Agenda da Semana</h2>
    </header>
    <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-zinc-500">
      <label>Ir para data<input type="date" value={inicioSemana} onChange={e => { if (e.target.value) setSemana(semanaDaData(e.target.value, dataHojeISO)); }} className="w-full min-h-11 mt-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" /></label>
      <label>Localizar cliente<input type="search" value={busca} onChange={e => setBusca(e.target.value)} className="w-full min-h-11 mt-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" /></label>
    </div>
    <div className="flex justify-between gap-2 mb-5 text-xs font-bold text-teal-600">
      <button onClick={() => setSemana(s => s - 1)}>Semana anterior</button>
      <button onClick={() => setSemana(0)}>Esta semana</button>
      <button onClick={() => setSemana(s => s + 1)}>Próxima semana</button>
    </div>
    {(erro || erroAntecipacoes) && <p role="alert" className="text-xs text-amber-600 mb-3">{erro || erroAntecipacoes}</p>}
    {!antecipacoesDisponiveis && !erroAntecipacoes && <p className="text-xs text-zinc-500 mb-3">Antecipações aguardando configuração neste ambiente.</p>}
    <div className="space-y-5">{dias.map((nome, index) => {
      const data = somarDiasAgenda(inicioSemana, index);
      const hoje = data === dataHojeISO;
      const clientesDoDia = clientes.filter(c => { if (!c.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))) return false; const estado = estadoAgendaCliente(c, data, adiamentos, antecipacoes); return estado.programada || estado.adiada || estado.antecipadaOriginal; });
      return <div key={data} className={`bg-white dark:bg-zinc-900 rounded-[1.5rem] overflow-hidden border ${hoje ? 'border-teal-400 ring-1 ring-teal-400/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
        <div className={`px-5 py-3.5 font-bold text-sm ${hoje ? gradBtn : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 uppercase text-xs'}`}>{nome} · {formatarDataAgenda(data)} {hoje && '(Hoje)'}</div>
        <div className="p-5 space-y-3.5">{!clientesDoDia.length ? <p className="text-sm text-zinc-400 italic">Livre.</p> : clientesDoDia.map(c => {
          const estado = estadoAgendaCliente(c, data, adiamentos, antecipacoes);
          const destino = adiamentos.find(a => String(a.cliente_id) === String(c.id) && a.data_original === data)?.nova_data;
          return <div key={c.id} className="text-sm">
            <div className="flex items-center justify-between gap-3"><span>{c.nome}</span>
            <span className="text-xs text-teal-600 text-right">{estado.antecipadaOriginal ? `Antecipada para ${formatarDataAgenda(estado.antecipadaOriginal.nova_data)}` : estado.adiada ? `Visita adiada para ${formatarDataAgenda(destino)}` : estado.concluida ? 'Finalizada' : estado.antecipacao ? `Antecipada de ${dias[diaSemanaAgenda(estado.antecipacao.data_original)].toLowerCase()}` : estado.reagendada ? 'Reagendada · pendente' : 'Pendente'}</span></div>
            {estado.pendente && data >= dataHojeISO && <AcoesVisita hoje={hoje} futura={antecipacoesDisponiveis && data > dataHojeISO && !estado.antecipacao} bloqueado={Boolean(erroAgenda || erroAntecipacoes)} gradBtn={gradBtn} antecipar={() => setSelecionada({ cliente: c, dataOriginal: data, id: crypto.randomUUID() })} iniciar={iniciarVisita && (() => iniciarVisita(c))} adiar={adiarVisita && (() => adiarVisita(c))} />}
            {estado.antecipacao && estado.pendente && <button type="button" disabled={cancelando || Boolean(erroAntecipacoes)} onClick={() => cancelar(estado.antecipacao.id)} className="min-h-11 text-xs text-zinc-500 underline disabled:opacity-40">Restaurar data original</button>}
          </div>;
        })}</div>
      </div>;
    })}</div>
    {selecionada && <ModalAntecipacao key={selecionada.id} {...selecionada} gradBtn={gradBtn} fechar={() => setSelecionada(null)} salvar={async (novaData, motivo) => { await anteciparVisita(clienteSupabase, { id: selecionada.id, dono: targetUid, clienteId: selecionada.cliente.id, dataOriginal: selecionada.dataOriginal, novaData, motivo }); recarregarAgenda(); }} />}
  </div>;
}
