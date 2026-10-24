import {
  estadoFinanceiroVazio, carregarCacheFinanceiro, salvarCacheFinanceiro,
  sincronizarFilaFinanceira, salvarOperacaoFinanceira, TABELAS_FINANCEIRAS
} from './financeiroSync.js';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const UUID = () => crypto.randomUUID();
const ausente = erro => ['42P01', '42883', 'PGRST202', 'PGRST205', 'PGRST204'].includes(erro?.code);

export function mapearCadastroFinanceiro(row) {
  if (!row) return null;
  return {
    id: row.id, cliente_id: row.cliente_id, user_id: row.user_id,
    valor_mensal: row.valor_mensal, dia_vencimento: row.dia_vencimento,
    telefone_cobranca: row.telefone_cobranca || '', forma_pagamento: row.forma_pagamento || 'pix',
    conta_recebimento_id: row.conta_recebimento_id || '', recorrencia_ativa: row.recorrencia_ativa === true,
    descricao: row.descricao || '', link_pagamento: row.link_pagamento || '', updated_at: row.updated_at,
    sync_status: row.sync_status || 'sincronizado'
  };
}

export function cadastroFinanceiroPreenchido(valor = {}) {
  return Boolean(String(valor.valor_mensal ?? '').trim() || String(valor.dia_vencimento ?? '').trim() ||
    String(valor.telefone_cobranca || '').trim() || valor.conta_recebimento_id || valor.link_pagamento ||
    valor.recorrencia_ativa || String(valor.descricao || '').trim() || valor.forma_pagamento);
}

function normalizarCadastro(valor) {
  const tem = cadastroFinanceiroPreenchido(valor);
  if (!tem) return null;
  const mensalidade = Number(String(valor.valor_mensal || '').replace(',', '.'));
  const dia = Number(valor.dia_vencimento);
  if (!Number.isFinite(mensalidade) || mensalidade <= 0) throw new Error('Informe o valor mensal maior que zero.');
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new Error('O vencimento deve ser um dia entre 1 e 31.');
  return {
    valor_mensal: Math.round(mensalidade * 100) / 100,
    dia_vencimento: dia,
    telefone_cobranca: String(valor.telefone_cobranca || '').trim(),
    forma_pagamento: ['pix', 'link', 'dinheiro', 'transferencia', 'infinitepay'].includes(valor.forma_pagamento) ? valor.forma_pagamento : 'pix',
    conta_recebimento_id: valor.conta_recebimento_id || null,
    recorrencia_ativa: valor.recorrencia_ativa === true,
    descricao: String(valor.descricao || 'Manutenção mensal de piscina.').trim().slice(0, 300),
    link_pagamento: String(valor.link_pagamento || '').trim().slice(0, 1000)
  };
}

async function listarTudo(client, tabela, uid) {
  const resultado = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await client.from(tabela).select('*').eq('user_id', uid)
      .order('created_at', { ascending: false }).range(inicio, inicio + 499);
    if (error) throw error;
    resultado.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  return resultado;
}

function mensagemMigracao() {
  return new Error('O módulo financeiro precisa da migração local 20261024011511_financeiro_base.sql antes de sincronizar. Os dados offline foram preservados.');
}

