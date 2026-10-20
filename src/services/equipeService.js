export async function carregarContextoEquipe(client) {
  const { data, error } = await client.rpc('contexto_equipe');
  if (error) throw error;
  if ((data || []).length > 1) throw new Error('Há mais de um vínculo de equipe. Solicite a revisão dos responsáveis.');
  return data?.[0] || null;
}

export function aplicarContextoEquipe(perfil, equipe) {
  return equipe ? {
    ...perfil, tipoConta: 'funcionario', vinculoEmpresa: equipe.employer_uid,
    rotas: equipe.rotas || [], assinaturaAtiva: equipe.assinatura_ativa === true
  } : { ...perfil, vinculoEmpresa: null, rotas: [],
    tipoConta: perfil.tipoConta === 'funcionario' ? null : perfil.tipoConta };
}

export async function listarFuncionarios(client, ownerId) {
  const { data, error } = await client.from('equipes_links').select('*')
    .eq('employer_uid', ownerId).order('created_at');
  if (error) throw error;
  return (data || []).map(f => ({ ...f, email: f.email_funcionario }));
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

export async function resolverAlerta(client, ownerId, id) {
  const { error } = await client.from('alertas_produtos').update({ lido: true })
    .eq('id', id).eq('user_id', ownerId);
  if (error) throw error;
}
