import { listarAdiamentos } from './adiamentoService.js';

export async function carregarContextoEquipe(client) {
  const { data, error } = await client.rpc('contexto_equipe');
  if (error) throw error;
  if ((data || []).length > 1) throw new Error('Há mais de um vínculo de equipe. Solicite a revisão dos responsáveis.');
  return data?.[0] || null;
}

export function aplicarContextoEquipe(perfil, equipe) {
  return equipe ? {
    ...perfil, tipoConta: 'funcionario', vinculoEmpresa: equipe.employer_uid,
    rotas: equipe.rotas || [], empresaResponsavel: equipe.empresa?.nome || 'Empresa responsável',
    cidadeEmpresa: equipe.empresa?.cidade || '',
    listaProdutos: equipe.empresa?.listaProdutos || perfil.listaProdutos,
    listaAcessorios: equipe.empresa?.listaAcessorios || perfil.listaAcessorios, assinaturaAtiva: equipe.assinatura_ativa === true
  } : { ...perfil, vinculoEmpresa: null, rotas: [],
    tipoConta: perfil.tipoConta === 'funcionario' ? null : perfil.tipoConta };
}

export async function listarFuncionarios(client, ownerId) {
  if (!ownerId) return [];
  const { data, error } = await client.rpc('dados_equipe');
  if (error) throw error;
  return (data?.funcionarios || []).map(f => ({ ...f, email: f.email_funcionario }));
}

export async function salvarFuncionario(client, ownerId, funcionario) {
  const dados = { nome: funcionario.nome.trim(), email_funcionario: funcionario.email.trim().toLowerCase(),
    rotas: funcionario.rotas.map(String), employer_uid: ownerId };
  if (!dados.nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email_funcionario)) {
    throw new Error('Informe nome e email válidos.');
  }
  const pedido = funcionario.id
    ? client.from('equipes_links').update(dados).eq('id', funcionario.id).eq('employer_uid', ownerId)
    : client.from('equipes_links').insert(dados);
  const { data, error } = await pedido.select('id').single();
  if (error) throw error;
  return data;
}

export async function removerFuncionario(client, ownerId, id) {
  const { error } = await client.from('equipes_links').delete().eq('id', id).eq('employer_uid', ownerId);
  if (error) throw error;
}

export async function listarAlertas(client, ownerId) {
  const { data, error } = await client.from('alertas_produtos').select('*, clientes(nome, telefone)')
    .eq('user_id', ownerId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(a => ({ ...a, clienteNome: a.clientes?.nome || 'Cliente',
    clienteTel: a.clientes?.telefone || '', funcionarioAtivo: a.funcionario_nome || 'Responsável',
    data: new Date(a.created_at).toLocaleDateString('pt-BR'), produtos: a.produtos || [] }));
}

export async function listarRelatoriosEquipe(client, ownerId) {
  const visitas = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await client.from('visitas')
      .select('id,cliente_id,criado_por,user_id,data_visita,horario,tipo,clientes(nome)')
      .eq('user_id', ownerId).neq('criado_por', ownerId)
      .order('data_visita', { ascending: false }).order('id')
      .range(inicio, inicio + 499);
    if (error) throw error;
    visitas.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  const adiamentos = await listarAdiamentos(client, ownerId, null, true);
  return [...visitas, ...adiamentos.filter(a => a.criado_por !== ownerId).map(a => ({
    id: `adiamento:${a.id}`, adiamentoId: a.id, cliente_id: a.cliente_id, criado_por: a.criado_por,
    user_id: a.user_id, data_visita: a.criado_em, horario: a.horario_original, tipo: 'adiamento'
  }))].sort((a, b) => new Date(b.data_visita) - new Date(a.data_visita));
}

export async function resolverAlerta(client, ownerId, id) {
  const { error } = await client.from('alertas_produtos').update({ lido: true })
    .eq('id', id).eq('user_id', ownerId);
  if (error) throw error;
}

export async function salvarProdutosEquipe(client, ownerId, visitaId, produtos) {
  const itens = produtos.map(p => {
    const nome = String(p.nome || '').trim();
    const qtd = Number(p.qtd);
    const preco = p.preco === '' || p.preco == null ? null : Number(p.preco);
    if (!nome || !Number.isFinite(qtd) || qtd < 1 || (preco !== null && (!Number.isFinite(preco) || preco < 0))) {
      throw new Error('Informe o nome, quantidade válida e preço válido para cada item.');
    }
    return { nome, qtd, preco };
  });
  const { data, error } = await client.from('visitas').update({ produtos: itens })
    .eq('id', visitaId).eq('user_id', ownerId).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Relatório não encontrado para esta empresa.');
}

export async function preencherProdutosDaEmpresa(client, ownerId, visitas) {
  const equipe = visitas.filter(v => v.criado_por && v.criado_por !== v.user_id);
  const produtos = new Map();
  for (let inicio = 0; inicio < equipe.length; inicio += 100) {
    const { data, error } = await client.from('alertas_produtos').select('visita_id,produtos')
      .eq('user_id', ownerId).in('visita_id', equipe.slice(inicio, inicio + 100).map(v => v.id));
    if (error) throw error;
    for (const alerta of data || []) produtos.set(alerta.visita_id, alerta.produtos);
  }
  return visitas.map(v => produtos.has(v.id) ? { ...v, produtos: produtos.get(v.id) } : v);
}
