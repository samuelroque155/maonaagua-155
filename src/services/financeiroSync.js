import { lerArquivoLocal, salvarArquivoLocal } from './arquivoLocalService.js';

export const TABELAS_FINANCEIRAS = {
  contas: 'contas_recebimento',
  cadastros: 'clientes_financeiro',
  cobrancas: 'cobrancas_financeiras',
  pagamentos: 'pagamentos_financeiros'
};

export const estadoFinanceiroVazio = () => ({ contas: [], cadastros: [], cobrancas: [], pagamentos: [], fila: [] });

export function pendenciasFinanceiras(estado) {
  return (estado?.fila || []).length;
}

export function adicionarNaFilaFinanceira(estado, tabela, registro) {
  if (!registro?.user_id || registro.user_id !== estado.user_id) throw new Error('A alteração financeira pertence a outra conta.');
  const chave = registro.cliente_id ?? registro.id;
  const fila = (estado.fila || []).filter(p => !(p.tabela === tabela && String(p.chave) === String(chave)));
  const anterior = (estado.fila || []).find(p => p.tabela === tabela && String(p.chave) === String(chave));
  const registroFila = { ...(anterior?.registro || {}), ...registro, sync_status: 'pendente' };
  fila.push({ tabela, chave, registro: registroFila });
  const mapa = { ...estado, fila };
  const colecao = Object.keys(TABELAS_FINANCEIRAS).find(k => TABELAS_FINANCEIRAS[k] === tabela);
  if (colecao) {
    const campo = tabela === TABELAS_FINANCEIRAS.cadastros ? 'cliente_id' : 'id';
    mapa[colecao] = [...(estado[colecao] || []).filter(x => String(x[campo]) !== String(registro[campo])), registroFila];
  }
  return mapa;
}

const campoConflito = tabela => tabela === TABELAS_FINANCEIRAS.cadastros ? 'user_id,cliente_id' : 'id';
const porTabela = tabela => Object.keys(TABELAS_FINANCEIRAS).find(k => TABELAS_FINANCEIRAS[k] === tabela);
const erroRede = erro => erro instanceof TypeError || /fetch|network|timeout|offline|failed to connect/i.test(`${erro?.message || ''} ${erro?.details || ''}`);

export async function sincronizarFilaFinanceira(client, estado, uid, storage = {}) {
  const salvar = storage.salvar || salvarArquivoLocal;
  if (!estado.fila?.length) return estado;
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user?.id !== uid || estado.user_id !== uid) throw new Error('A sessão mudou. As alterações financeiras ficaram no aparelho.');
  let atual = { ...estado, fila: [...estado.fila] };
  for (const pendente of [...estado.fila]) {
    if (pendente.registro.user_id !== uid) throw new Error('A fila contém uma alteração de outra conta.');
    const payload = Object.fromEntries(Object.entries(pendente.registro).filter(([k]) => k !== 'sync_status'));
    let erroSalvar;
    if (pendente.tabela === TABELAS_FINANCEIRAS.pagamentos) {
      const resultado = await client.from(pendente.tabela).insert(payload);
      erroSalvar = resultado.error;
      if (erroSalvar?.code === '23505') {
        const existente = await client.from(pendente.tabela).select('id,user_id,cobranca_id,valor,tipo,corrige_pagamento_id')
          .eq('id', payload.id).eq('user_id', uid).maybeSingle();
        if (!existente.error && existente.data && existente.data.cobranca_id === payload.cobranca_id &&
          Number(existente.data.valor) === Number(payload.valor) && existente.data.tipo === payload.tipo &&
          (existente.data.corrige_pagamento_id || null) === (payload.corrige_pagamento_id || null)) erroSalvar = null;
      }
    } else {
      const resultado = await client.from(pendente.tabela).upsert(payload, { onConflict: campoConflito(pendente.tabela) });
      erroSalvar = resultado.error;
    }
    if (erroSalvar) {
      if (erroRede(erroSalvar)) break;
      if (['42P01', '42883', 'PGRST202', 'PGRST205', 'PGRST204'].includes(erroSalvar.code)) break;
      throw erroSalvar;
    }
    const colecao = porTabela(pendente.tabela);
    const campo = pendente.tabela === TABELAS_FINANCEIRAS.cadastros ? 'cliente_id' : 'id';
    atual = {
      ...atual,
      fila: atual.fila.filter(x => !(x.tabela === pendente.tabela && String(x.chave) === String(pendente.chave))),
      [colecao]: atual[colecao].map(x => String(x[campo]) === String(pendente.registro[campo]) ? { ...x, sync_status: 'sincronizado' } : x)
    };
    await salvar(uid, 'financeiro', 'cache', atual);
  }
  return atual;
}

export async function salvarOperacaoFinanceira(client, estado, uid, tabela, registro, storage = {}) {
  const salvar = storage.salvar || salvarArquivoLocal;
  if (!uid || registro.user_id !== uid) throw new Error('Entre na conta proprietária para salvar dados financeiros.');
  let atual = adicionarNaFilaFinanceira({ ...estado, user_id: uid }, tabela, registro);
  await salvar(uid, 'financeiro', 'cache', atual);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { estado: atual, pendente: true };
  try {
    atual = await sincronizarFilaFinanceira(client, atual, uid, { salvar });
    return { estado: atual, pendente: atual.fila.some(x => x.tabela === tabela && String(x.chave) === String(registro.cliente_id ?? registro.id)) };
  } catch (erro) {
    if (erroRede(erro)) return { estado: atual, pendente: true };
    if (['42P01', '42883', 'PGRST202', 'PGRST205', 'PGRST204'].includes(erro?.code)) return { estado: atual, pendente: true, requerMigracao: true };
    throw erro;
  }
}

export async function carregarCacheFinanceiro(uid, storage = {}) {
  const ler = storage.ler || lerArquivoLocal;
  return await ler(uid, 'financeiro', 'cache') || { ...estadoFinanceiroVazio(), user_id: uid };
}

export async function salvarCacheFinanceiro(uid, estado, storage = {}) {
  const salvar = storage.salvar || salvarArquivoLocal;
  return salvar(uid, 'financeiro', 'cache', { ...estado, user_id: uid });
}