export async function carregarFinanceiro(client, uid, competencia, storage) {
  if (!uid) throw new Error('Entre na sua conta para consultar o financeiro.');
  let cache = await carregarCacheFinanceiro(uid, storage);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ...cache, offline: true };
  cache = await sincronizarFilaFinanceira(client, cache, uid, storage);
  if (competencia) {
    const { error } = await client.rpc('gerar_cobrancas_financeiras', { p_mes: `${String(competencia).slice(0, 7)}-01` });
    if (error) {
      if (ausente(error)) throw mensagemMigracao();
      throw error;
    }
  }
  try {
    const [contas, cadastros, cobrancas, pagamentos] = await Promise.all([
      listarTudo(client, TABELAS_FINANCEIRAS.contas, uid),
      listarTudo(client, TABELAS_FINANCEIRAS.cadastros, uid),
      listarTudo(client, TABELAS_FINANCEIRAS.cobrancas, uid),
      listarTudo(client, TABELAS_FINANCEIRAS.pagamentos, uid)
    ]);
    cache = { user_id: uid, contas, cadastros: cadastros.map(mapearCadastroFinanceiro), cobrancas, pagamentos, fila: cache.fila || [], atualizado_em: new Date().toISOString() };
    await salvarCacheFinanceiro(uid, cache, storage);
    return { ...cache, offline: false };
  } catch (erro) {
    if (ausente(erro)) throw mensagemMigracao();
    throw erro;
  }
}

export async function lerCacheFinanceiro(uid, storage) {
  return carregarCacheFinanceiro(uid, storage);
}

export async function salvarCadastroClienteFinanceiro(client, uid, clienteId, valor, estado = estadoFinanceiroVazio(), storage) {
  const campos = normalizarCadastro(valor);
  if (!campos) return { estado, pendente: false, cadastro: null };
  const atual = estado.cadastros?.find(x => String(x.cliente_id) === String(clienteId));
  if (!atual && valor.dia_vencimento && !String(valor.valor_mensal ?? '').trim()) throw new Error('Informe o valor mensal antes do dia de vencimento.');
  const registro = { ...(atual || {}), ...campos, id: atual?.id || UUID(), user_id: uid, cliente_id: clienteId, updated_at: new Date().toISOString() };
  const resultado = await salvarOperacaoFinanceira(client, estado, uid, TABELAS_FINANCEIRAS.cadastros, registro, storage);
  return { ...resultado, cadastro: mapearCadastroFinanceiro({ ...registro, sync_status: resultado.pendente ? 'pendente' : 'sincronizado' }) };
}

