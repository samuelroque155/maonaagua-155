import { CalendarArrowUp, ClockArrowDown, Navigation } from 'lucide-react';
export default function AcoesVisita({ hoje, futura, bloqueado, antecipar, iniciar, adiar, continuar, gradBtn }) {
  const focoVisivel = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900';
  const secundaria = `min-h-11 min-w-11 px-2 rounded-xl text-[11px] whitespace-nowrap font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 disabled:opacity-35 flex items-center justify-center gap-1 ${focoVisivel}`;
  return <div className="flex items-stretch gap-1.5 mt-2">
    <button type="button" aria-label="Antecipar visita" className={secundaria} disabled={bloqueado || !futura || !antecipar} title={futura ? 'Antecipar esta ocorrência' : 'Escolha uma visita futura na agenda semanal'} onClick={antecipar}><CalendarArrowUp size={13} aria-hidden="true" /><span className="sr-only min-[360px]:not-sr-only">Antecipar</span></button>
    <button type="button" aria-label={continuar ? 'Continuar visita' : 'Iniciar visita'} className={`min-h-11 min-w-11 flex-1 px-1 rounded-xl text-[11px] whitespace-nowrap font-bold flex items-center justify-center gap-1 disabled:opacity-35 ${focoVisivel} ${gradBtn}`} disabled={!hoje || bloqueado || !iniciar} title={hoje ? 'Iniciar atendimento' : 'Disponível no dia do atendimento'} onClick={iniciar}><Navigation size={12} aria-hidden="true" />{continuar ? 'Continuar' : 'Iniciar visita'}</button>
    <button type="button" aria-label="Adiar visita" className={secundaria} disabled={bloqueado || !hoje || !adiar} title={hoje ? 'Adiar esta visita' : 'Disponível no dia do atendimento'} onClick={adiar}><ClockArrowDown size={13} aria-hidden="true" /><span className="sr-only min-[360px]:not-sr-only">Adiar</span></button>
  </div>;
}
