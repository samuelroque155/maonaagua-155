
import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import AcoesVisita from '../components/AcoesVisita.jsx';
import { dataBrasil, estadoAgendaCliente, resumirAgendaDia } from '../services/agendaService';
import {
  Camera, ShoppingCart, MapPin, Plus, CalendarDays, RefreshCw, LogOut, Sun, Moon, Search, Clock, BellRing, Settings, ShieldCheck, UserPlus, User, Briefcase, Activity, FileText, Wallet
} from 'lucide-react';

export default function Home({ iniciarVisita, adiarVisita, setTela, toast, progressoPausado }) {
  const {
    user, perfil, clientes, gerenciaEquipe, modoEscuro, setModoEscuro,
    pendentesCount, erroSincronizacao, isSyncing, gradText, gradBtn,
    dataHojeStr, processarFilaSincronizacao, tela, adiamentos = [], antecipacoes = [], erroAntecipacoes, dataHojeISO = dataBrasil(), erroAgenda
  } = useContext(AppContext);
  const [mostrarTodasRotas, setMostrarTodasRotas] = useState(false);
  const nomeCabecalho = perfil.tipoConta === 'funcionario' ? 'Minhas piscinas' : perfil.empresa || 'Mão Na Água';
  const cidadeCabecalho = perfil.tipoConta === 'funcionario' ? perfil.cidadeEmpresa : perfil.cidade;

  let clientesFiltrados = clientes;
  if (perfil.tipoConta === 'funcionario' && perfil.rotas) {
    clientesFiltrados = clientes.filter(c => perfil.rotas.map(String).includes(String(c.id)));
  }

  const resumoAgenda = resumirAgendaDia(clientesFiltrados, adiamentos, dataHojeISO, antecipacoes);
  const piscinasDeHoje = resumoAgenda.pendentes;

  const visitasEmAndamento = perfil.tipoConta === 'empresa'
    ? clientes.filter(c => c.visitaEmAndamentoData === dataHojeStr)
    : [];
  const clientesExibidos = perfil.tipoConta === 'funcionario' && mostrarTodasRotas ? clientesFiltrados : piscinasDeHoje;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans pb-24 transition-colors duration-300 relative overflow-x-hidden">

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className="bg-zinc-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-lg border border-zinc-700 flex items-center gap-3">
            <span className="font-bold text-sm whitespace-nowrap">{toast}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800/50 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 w-10 h-10 bg-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <span className="text-white font-bold text-xl">{nomeCabecalho.charAt(0)}</span>
              {perfil.fotoPerfilUrl && !perfil.fotoPerfilNova && <img src={perfil.fotoPerfilUrl} alt="Sua foto ou logo" className="absolute inset-0 w-10 h-10 rounded-2xl object-contain bg-white p-0.5" onError={evento => { evento.currentTarget.style.display = 'none'; }} />}
            </div>
            <div>
              <h1 className={`text-xl font-black uppercase tracking-tight ${gradText}`}>{nomeCabecalho}</h1>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <MapPin size={10} /> {cidadeCabecalho}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {user?.app_metadata?.role === 'admin' && (
              <button onClick={() => setTela('admin_panel')} className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <ShieldCheck size={18} />
              </button>
            )}

            <button onClick={() => setModoEscuro(!modoEscuro)} className="w-9 h-9 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">
              {modoEscuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => setTela('configuracoes')}
              aria-label="Configurações"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-slate-50 dark:bg-zinc-800 text-teal-500"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {(isSyncing || pendentesCount > 0) && (
        <div className={`max-w-md mx-auto px-6 pt-3 text-xs font-bold ${isSyncing ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {isSyncing
            ? `Enviando ${pendentesCount || 1} visita(s) para a nuvem...`
            : `${pendentesCount} visita(s) salva(s) no celular aguardando internet.`}
          {!isSyncing && pendentesCount > 0 && <button onClick={() => processarFilaSincronizacao(user.id)} className="block mt-2 underline">Tentar envio novamente</button>}
        </div>
      )}

      {erroSincronizacao && <p role="alert" className="max-w-md mx-auto px-6 pt-3 text-xs text-amber-600">{erroSincronizacao}</p>}
      {erroAgenda && <p role="alert" className="max-w-md mx-auto px-6 pt-3 text-xs text-amber-600">{erroAgenda}</p>}
      <main className="p-6 max-w-md mx-auto space-y-6">

        {/* Status Bar */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center text-sky-500">
              <CalendarDays size={20} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">Agenda de Hoje</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">{resumoAgenda.totalPendentes} {resumoAgenda.totalPendentes === 1 ? 'Piscina pendente' : 'Piscinas pendentes'}</p>
            </div>
          </div>

          <button onClick={() => setTela('agenda')} className="text-[10px] font-black text-teal-500 uppercase tracking-widest bg-teal-50 dark:bg-teal-900/20 px-4 py-2 rounded-xl">
            Ver Semana
          </button>
        </div>

        {perfil.tipoConta === 'empresa' && visitasEmAndamento.length > 0 && (
          <div className="bg-sky-50 dark:bg-sky-900/10 p-5 rounded-[2rem] border border-sky-200 dark:border-sky-800/50">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-sky-500 animate-pulse" />
              <h3 className="text-xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                Em Andamento (Ao Vivo)
              </h3>
            </div>

            <div className="space-y-2">
              {visitasEmAndamento.map(v => (
                <div key={v.id} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-sky-100 dark:border-sky-900/30">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{v.nome}</span>
                  <span className="text-[10px] bg-sky-100 dark:bg-sky-800 text-sky-600 dark:text-sky-300 px-2 py-1 rounded-md font-bold uppercase">
                    Em Atendimento
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Clientes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
              {perfil.tipoConta === 'funcionario' && mostrarTodasRotas ? 'Todas as rotas' : 'Limpar Hoje'}
            </h2>
            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">
              {new Date(`${dataHojeISO}T12:00:00Z`).toLocaleDateString('pt-BR', {
                timeZone: 'UTC',
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </span>
          </div>

          {perfil.tipoConta === 'funcionario' && <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-zinc-500">{clientesFiltrados.length} rota(s) atribuída(s)</span>
            <button onClick={() => setMostrarTodasRotas(valor => !valor)} className="font-bold text-teal-600 dark:text-teal-400">
              {mostrarTodasRotas ? 'Mostrar somente hoje' : 'Ver todas as rotas'}
            </button>
          </div>}
          {clientesExibidos.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400/30">
                <Plus size={32} />
              </div>
              <p className="text-sm font-bold text-zinc-400">{perfil.tipoConta === 'funcionario' && mostrarTodasRotas ? 'Nenhuma rota atribuída para esta conta.' : 'Nenhuma piscina para limpar hoje.'}</p>
            </div>
          ) : (
            clientesExibidos.map(cliente => {
              const estado = estadoAgendaCliente(cliente, dataHojeISO, adiamentos, antecipacoes);
              const concluida = estado.concluida;
              const emAndamento = (
                String(progressoPausado?.clienteId) === String(cliente.id) ||
                cliente.visitaEmAndamentoData === dataHojeStr
              ) && !concluida;

              return (
                <div
                  key={cliente.id}
                  className={`group bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border transition-all duration-300 ${
                    concluida
                      ? 'border-emerald-200 dark:border-emerald-900/30'
                      : emAndamento
                        ? 'border-sky-300 dark:border-sky-700'
                        : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-base mb-1">
                        {cliente.nome}
                      </h3>

                      <button
                        onClick={() => window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cliente.endereco)}`,
                          '_blank'
                        )}
                        className="text-left text-xs text-zinc-400 dark:text-zinc-500 line-clamp-1 flex items-center gap-1.5 font-medium hover:text-sky-500 transition-colors active:scale-95 origin-left"
                      >
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md">
                          <MapPin size={12} className="text-sky-500" />
                        </div>
                        {cliente.endereco}
                      </button>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {cliente.horaVisita && (
                        <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock size={10} /> {cliente.horaVisita}
                        </span>
                      )}

                      {concluida && (
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Finalizada
                        </span>
                      )}
                    </div>
                  </div>

                  {estado.pendente ? (
                    <div>
                      {estado.antecipacao && <p className="text-xs text-teal-600 mb-2">Visita antecipada de {estado.antecipacao.data_original.split('-').reverse().join('/')}</p>}
                      <AcoesVisita hoje futura={false} continuar={emAndamento} bloqueado={Boolean(erroAgenda || erroAntecipacoes)} gradBtn={emAndamento ? 'bg-zinc-800 dark:bg-zinc-700 text-white' : gradBtn} iniciar={() => iniciarVisita(cliente)} adiar={adiarVisita && (() => adiarVisita(cliente))} />
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">{concluida ? 'Limpeza finalizada. Registro mantido no histórico.' : estado.adiada ? 'Visita adiada. Confira a nova data na agenda.' : 'Sem limpeza programada para hoje.'}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Nav Bottom */}
      {perfil.tipoConta !== 'funcionario' && <nav className={`fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 px-2 py-3 flex gap-1 justify-around items-center z-40 max-w-md mx-auto rounded-t-[2.5rem] shadow-[0_-10px_20px_rgba(0,0,0,0.02)] ${perfil.tipoConta === 'empresa' || gerenciaEquipe ? 'grid grid-cols-5' : 'grid grid-cols-4'}`}>
        {perfil.tipoConta !== 'funcionario' && (
          <button
            onClick={() => setTela('novo_cliente')}
            className={`flex min-w-0 flex-col items-center gap-1 px-0 py-1 transition-all ${
              tela === 'novo_cliente'
                ? 'text-teal-500 scale-110'
                : 'text-zinc-400'
            }`}
          >
            <UserPlus size={24} />
            <span className="text-[8px] font-black uppercase tracking-wide whitespace-nowrap">
              Adicionar
            </span>
          </button>
        )}

        {perfil.tipoConta !== 'funcionario' && <button
          onClick={() => setTela('relatorio')}
          className={`flex min-w-0 flex-col items-center gap-1 px-0 py-1 transition-all ${
            tela === 'relatorio'
              ? 'text-teal-500 scale-110'
              : 'text-zinc-400'
          }`}
        >
          <User size={24} />
          <span className="text-[8px] font-black uppercase tracking-wide whitespace-nowrap">
            Clientes
          </span>
        </button>}

        {perfil.tipoConta !== 'funcionario' && <button
          onClick={() => setTela('financeiro')}
          className={`flex min-w-0 flex-col items-center gap-1 px-0 py-1 transition-all ${
            tela === 'financeiro' ? 'text-teal-500 scale-110' : 'text-zinc-400'
          }`}
        >
          <Wallet size={24} />
          <span className="text-[8px] font-black uppercase tracking-wide whitespace-nowrap">Financeiro</span>
        </button>}

        {perfil.tipoConta !== 'funcionario' && <button
          onClick={() => setTela('orcamento')}
          className={`flex min-w-0 flex-col items-center gap-1 px-0 py-1 transition-all ${
            tela === 'orcamento'
              ? 'text-teal-500 scale-110'
              : 'text-zinc-400'
          }`}
        >
          <FileText size={24} />
          <span className="text-[8px] font-black uppercase tracking-wide whitespace-nowrap">
            Orçamento
          </span>
        </button>}

        {perfil.tipoConta !== 'funcionario' && (perfil.tipoConta === 'empresa' || gerenciaEquipe) && (
          <button
            onClick={() => setTela('gestao_equipe')}
            className={`flex min-w-0 flex-col items-center gap-1 px-0 py-1 transition-all ${
              tela === 'gestao_equipe'
                ? 'text-sky-500 scale-110'
                : 'text-zinc-400'
            }`}
          >
            <Briefcase size={24} />
            <span className="text-[8px] font-black uppercase tracking-wide whitespace-nowrap">
              Equipe
            </span>
          </button>
        )}

      </nav>}
    </div>
  );
}
