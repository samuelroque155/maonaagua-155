const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const INSTITUICOES = [
  'InfinitePay', 'Nubank', 'Banco Inter', 'Mercado Pago', 'PagBank', 'Itaú',
  'Bradesco', 'Banco do Brasil', 'Caixa', 'Outros bancos'
];

export function centavos(valor) {
  if (typeof valor === 'string') {
    valor = valor.trim().replace(/[^\d,.-]/g, '');
    if (valor.includes(',')) valor = valor.replace(/\./g, '').replace(',', '.');
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round((numero + Number.EPSILON) * 100);
}

export const moeda = valor => MOEDA.format((Number(valor) || 0) / 100);

export function competenciaMes(ano, mes) {
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, 1));
  if (!Number.isFinite(data.getTime())) throw new Error('Selecione uma competência válida.');
  return data.toISOString().slice(0, 10);
}

export function vencimentoMensal(competencia, dia) {
  const [ano, mes] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!ano || !mes || !Number.isInteger(Number(dia)) || Number(dia) < 1 || Number(dia) > 31) {
    throw new Error('Confira o mês e o dia de vencimento.');
  }
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(Number(dia), ultimoDia)).padStart(2, '0')}`;
}

export function totalLiquido(pagamentos = [], { incluirPendentes = false } = {}) {
  return pagamentos.reduce((total, p) => {
    if (!incluirPendentes && p.sync_status === 'pendente') return total;
    return total + centavos(p.valor);
  }, 0);
}

export function saldoCobranca(cobranca, pagamentos = [], opcoes) {
  return Math.max(0, centavos(cobranca.valor) - totalLiquido(pagamentos, opcoes));
}

export function statusCobranca(cobranca, pagamentos = [], hoje = new Date().toISOString().slice(0, 10)) {
  if (cobranca.status === 'cancelada') return 'cancelada';
  const pago = totalLiquido(pagamentos);
  const total = centavos(cobranca.valor);
  if (total > 0 && pago >= total) return 'pago';
  if (pago > 0) return 'parcial';
  return cobranca.vencimento < hoje ? 'atrasado' : 'pendente';
}

export function calcularResumo(cobrancas = [], pagamentos = [], competencia, hoje) {
  const doMes = cobrancas.filter(c => String(c.competencia).slice(0, 7) === String(competencia).slice(0, 7));
  const porCobranca = c => pagamentos.filter(p => p.cobranca_id === c.id);
  const ativas = doMes.filter(c => c.status !== 'cancelada');
  const recebido = pagamentos.filter(p => String(p.pago_em || p.criado_em || '').slice(0, 7) === String(competencia).slice(0, 7));
  const recebidoConfirmado = totalLiquido(recebido);
  return {
    previsto: ativas.reduce((s, c) => s + centavos(c.valor), 0),
    recebido: recebidoConfirmado,
    aReceber: ativas.reduce((s, c) => s + saldoCobranca(c, porCobranca(c)), 0),
    atrasado: ativas.filter(c => statusCobranca(c, porCobranca(c), hoje) === 'atrasado')
      .reduce((s, c) => s + saldoCobranca(c, porCobranca(c)), 0),
    clientesPagantes: ativas.filter(c => statusCobranca(c, porCobranca(c), hoje) === 'pago').length,
    clientesPendentes: ativas.filter(c => ['pendente', 'atrasado', 'parcial'].includes(statusCobranca(c, porCobranca(c), hoje))).length
  };
}

export function crc16Pix(texto) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, valor) {
  const tamanho = new TextEncoder().encode(valor).length;
  if (tamanho > 99) throw new Error('Um dado do Pix excede o limite do padrão.');
  return `${id}${String(tamanho).padStart(2, '0')}${valor}`;
}

function normalizarTextoPix(valor, limite) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, limite) || 'NAO INFORMADO';
}

export function gerarPixCopiaECola({ chave, nome, cidade, valor, referencia }) {
  const pixKey = String(chave || '').trim();
  if (!pixKey) throw new Error('Cadastre uma chave Pix na conta de recebimento.');
  const valorCentavos = centavos(valor);
  if (valor != null && valor !== '' && valorCentavos <= 0) throw new Error('O valor do Pix deve ser maior que zero.');
  const txid = String(referencia || '***').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const contaPix = tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey);
  let payload = tlv('00', '01') + tlv('01', '11') + tlv('26', contaPix) + tlv('52', '0000') + tlv('53', '986');
  if (valorCentavos > 0) payload += tlv('54', (valorCentavos / 100).toFixed(2));
  payload += tlv('58', 'BR') + tlv('59', normalizarTextoPix(nome, 25)) + tlv('60', normalizarTextoPix(cidade, 15));
  payload += tlv('62', tlv('05', txid)) + '6304';
  return payload + crc16Pix(payload);
}

export function mensagemCobranca({ cliente, cobranca, conta, perfil, codigoPix }) {
  if (!cliente?.nome || !cobranca) throw new Error('Confira o cliente e a cobrança antes de compartilhar.');
  const valor = MOEDA.format(centavos(cobranca.valor) / 100);
  const vencimento = new Date(`${cobranca.vencimento}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const pagamento = cobranca.link_pagamento || conta?.link_pagamento || conta?.link_recorrencia
    ? `Link de pagamento: ${cobranca.link_pagamento || conta?.link_pagamento || conta?.link_recorrencia}`
    : conta?.chave_pix ? `Pix ${conta.tipo_chave_pix || 'chave'}: ${conta.chave_pix}${codigoPix ? `\nPix Copia e Cola: ${codigoPix}` : ''}`
      : 'Combine a forma de pagamento diretamente comigo.';
  const empresa = String(perfil?.empresa || perfil?.nome || '').trim();
  if (!empresa) throw new Error('Cadastre o nome profissional nas configurações do perfil.');
  return [`Olá, ${cliente.nome}!`, '', 'Sua mensalidade referente aos serviços de manutenção da piscina está disponível.', '', `Valor: ${valor}`, `Vencimento: ${vencimento}`, '', `Descrição: ${cobranca.descricao || 'Manutenção mensal de piscina.'}`, '', 'Pagamento:', pagamento, '', `Atenciosamente,\n${empresa}`].join('\n');
}

export function chavePixTemFormatoPlausivel(tipo, chave) {
  const valor = String(chave || '').trim();
  if (!valor) return false;
  if (tipo === 'cpf') return valor.replace(/\D/g, '').length === 11;
  if (tipo === 'cnpj') return valor.replace(/\D/g, '').length === 14;
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  if (tipo === 'telefone') return /^\+?\d{10,15}$/.test(valor.replace(/[\s()-]/g, ''));
  if (tipo === 'aleatoria') return /^[0-9a-f-]{32,36}$/i.test(valor);
  return false;
}
