import { nomeProfissional } from './perfilService.js';

const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function precoInformado(preco) {
  // O app antigo usava zero para representar um campo ainda n\u00e3o preenchido.
  if (preco === '' || preco === null || preco === undefined) return null;
  const valor = typeof preco === 'string' ? Number(preco.replace(',', '.')) : Number(preco);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

export function resumirProdutos(produtos) {
  let centavos = 0;
  let semPreco = 0;
  for (const produto of produtos) {
    const preco = precoInformado(produto.preco);
    if (preco === null) { semPreco += 1; continue; }
    centavos += Math.round(preco * 100) * Math.max(1, Number(produto.qtd) || 1);
  }
  return { total: centavos / 100, semPreco };
}

export function mensagemProdutos({ cliente, perfil, produtos, comValores = false }) {
  produtos = produtosParaReposicao(produtos);
  if (!produtos.length) throw new Error('Selecione pelo menos um produto ou acess\u00f3rio.');
  const empresa = nomeProfissional(perfil);
  if (!empresa) throw new Error('Cadastre e salve seu nome profissional em Configura\u00e7\u00f5es antes de enviar a lista.');
  const linhas = [
    `Ol\u00e1, ${cliente.nome}! Tudo bem?`,
    '',
    comValores
      ? 'Segue a lista dos produtos necess\u00e1rios para a manuten\u00e7\u00e3o da sua piscina:'
      : 'Segue a lista dos produtos que precisam ser repostos para a manuten\u00e7\u00e3o da sua piscina:',
    '',
    ' *PRODUTOS A REPOR*',
    ''
  ];
  for (const produto of produtos) {
    const item = `\u2022 ${quantidadeProduto(produto.qtd)} \u2014 ${produto.nome}`;
    if (!comValores) { linhas.push(item); continue; }
    const preco = precoInformado(produto.preco);
    linhas.push(preco === null
      ? `${item} \u2014 pre\u00e7o n\u00e3o informado`
      : `${item} \u2014 ${moeda(preco)}`);
  }
  if (comValores) {
    const { total, semPreco } = resumirProdutos(produtos);
    if (!semPreco) linhas.push('', ` *TOTAL: ${moeda(total)}*`);
    else linhas.push('', `Subtotal dos itens com pre\u00e7o informado: ${moeda(total)}. Informe os demais valores para calcular o total.`);
  }
  linhas.push('', 'Por favor, confirme a reposi\u00e7\u00e3o para mantermos o cuidado com sua piscina.', '', `Atenciosamente,\n${empresa}`);
  return linhas.join('\n');
}

export function urlWhatsApp(telefone, mensagem) {
  let fone = String(telefone || '').replace(/\D/g, '');
  // DDD 55 também é brasileiro: o tamanho distingue DDD de código do país.
  if (fone.length === 10 || fone.length === 11) fone = '55' + fone;
  const destino = fone ? `phone=${fone}&` : '';
  return `https://api.whatsapp.com/send?${destino}text=${encodeURIComponent(mensagem)}`;
}

export function mensagemProdutosSimples({ cliente, perfil, produtos = [] }) {
  const itens = produtosParaReposicao(produtos);
  if (!itens.length) throw new Error('Esta visita n\u00e3o tem produtos a repor registrados.');
  const empresa = nomeProfissional(perfil);
  if (!empresa) throw new Error('Cadastre seu nome profissional ou da empresa antes de compartilhar.');
  return [`Ol\u00e1, ${cliente.nome}! Tudo bem?`, '', 'Segue a lista dos produtos que precisam ser repostos para a manuten\u00e7\u00e3o da sua piscina:', '', ' *PRODUTOS A REPOR*', '',
    ...itens.map(p => `\u2022 ${quantidadeProduto(p.qtd)} \u2014 ${p.nome}`), '', 'Por favor, confirme a reposi\u00e7\u00e3o para mantermos o cuidado com sua piscina.', '', `Atenciosamente,\n${empresa}`].join('\n');
}

function quantidadeProduto(valor) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(valor) || 1);
}

export function produtosParaReposicao(produtos = []) {
  return produtos.filter(p => p.faltando !== false && p.selecionado !== false && String(p.nome || '').trim() && (p.qtd == null || Number(p.qtd) > 0))
    .map(p => ({ ...p, nome: String(p.nome).trim(), qtd: p.qtd == null ? 1 : Number(p.qtd) }));
}