export async function salvarContaRecebimento(client, uid, valor, estado = estadoFinanceiroVazio(), storage) {
  const titular = String(valor.nome_titular || '').trim();
  if (!titular) throw new Error('Informe o nome do titular da conta.');
  if (!valor.instituicao) throw new Error('Selecione a instituição financeira.');
  if (valor.chave_pix && !valor.tipo_chave_pix) throw new Error('Selecione o tipo da chave Pix.');
  const atual = valor.id ? estado.contas.find(x => x.id === valor.id) : null;
  const registro = {
    ...(atual || {}), id: valor.id || UUID(), user_id: uid,
    instituicao: String(valor.instituicao).trim(), nome_instituicao: String(valor.nome_instituicao || '').trim(),
    nome_titular: titular, tipo_chave_pix: valor.tipo_chave_pix || null, chave_pix: String(valor.chave_pix || '').trim(),
    link_pagamento: String(valor.link_pagamento || '').trim(), link_recorrencia: String(valor.link_recorrencia || '').trim(),
    tipo_integracao: valor.tipo_integracao || 'pix_manual', identificador_infinitepay: String(valor.identificador_infinitepay || '').trim(),
    principal: valor.principal === true, ativa: valor.ativa !== false, updated_at: new Date().toISOString()
  };
  if (registro.chave_pix && !/^(cpf|cnpj|email|telefone|aleatoria)$/.test(registro.tipo_chave_pix)) throw new Error('Escolha um tipo de chave Pix compatível.');
  if (registro.link_pagamento && !/^https:\/\//i.test(registro.link_pagamento)) throw new Error('O link de cobrança precisa começar com https://.');
  if (registro.link_recorrencia && !/^https:\/\//i.test(registro.link_recorrencia)) throw new Error('O link do plano precisa começar com https://.');
  if (registro.instituicao === 'InfinitePay' && registro.tipo_integracao === 'infinitepay_checkout') {
    throw new Error('Checkout automático por API ainda não foi habilitado. Use o link de cobrança ou plano gerado no app InfinitePay.');
  }
  if (registro.principal) {
    let estadoAtual = estado;
    for (const conta of estado.contas.filter(c => c.principal && c.id !== registro.id)) {
      estadoAtual = { ...estadoAtual, contas: estadoAtual.contas.map(a => a.id === conta.id ? { ...a, principal: false } : a) };
      const desligada = await salvarOperacaoFinanceira(client, estadoAtual, uid, TABELAS_FINANCEIRAS.contas, { ...conta, principal: false }, storage);
      estadoAtual = desligada.estado;
    }
    estado = estadoAtual;
  }
  const resultado = await salvarOperacaoFinanceira(client, estado, uid, TABELAS_FINANCEIRAS.contas, registro, storage);
  return { ...resultado, conta: { ...registro, sync_status: resultado.pendente ? 'pendente' : 'sincronizado' } };
}

export async function registrarPagamentoManual(client, uid, cobranca, valor, forma, estado, storage) {
  const cent = Math.round(Number(String(valor).replace(',', '.')) * 100);
  if (!Number.isSafeInteger(cent) || cent <= 0) throw new Error('Informe um valor pago maior que zero.');
  const registros = estado.pagamentos.filter(p => p.cobranca_id === cobranca.id);
  const saldo = Math.max(0, Math.round(Number(cobranca.valor) * 100) - registros.reduce((s, p) => s + Math.round(Number(p.valor) * 100), 0));
  if (cent > saldo) throw new Error('O valor informado é maior que o saldo desta cobrança.');
  const registro = {
    id: UUID(), user_id: uid, cobranca_id: cobranca.id, valor: cent / 100, tipo: 'pagamento',
    forma_pagamento: forma || 'pix_manual', origem_confirmacao: 'manual', pago_em: hojeISO(),
    criado_por: uid, observacao: '', created_at: new Date().toISOString()
  };
  return salvarOperacaoFinanceira(client, estado, uid, TABELAS_FINANCEIRAS.pagamentos, registro, storage);
}

export async function estornarPagamento(client, uid, pagamento, estado, storage) {
  if (pagamento.tipo !== 'pagamento' || pagamento.origem_confirmacao !== 'manual') throw new Error('Somente um pagamento manual pode ser corrigido por estorno manual.');
  if (pagamento.sync_status === 'pendente') throw new Error('Sincronize este pagamento antes de corrigi-lo; o original continua preservado no aparelho.');
  if ((estado.pagamentos || []).some(p => p.tipo === 'estorno' && p.corrige_pagamento_id === pagamento.id)) throw new Error('Este registro já tem um estorno.');
  const registro = {
    id: UUID(), user_id: uid, cobranca_id: pagamento.cobranca_id, valor: -Math.abs(Number(pagamento.valor)),
    tipo: 'estorno', forma_pagamento: pagamento.forma_pagamento, origem_confirmacao: 'manual',
    corrigido_por: uid, corrige_pagamento_id: pagamento.id, pago_em: hojeISO(), criado_por: uid,
    observacao: 'Correção de registro manual', created_at: new Date().toISOString()
  };
  return salvarOperacaoFinanceira(client, estado, uid, TABELAS_FINANCEIRAS.pagamentos, registro, storage);
}

export async function cancelarCobranca(client, uid, cobranca, motivo, estado, storage) {
  if (estado.pagamentos.some(p => p.cobranca_id === cobranca.id && Number(p.valor) > 0)) throw new Error('Esta cobrança já tem pagamentos. Corrija os lançamentos pelo histórico.');
  const texto = String(motivo || '').trim();
  if (!texto) throw new Error('Informe o motivo do cancelamento.');
  const registro = { ...cobranca, status: 'cancelada', cancelada_em: new Date().toISOString(), motivo_cancelamento: texto.slice(0, 500) };
  return salvarOperacaoFinanceira(client, estado, uid, TABELAS_FINANCEIRAS.cobrancas, registro, storage);
}
