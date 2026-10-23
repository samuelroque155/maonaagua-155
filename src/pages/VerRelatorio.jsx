
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { resolverImagemPerfil } from '../services/imagemPerfilService';
import { identificacaoCliente } from '../services/identidadeRelatorio';
import { visitasDoCliente } from '../services/visitaEstado';
import { AppContext } from '../context/AppContext.jsx';
import { gerarRelatorioPDF } from '../services/pdfService';
import { enviarOcorrenciaPDF } from '../services/ocorrenciaPdfService';
import { mensagemProdutosSimples, mensagemProdutos } from '../services/whatsappService';
import { imagemProfissionalPDF, imagensRelatorioPDF } from '../services/imagemPerfilService';
import { abrirWhatsApp } from '../utils/whatsapp';
import { formatarDataAgenda, FUSO_AGENDA } from '../services/agendaService';
import {
  ArrowLeft,
  Share2,
  Camera,
  CalendarDays,
  Droplets,
  Clock,
  MessageSquare,
  Loader2,
  MapPin,
  AlertTriangle,
  Pencil,
  LockKeyhole,
  Send,
  FileText,
  Images
} from 'lucide-react';

// Converte datas brasileiras para o formato YYYY-MM-DD.
function obterDataVisita(visita) {
  if (visita?.dataISO) return visita.dataISO;
  if (visita?.d) {
    const match = String(visita.d).match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

    if (match) {
      const [, dia, mes, ano] = match;
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
  }

  if (visita?.ts) {
    const data = new Date(visita.ts);

    if (!Number.isNaN(data.getTime())) {
      const ano = data.getFullYear();
      const mes = String(
        data.getMonth() + 1
      ).padStart(2, '0');
      const dia = String(
        data.getDate()
      ).padStart(2, '0');

      return `${ano}-${mes}-${dia}`;
    }
  }

  return '';
}

function formatarData(dataISO) {
  if (!dataISO) return 'Data não informada';

  const partes = dataISO.split('-');

  if (partes.length !== 3) {
    return dataISO;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarMes(mesISO) {
  if (!mesISO) return '';

  const [ano, mes] = mesISO.split('-');
  const numeroMes = Number(mes);

  if (
    !ano ||
    numeroMes < 1 ||
    numeroMes > 12
  ) {
    return mesISO;
  }

  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  return `${meses[numeroMes - 1]} de ${ano}`;
}

function extrairDadosRegistro(visita) {
  let hora = visita?.h || '';
  let duracao = '';
  let temperatura = visita?.t || '--';

  const match = String(hora).match(
    /^(.*?)\s*\(([^)]*)\)/
  );

  if (match) {
    hora = match[1].trim();
    duracao = match[2].trim();
  }

  if (
    String(temperatura).trim().endsWith('m')
  ) {
    if (!duracao) {
      duracao = temperatura;
    }

    temperatura = '--';
  } else if (
    temperatura !== '--' &&
    !String(temperatura).includes('°')
  ) {
    temperatura = `${temperatura}°C`;
  }

  return {
    hora,
    duracao,
    temperatura
  };
}

function listarFotos(visita, alerta = false) {
  const urls = alerta
    ? [
        ...(Array.isArray(visita?.fotosAlertaBase64)
          ? visita.fotosAlertaBase64
          : []),
        ...(Array.isArray(visita?.fotosA)
          ? visita.fotosA
          : [])
      ]
    : [
        ...(Array.isArray(visita?.fotosBase64)
          ? visita.fotosBase64
          : []),
        ...(Array.isArray(visita?.fotos)
          ? visita.fotos
          : [])
      ];

  return urls
    .map(foto =>
      typeof foto === 'string'
        ? foto
        : foto?.url || foto?.base64 || ''
    )
    .filter(Boolean)
    .filter(
      (url, index, lista) =>
        lista.indexOf(url) === index
    );
}

function obterTelefoneWhatsApp(cliente) {
  let telefone = String(
    cliente?.telefone || ''
  ).replace(/\D/g, '');

  if (
    telefone.length === 10 ||
    telefone.length === 11
  ) {
    telefone = `55${telefone}`;
  }

  return telefone;
}

export default function VerRelatorio({
  setTela,
  cliente,
  historico = [],
  carregando = false,
  enviarAvisoWhatsApp,
  editarVisitaFinalizada,
  solicitarCorrecaoVisita,
  clienteSupabase = supabase
}) {
  const {
    perfil,
    modoImpressao
  } = useContext(AppContext);
  const [fotoProfissional, setFotoProfissional] = useState('');
  useEffect(() => {
    let ativo = true;
    resolverImagemPerfil(clienteSupabase, { fotoPerfilCaminho: perfil.fotoPerfilCaminho })
      .then(url => { if (ativo) setFotoProfissional(url); })
      .catch(() => { if (ativo) setFotoProfissional(''); });
    return () => { ativo = false; };
  }, [perfil.fotoPerfilCaminho, clienteSupabase]);

  const [loadingPDF, setLoadingPDF] =
    useState(false);

  const [solicitandoId, setSolicitandoId] =
    useState(null);

  const [tipoRelatorio, setTipoRelatorio] =
    useState('dia');

  const [dataSelecionada, setDataSelecionada] =
    useState('');

  const [mesSelecionado, setMesSelecionado] =
    useState('');

  const tipoConta = String(
    perfil?.tipoConta || ''
  )
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const funcionario =
    tipoConta === 'funcionario';

  const podeEditar =
    tipoConta === 'autonomo' ||
    tipoConta === 'empresa';

  // Datas que realmente possuem visitas.
  const datasDisponiveis = useMemo(() => {
    return [
      ...new Set(
        visitasDoCliente(historico, cliente?.id)
          .map(obterDataVisita)
          .filter(Boolean)
      )
    ].sort((a, b) => b.localeCompare(a));
  }, [historico, cliente?.id]);

  const mesesDisponiveis = useMemo(() => {
    return [
      ...new Set(
        datasDisponiveis.map(
          data => data.slice(0, 7)
        )
      )
    ].sort((a, b) => b.localeCompare(a));
  }, [datasDisponiveis]);

  // Seleciona automaticamente a visita mais recente.
  const dataAtiva = datasDisponiveis.includes(
    dataSelecionada
  )
    ? dataSelecionada
    : datasDisponiveis[0] || '';

  const mesAtivo = mesesDisponiveis.includes(
    mesSelecionado
  )
    ? mesSelecionado
    : mesesDisponiveis[0] || '';

  // Filtra os registros conforme o período escolhido.
  const historicoFiltrado = useMemo(() => {
    const periodo = tipoRelatorio === 'dia'
      ? dataAtiva
      : mesAtivo;

    if (!periodo) return [];

    return visitasDoCliente(historico, cliente?.id).filter(visita => {
      const data = obterDataVisita(visita);

      return tipoRelatorio === 'dia'
        ? data === periodo
        : data.startsWith(periodo);
    });
  }, [
    historico,
    cliente?.id,
    tipoRelatorio,
    dataAtiva,
    mesAtivo
  ]);

  const visitasFiltradas = useMemo(() => {
    return historicoFiltrado
      .filter(v => !v.tipo || v.tipo === 'visita')
      .sort((a, b) =>
        Number(b.ts || 0) -
        Number(a.ts || 0)
      );
  }, [historicoFiltrado]);

  // Cada visita fica em seu próprio grupo fotográfico.
  const gruposFotograficos = useMemo(() => {
    return visitasFiltradas
      .map((visita, index) => ({
        chave: visita.id ||
          visita.vId ||
          `${obterDataVisita(visita)}-${index}`,
        visita,
        data: obterDataVisita(visita),
        fotos: listarFotos(visita)
      }))
      .filter(grupo => grupo.fotos.length > 0);
  }, [visitasFiltradas]);

  const ocorrenciasFiltradas = useMemo(() => {
    return historicoFiltrado.filter(
      visita => visita.tipo !== 'cancelamento' && (
        visita.tipo === 'problema' ||
        Boolean(
          String(visita.txtA || '').trim()
        ) ||
        listarFotos(visita, true).length > 0)
    );
  }, [historicoFiltrado]);

  const totalFotos = gruposFotograficos.reduce(
    (total, grupo) =>
      total + grupo.fotos.length,
    0
  );

  const periodoDescricao =
    tipoRelatorio === 'dia'
      ? formatarData(dataAtiva)
      : formatarMes(mesAtivo);
  const adiamentosFiltrados = historicoFiltrado.filter(v => v.tipo === 'adiamento');
  const enviarProdutosSalvos = (visita, comValores = false) => {
    if (funcionario) return;
    try {
      const produtos = (visita.prods || []).map(p => ({ ...p, preco: p.preco ?? perfil.precosProdutos?.[p.nome] ?? perfil.precosAcessorios?.[p.nome] ?? null }));
      const mensagem = comValores ? mensagemProdutos({ cliente, perfil, produtos, comValores: true }) : mensagemProdutosSimples({ cliente, perfil, produtos });
      if (!window.confirm('Abrir o WhatsApp com a lista de produtos a repor? A mensagem só será enviada quando você confirmar o envio no WhatsApp.')) return;
      if (!abrirWhatsApp(cliente.telefone, mensagem)) alert('O telefone deste cliente precisa ter DDD para abrir o WhatsApp.');
    } catch (e) { alert(e.message); }
  };

  const handleSharePDF = async () => {
    if (loadingPDF || carregando) return;

    if (!historicoFiltrado.some(v => v.tipo !== 'cancelamento')) {
      alert(
        'Não existem registros para o período selecionado.'
      );
      return;
    }

    setLoadingPDF(true);

    try {
      const identidade = await imagemProfissionalPDF(clienteSupabase, perfil);
      const comImagens = await imagensRelatorioPDF(clienteSupabase, historicoFiltrado.filter(v => v.tipo !== 'cancelamento'));
      await gerarRelatorioPDF(
        cliente,
        comImagens,
        { ...perfil, fotoPerfilUrl: identidade.imagem }
      );
      const fotosAusentes = comImagens.reduce((total, v) => total + (v.fotosIndisponiveis || 0), 0);
      const avisos = [identidade.aviso, fotosAusentes ? `${fotosAusentes} fotografia(s) não puderam ser carregadas neste PDF. Os registros originais foram preservados. Confira a conexão e gere novamente para incluir todas as fotos.` : ''].filter(Boolean);
      if (avisos.length) alert(avisos.join('\n'));
    } catch (erro) {
      console.error(
        'Erro ao gerar relatório PDF:',
        erro
      );

      alert(
        'Não foi possível gerar o PDF: ' +
        erro.message
      );
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleWhatsApp = (comValores = false) => {
    if (funcionario) return;
    try {
      const produtos = visitasFiltradas.flatMap(v => v.prods || []).map(p => ({ ...p, preco: p.preco ?? perfil.precosProdutos?.[p.nome] ?? perfil.precosAcessorios?.[p.nome] ?? null }));
      const mensagem = comValores ? mensagemProdutos({ cliente, perfil, produtos, comValores: true }) : mensagemProdutosSimples({ cliente, perfil, produtos });
      if (!window.confirm('Abrir o WhatsApp com a lista de produtos a repor? A mensagem só será enviada quando você confirmar o envio no WhatsApp.')) return;
      if (!abrirWhatsApp(cliente.telefone, mensagem)) alert('O telefone deste cliente precisa ter DDD para abrir o WhatsApp.');
    } catch (e) { alert(e.message); }
  };

  const handleEditarVisita = visita => {
    if (!podeEditar) {
      alert(
        'Você não tem permissão para editar esta visita.'
      );
      return;
    }

    if (
      typeof editarVisitaFinalizada !== 'function'
    ) {
      alert(
        'A edição ainda não está configurada.'
      );
      return;
    }

    editarVisitaFinalizada(visita);
  };

  const handleSolicitarCorrecao = async visita => {
    if (!funcionario) return;

    if (
      typeof solicitarCorrecaoVisita !== 'function'
    ) {
      alert(
        'A solicitação de correções ainda não está disponível.'
      );
      return;
    }

    const motivo = window.prompt(
      'O que precisa ser corrigido nesta visita?'
    );

    if (motivo === null) return;

    if (!motivo.trim()) {
      alert('Informe o motivo da correção.');
      return;
    }

    const id = visita.id || visita.vId;

    setSolicitandoId(id);

    try {
      await solicitarCorrecaoVisita(
        visita,
        motivo.trim()
      );
    } catch (erro) {
      alert(
        'Não foi possível solicitar a correção: ' +
        erro.message
      );
    } finally {
      setSolicitandoId(null);
    }
  };

  if (!cliente) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-24 font-sans">

      {!modoImpressao && (
        <header className="bg-white dark:bg-zinc-900 sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 px-6 py-5 flex items-center gap-3">

          <button
            onClick={() => setTela('relatorio')}
            className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500"
          >
            <ArrowLeft size={20} />
          </button>

          <h1 className="text-xl font-black uppercase tracking-tight dark:text-white">
            Relatório
          </h1>

        </header>
      )}

      <main className="p-5 max-w-md mx-auto space-y-6">
        <section className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
          {fotoProfissional && <img src={fotoProfissional} alt="Foto ou logo do profissional" className="w-20 h-20 shrink-0 rounded-xl object-contain bg-white border border-zinc-100 p-1" onError={() => setFotoProfissional('')} />}
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 mb-1">Profissional / empresa</p>
            <h2 className="font-black text-xl text-teal-600 dark:text-teal-400 break-words">{perfil.empresa || 'Mão Na Água'}</h2>
            {perfil.cidade && <p className="text-xs text-zinc-500 mt-1">{perfil.cidade}</p>}
          </div>
        </section>

        {/* IDENTIFICAÇÃO DO CLIENTE */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-zinc-200 dark:border-zinc-800">

          <h2 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">
            {identificacaoCliente(cliente)}
          </h2>

          <p className="text-xs text-zinc-500 flex items-center gap-1 mt-3">
            <MapPin size={13} />
            {cliente.endereco || 'Endereço não informado'}
          </p>

        </section>

        {/* ESCOLHER PERÍODO DO RELATÓRIO */}
        {!modoImpressao && (
          <section className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">

            <h3 className="text-sm font-black uppercase text-zinc-800 dark:text-white flex items-center gap-2 mb-4">
              <CalendarDays
                size={18}
                className="text-teal-500"
              />
              Escolha o relatório
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-4">

              <button
                type="button"
                onClick={() => setTipoRelatorio('dia')}
                className={`py-3 px-2 rounded-xl font-bold text-xs transition-all ${
                  tipoRelatorio === 'dia'
                    ? 'bg-teal-500 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-zinc-800 text-zinc-500'
                }`}
              >
                RELATÓRIO DO DIA
              </button>

              <button
                type="button"
                onClick={() => setTipoRelatorio('mes')}
                className={`py-3 px-2 rounded-xl font-bold text-xs transition-all ${
                  tipoRelatorio === 'mes'
                    ? 'bg-teal-500 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-zinc-800 text-zinc-500'
                }`}
              >
                RELATÓRIO DO MÊS
              </button>

            </div>

            <label className="block text-xs font-bold text-zinc-500 mb-2">
              {tipoRelatorio === 'dia'
                ? 'Selecione o dia da visita'
                : 'Selecione o mês'}
            </label>

            {tipoRelatorio === 'dia' ? (
              <select
                value={dataAtiva}
                onChange={e =>
                  setDataSelecionada(e.target.value)
                }
                disabled={!datasDisponiveis.length}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white font-bold text-sm outline-none"
              >
                {datasDisponiveis.length === 0 && (
                  <option value="">
                    Nenhuma visita disponível
                  </option>
                )}

                {datasDisponiveis.map(data => (
                  <option
                    key={data}
                    value={data}
                  >
                    {formatarData(data)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={mesAtivo}
                onChange={e =>
                  setMesSelecionado(e.target.value)
                }
                disabled={!mesesDisponiveis.length}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white font-bold text-sm outline-none"
              >
                {mesesDisponiveis.length === 0 && (
                  <option value="">
                    Nenhum mês disponível
                  </option>
                )}

                {mesesDisponiveis.map(mes => (
                  <option
                    key={mes}
                    value={mes}
                  >
                    {formatarMes(mes)}
                  </option>
                ))}
              </select>
            )}

            <div className="mt-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 p-3 rounded-xl">

              <p className="text-xs font-bold text-teal-700 dark:text-teal-400">
                Período selecionado: {periodoDescricao}
              </p>

              <p className="text-[11px] text-zinc-500 mt-1">
                {visitasFiltradas.length} visita(s) e{' '}
                {totalFotos} foto(s)
              </p>

            </div>

          </section>
        )}

        {/* COMPARTILHAMENTO */}
        {!modoImpressao && (
          <section className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() => handleWhatsApp(false)}
                disabled={
                  carregando ||
                  !historicoFiltrado.length || funcionario
                }
                className="bg-green-500 text-white font-bold py-3.5 px-2 rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs disabled:opacity-50"
              >
                <MessageSquare size={17} />
                PRODUTOS SEM PREÇOS
              </button>
              <button onClick={() => handleWhatsApp(true)} disabled={carregando || !visitasFiltradas.length || funcionario} className="bg-green-600 text-white font-bold py-3.5 px-2 rounded-xl flex items-center justify-center gap-2 text-xs disabled:opacity-50">PRODUTOS COM PREÇOS</button>

              <button
                onClick={handleSharePDF}
                disabled={
                  loadingPDF ||
                  carregando ||
                  !historicoFiltrado.length
                }
                className="col-span-2 bg-zinc-800 text-white font-bold py-3.5 px-2 rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs disabled:opacity-50"
              >
                {loadingPDF ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <FileText size={17} />
                )}

                GERAR PDF
              </button>

            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              O WhatsApp abre somente os produtos a repor do período selecionado.
              Para compartilhar o documento com fotos,
              gere o PDF e anexe o arquivo na conversa.
            </p>

          </section>
        )}

        {/* CARREGAMENTO */}
        {carregando && (
          <div className="flex justify-center items-center gap-2 py-8 text-zinc-500">
            <Loader2
              size={22}
              className="animate-spin"
            />
            Carregando registros...
          </div>
        )}

        {/* HISTÓRICO DE PARÂMETROS */}
        {!carregando && (
          <section>

            <h3 className="text-sm font-black text-zinc-800 dark:text-white uppercase flex items-center gap-2 mb-4">

              <div className="bg-sky-100 text-sky-500 p-1.5 rounded-lg">
                <Droplets size={16} />
              </div>

              Histórico de Parâmetros
            </h3>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">

              {visitasFiltradas.length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-10">
                  Nenhuma visita neste período.
                </p>
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full text-center text-[10px]">

                    <thead className="bg-zinc-900 text-white text-[9px] uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-1">Data</th>
                        <th className="py-3 px-1">Status</th>
                        <th className="py-3 px-1 text-sky-400">Horário</th>
                        <th className="py-3 px-1">CL</th>
                        <th className="py-3 px-1">PH</th>
                        <th className="py-3 px-1">ALC</th>
                        <th className="py-3 px-1">TEMP</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">

                      {visitasFiltradas.map((visita, index) => {
                        const aspectoTexto =
                          visita.asp || visita.a || '';

                        const aspectoLower =
                          String(aspectoTexto).toLowerCase();

                        let corAspecto = 'text-zinc-500';

                        if (
                          aspectoLower.includes('cristalina')
                        ) {
                          corAspecto = 'text-teal-500';
                        } else if (
                          aspectoLower.includes('turva')
                        ) {
                          corAspecto = 'text-amber-500';
                        } else if (
                          aspectoLower.includes('verde')
                        ) {
                          corAspecto = 'text-emerald-500';
                        }

                        const {
                          hora,
                          duracao,
                          temperatura
                        } = extrairDadosRegistro(visita);

                        return (
                          <tr
                            key={visita.id || index}
                            className="font-bold text-zinc-700 dark:text-zinc-300"
                          >
                            <td className="py-4 px-1">
                              {visita.d}
                              {visita.antecipacaoDescricao && <p className="text-[10px] font-normal text-teal-600">{visita.antecipacaoDescricao}</p>}
                              {visita.funcionarioNome && <p className="text-[10px] font-normal text-teal-600">{visita.funcionarioNome}</p>}
                            </td>

                            <td className={`py-4 px-1 uppercase ${corAspecto}`}>
                              {aspectoTexto || '--'}
                            </td>

                            <td className="py-4 px-1">
                              <div className="flex flex-col items-center">
                                <span>{hora || '--'}</span>

                                {duracao && (
                                  <span className="text-emerald-500 text-[8px] flex items-center gap-1 mt-1">
                                    <Clock size={9} />
                                    {duracao}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-1">
                              {visita.c || '--'}
                            </td>

                            <td className="py-4 px-1">
                              {visita.p || '--'}
                            </td>

                            <td className="py-4 px-1">
                              {visita.al || '--'}
                            </td>

                            <td className="py-4 px-1">
                              {temperatura}
                            </td>
                          </tr>
                        );
                      })}

                    </tbody>
                  </table>

                </div>
              )}

            </div>
          </section>
        )}

        {/* FOTOS ORGANIZADAS POR VISITA */}
        {!carregando && (
          <section>

            <h3 className="text-sm font-black text-zinc-800 dark:text-white uppercase flex items-center gap-2 mb-4">

              <div className="bg-emerald-100 text-emerald-500 p-1.5 rounded-lg">
                <Images size={16} />
              </div>

              Resumo Fotográfico
            </h3>

            {gruposFotograficos.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center text-sm text-zinc-400">
                Nenhuma foto registrada neste período.
              </div>
            ) : (
              <div className="space-y-6">

                {gruposFotograficos.map(
                  (grupo, index) => {
                    const {
                      hora,
                      duracao
                    } = extrairDadosRegistro(
                      grupo.visita
                    );

                    return (
                      <div
                        key={grupo.chave}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm"
                      >

                        {/* CABEÇALHO DO GRUPO */}
                        <div className="bg-zinc-900 px-4 py-4">

                          <div className="flex justify-between items-center gap-3">

                            <div className="flex items-center gap-2">

                              <CalendarDays
                                size={17}
                                className="text-teal-400"
                              />

                              <div>
                                <p className="text-white font-black text-sm">
                                  {formatarData(grupo.data)}
                                </p>

                                <p className="text-zinc-400 text-[10px] mt-1">
                                  Visita {index + 1}
                                  {hora ? ` • ${hora}` : ''}
                                  {duracao ? ` • ${duracao}` : ''}
                                </p>
                              </div>

                            </div>

                            <span className="bg-teal-500/20 text-teal-300 px-2.5 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap">
                              {grupo.fotos.length} FOTOS
                            </span>

                          </div>
                        </div>

                        {/* TODAS AS FOTOS DA VISITA */}
                        <div className="p-3">

                          <div className="grid grid-cols-3 gap-2">

                            {grupo.fotos.map(
                              (foto, fotoIndex) => (
                                <a
                                  key={`${grupo.chave}-${fotoIndex}`}
                                  href={foto}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 block"
                                >

                                  <img
                                    src={foto}
                                    alt={`Foto ${fotoIndex + 1} da visita de ${formatarData(grupo.data)}`}
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                    loading="lazy"
                                  />

                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-center">
                                    <span className="text-[9px] text-white font-bold">
                                      FOTO {fotoIndex + 1}
                                    </span>
                                  </div>

                                </a>
                              )
                            )}

                          </div>

                          <p className="text-[10px] text-zinc-400 mt-3 text-center">
                            Toque em uma foto para ampliar.
                          </p>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>
        )}

        {/* OCORRÊNCIAS E ALERTAS */}
        {!carregando &&
          ocorrenciasFiltradas.length > 0 && (
            <section>

              <h3 className="text-sm font-black text-rose-600 uppercase flex items-center gap-2 mb-4">
                <AlertTriangle size={18} />
                Ocorrências e Alertas
              </h3>

              <div className="space-y-4">

                {ocorrenciasFiltradas.map(
                  (ocorrencia, index) => {
                    const fotos = listarFotos(
                      ocorrencia,
                      true
                    );

                    return (
                      <div
                        key={ocorrencia.id || index}
                        className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-4"
                      >

                        <p className="text-xs font-black text-rose-600 mb-2">
                          {ocorrencia.d}
                          {ocorrencia.h
                            ? ` • ${ocorrencia.h}`
                            : ''}
                        </p>

                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3 whitespace-pre-wrap">
                          {ocorrencia.txtA ||
                            'Ocorrência registrada sem descrição.'}
                        </p>

                        {!funcionario && <button type="button" className="w-full mb-3 py-3 rounded-xl border border-rose-300 text-rose-600 text-xs font-bold" onClick={async () => { try { await enviarOcorrenciaPDF(cliente, ocorrencia, perfil, clienteSupabase); } catch (e) { alert(e.message); } }}>Compartilhar PDF da ocorrência técnica</button>}
                        {fotos.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">

                            {fotos.map((foto, fotoIndex) => (
                              <a
                                key={fotoIndex}
                                href={foto}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="aspect-square rounded-xl overflow-hidden"
                              >
                                <img
                                  src={foto}
                                  alt={`Foto da ocorrência ${fotoIndex + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ))}

                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            </section>
          )}

        {historicoFiltrado.filter(v => v.tipo === 'cancelamento').map(c => <article key={c.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm space-y-2">
          <h3 className="font-bold text-zinc-600 dark:text-zinc-300">Atendimento cancelado · limpeza não realizada</h3>
          <p>{c.funcionarioNome} · {new Date(c.canceladoEm).toLocaleString('pt-BR', { timeZone: FUSO_AGENDA })}</p>
          <p>Iniciado em {new Date(c.iniciadoEm).toLocaleString('pt-BR', { timeZone: FUSO_AGENDA })}</p>
          <p>Motivo: {c.motivo}</p>
          <p>{c.novaData ? `Limpeza remarcada para ${formatarDataAgenda(c.novaData)}` : 'A ocorrência continua pendente na agenda.'}</p>
          {Object.keys(c.rascunho || {}).length > 0 && <details><summary className="min-h-11 cursor-pointer">Rascunho preservado (não é relatório de limpeza)</summary>
            {['ph','cloro','alcalinidade','temperatura','aspecto','observacoes','observacao_tecnica'].map(k => c.rascunho[k] ? <p key={k}>{k}: {c.rascunho[k]}</p> : null)}
            {(c.rascunho.produtos || []).map((p,i) => <p key={i}>{p.nome} · {p.qtd || 1} unidade(s)</p>)}
            <div className="grid grid-cols-2 gap-2">{(c.fotos || []).map((f,i) => <img key={i} src={f} alt="Foto preservada do atendimento cancelado" className="rounded-xl w-full" />)}</div>
          </details>}
        </article>)}
        {historicoFiltrado.filter(v => v.tipo === 'antecipacao').map(a => <article key={a.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm space-y-2"><h3 className="font-bold text-teal-600">Histórico de antecipação</h3><p className="whitespace-pre-wrap break-words">{a.descricao}</p><p>{a.status}</p>{a.dataEfetiva && <p>Data efetiva do atendimento: {a.dataEfetiva}</p>}<p className="text-xs text-zinc-500">Registrada em {new Date(a.criadoEm).toLocaleString('pt-BR', { timeZone: FUSO_AGENDA })}</p></article>)}
        {adiamentosFiltrados.length > 0 && <section className="space-y-3">
          <h3 className="text-sm font-black uppercase text-zinc-800 dark:text-white">Histórico de adiamentos</h3>
          {adiamentosFiltrados.map(a => <article key={a.id} className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 space-y-2 text-sm">
            <h4 className="font-bold text-amber-600">Visita adiada</h4>
            <p>Data original: {formatarDataAgenda(a.dataOriginal)} {a.horarioOriginal}</p>
            <p>Registrado em: {new Date(a.criadoEm).toLocaleString('pt-BR', { timeZone: FUSO_AGENDA })}</p>
            {a.comparecimentoEm && <p>Comparecimento: {new Date(a.comparecimentoEm).toLocaleString('pt-BR', { timeZone: FUSO_AGENDA })}</p>}
            <p className="whitespace-pre-wrap break-words">Motivo: {a.motivo}</p>
            <p className="font-bold text-teal-600">Nova data: {formatarDataAgenda(a.novaData)}</p>
            {(a.fotos || []).map((foto, index) => <img key={index} src={foto} alt="Comprovação de comparecimento" className="w-full max-h-72 object-contain rounded-xl" />)}
          </article>)}
        </section>}
        {/* GERENCIAR VISITAS */}
        {!modoImpressao &&
          !carregando &&
          visitasFiltradas.length > 0 && (
            <section>

              <h3 className="text-sm font-black text-zinc-800 dark:text-white uppercase flex items-center gap-2 mb-4">

                {funcionario ? (
                  <LockKeyhole
                    size={18}
                    className="text-amber-500"
                  />
                ) : (
                  <Pencil
                    size={18}
                    className="text-teal-500"
                  />
                )}

                Gerenciar Visitas
              </h3>

              <div className="space-y-3">

                {visitasFiltradas.map(
                  (visita, index) => {
                    const id =
                      visita.id || visita.vId;

                    const solicitando =
                      solicitandoId === id;

                    return (
                      <div
                        key={id || index}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm"
                      >

                        <div className="flex items-center justify-between mb-3">

                          <div>
                            <p className="font-black text-sm text-zinc-800 dark:text-white">
                              Visita de {visita.d}
                            </p>
                            {visita.funcionarioNome && <p className="text-xs text-teal-600">Responsável: {visita.funcionarioNome}</p>}

                            <p className="text-[11px] text-zinc-500 mt-1">
                              {visita.h || 'Horário não informado'}
                            </p>
                          </div>

                          <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg">
                            Finalizada
                          </span>

                        </div>

                        {!funcionario && <div className="space-y-2 mb-3">
                          <button onClick={() => enviarProdutosSalvos(visita, false)} className="w-full py-3 rounded-xl border border-teal-300 dark:border-teal-800 text-teal-600 text-xs font-bold">Enviar somente a lista pelo WhatsApp</button>
                          <button onClick={() => enviarProdutosSalvos(visita, true)} className="w-full py-3 rounded-xl border border-teal-300 dark:border-teal-800 text-teal-600 text-xs font-bold">Enviar com valores e total pelo WhatsApp</button>
                        </div>}
                        {funcionario ? (
                          <button
                            onClick={() =>
                              handleSolicitarCorrecao(visita)
                            }
                            disabled={solicitando}
                            className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {solicitando ? (
                              <Loader2
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Send size={16} />
                            )}

                            SOLICITAR CORREÇÃO
                          </button>
                        ) : podeEditar ? (
                          <button
                            onClick={() =>
                              handleEditarVisita(visita)
                            }
                            className="w-full bg-teal-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                          >
                            <Pencil size={16} />
                            EDITAR VISITA
                          </button>
                        ) : (
                          <p className="text-xs text-zinc-500 text-center py-2">
                            Edição indisponível para esta conta.
                          </p>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            </section>
          )}

        {/* RODAPÉ */}
        <footer className="bg-zinc-900 text-center p-8 rounded-2xl border-t-4 border-teal-500 mt-8">

          <h3 className="text-white text-lg font-black mb-3">
            Obrigado pela confiança!
          </h3>

          <p className="text-zinc-400 text-xs leading-relaxed">
            Este serviço utiliza a tecnologia e o
            padrão de qualidade Mão Na Água.
          </p>

          <div className="mt-5 flex justify-center items-center gap-2 text-teal-400">
            <Camera size={14} />

            <span className="text-[10px] font-bold">
              Registro fotográfico de manutenção
            </span>
          </div>

        </footer>

      </main>
    </div>
  );
}
