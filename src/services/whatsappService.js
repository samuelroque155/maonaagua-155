import { nomeProfissional } from './perfilService.js';

const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function precoInformado(preco) {
  // O app antigo usava zero para representar um campo ainda não preenchido.
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
  if (!produtos.length) throw new Error('Selecione pelo menos um produto ou acessório.');
  const empresa = nomeProfissional(perfil);
  if (!empresa) throw new Error('Cadastre e salve seu nome profissional em Configurações antes de enviar a lista.');
  const linhas = [
    `*${empresa}*`,
    `Olá, ${cliente.nome}!`,
    '',
    '🧾 Produtos e acessórios para reposição da sua piscina:',
    ''
  ];
  for (const produto of produtos) {
    if (!comValores) { linhas.push(`• ${produto.nome}`); continue; }
    const qtd = Math.max(1, Number(produto.qtd) || 1);
    const preco = precoInformado(produto.preco);
    linhas.push(preco === null
      ? `• ${qtd}x ${produto.nome} — preço não informado`
      : `• ${qtd}x ${produto.nome} — ${moeda(preco)} por unidade; subtotal ${moeda(Math.round(preco * 100) * qtd / 100)}`);
  }
  if (comValores) {
    const { total, semPreco } = resumirProdutos(produtos);
    linhas.push('', semPreco ? `*Subtotal dos itens com preço: ${moeda(total)}*` : `*Total da lista: ${moeda(total)}*`);
    if (semPreco) linhas.push('Total da lista pendente: há itens com preço não informado.');
  }
  linhas.push('', 'Por favor, confirme a reposição para mantermos o cuidado com sua piscina.', '', `Atenciosamente,\n${empresa}`);
  return linhas.join('\n');
}

export function urlWhatsApp(telefone, mensagem) {
  let fone = String(telefone || '').replace(/\D/g, '');
  // DDD 55 também é brasileiro: o tamanho distingue DDD de código do país.
  if (fone.length === 10 || fone.length === 11) fone = '55' + fone;
  const destino = fone ? `phone=${fone}&` : '';
  return `https://api.whatsapp.com/send?${destino}text=${encodeURIComponent(mensagem)}`;
}
