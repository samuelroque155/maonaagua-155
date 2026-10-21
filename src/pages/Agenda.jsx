import { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { ArrowLeft } from 'lucide-react';
import { dataBrasil, diaSemanaAgenda, estadoAgendaCliente, formatarDataAgenda, somarDiasAgenda } from '../services/agendaService';

export default function Agenda({ setTela }) {
  const { clientes, adiamentos = [], gradText, gradBtn, dataHojeISO = dataBrasil() } = useContext(AppContext);
  const [semana, setSemana] = useState(0);
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const inicioSemana = somarDiasAgenda(dataHojeISO, -diaSemanaAgenda(dataHojeISO) + semana * 7);
  return <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 max-w-md mx-auto text-zinc-900 dark:text-zinc-100 font-sans pb-20 transition-colors duration-300">
    <header className="flex items-center gap-4 mb-6 pt-2">
      <button onClick={() => setTela('lista')} aria-label="Voltar" className="p-2 text-sky-500 bg-sky-50 dark:bg-sky-500/10 rounded-xl"><ArrowLeft size={20} /></button>
      <h2 className={`text-2xl font-black ${gradText}`}>Agenda da Semana</h2>
    </header>
    <div className="flex justify-between gap-2 mb-5 text-xs font-bold text-teal-600">
      <button onClick={() => setSemana(s => s - 1)}>Semana anterior</button>
      <button onClick={() => setSemana(0)}>Esta semana</button>
      <button onClick={() => setSemana(s => s + 1)}>Próxima semana</button>
    </div>
    <div className="space-y-5">{dias.map((nome, index) => {
      const data = somarDiasAgenda(inicioSemana, index);
      const hoje = data === dataHojeISO;
      const clientesDoDia = clientes.filter(c => { const estado = estadoAgendaCliente(c, data, adiamentos); return estado.programada || estado.adiada; });
      return <div key={data} className={`bg-white dark:bg-zinc-900 rounded-[1.5rem] overflow-hidden border ${hoje ? 'border-teal-400 ring-1 ring-teal-400/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
        <div className={`px-5 py-3.5 font-bold text-sm ${hoje ? gradBtn : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 uppercase text-xs'}`}>{nome} · {formatarDataAgenda(data)} {hoje && '(Hoje)'}</div>
        <div className="p-5 space-y-3.5">{!clientesDoDia.length ? <p className="text-sm text-zinc-400 italic">Livre.</p> : clientesDoDia.map(c => {
          const estado = estadoAgendaCliente(c, data, adiamentos);
          const destino = adiamentos.find(a => String(a.cliente_id) === String(c.id) && a.data_original === data)?.nova_data;
          return <div key={c.id} className="flex items-center justify-between gap-3 text-sm"><span>{c.nome}</span>
            <span className="text-xs text-teal-600 text-right">{estado.adiada ? `Visita adiada para ${formatarDataAgenda(destino)}` : estado.concluida ? 'Finalizada' : estado.reagendada ? 'Reagendada · pendente' : 'Pendente'}</span>
          </div>;
        })}</div>
      </div>;
    })}</div>
  </div>;
}
