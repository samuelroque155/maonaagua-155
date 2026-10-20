import { caminhoImagemPerfilValido, enviarImagemPerfil } from './imagemPerfilService.js';

export function normalizarTipoPerfil(tipo) {
  return String(tipo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function nomeProfissional(perfil) {
  const nome = String(perfil?.empresa || '').trim();
  return nome && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nome) ? nome : '';
}

export function mapearPerfil(registro, preferencias = {}, padrao = {}) {
  return {
    ...padrao,
    empresa: nomeProfissional(registro),
    cidade: registro?.cidade ?? padrao.cidade ?? '',
    assinaturaAtiva: registro?.assinatura_ativa === true,
    tipoConta: normalizarTipoPerfil(registro?.tipo_conta) || null,
    vinculoEmpresa: registro?.vinculo_empresa ?? null,
    rotas: registro?.rotas ?? [],
    fotoPerfilCaminho: typeof preferencias?.fotoPerfilCaminho === 'string' ? preferencias.fotoPerfilCaminho : '',
    fotoPerfilUrl: '',
    fotoPerfilNova: null,
    listaProdutos: Array.isArray(preferencias?.listaProdutos) ? preferencias.listaProdutos : padrao.listaProdutos || [],
    listaAcessorios: Array.isArray(preferencias?.listaAcessorios) ? preferencias.listaAcessorios : padrao.listaAcessorios || []
  };
}

async function conferirUsuario(client, userId) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== userId) throw new Error('Sua sessão mudou. Entre novamente antes de salvar.');
  return data.user;
}

export async function carregarPerfil(client, userId) {
  const { data, error } = await client.from('perfis').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function salvarTipoPerfil(client, userId, tipo, primeiroAcesso = false) {
  if (!['autonomo', 'empresa'].includes(tipo)) throw new Error('Escolha Autônomo ou Empresa.');
  await conferirUsuario(client, userId);
  const atual = await carregarPerfil(client, userId);
  if (primeiroAcesso && normalizarTipoPerfil(atual?.tipo_conta)) return atual;
  let pedido;
  if (atual) {
    pedido = client.from('perfis').update({ tipo_conta: tipo }).eq('id', userId);
    if (primeiroAcesso) {
      pedido = atual.tipo_conta === null ? pedido.is('tipo_conta', null) : pedido.eq('tipo_conta', atual.tipo_conta);
    }
  } else {
    pedido = client.from('perfis').insert({ id: userId, tipo_conta: tipo });
  }
  const { data, error } = await pedido.select('*').maybeSingle();
  if (error && error.code !== '23505') throw error;
  const salvo = data || await carregarPerfil(client, userId);
  if (!normalizarTipoPerfil(salvo?.tipo_conta)) throw new Error('O tipo de perfil não foi salvo. Tente novamente.');
  return salvo;
}

export async function salvarPerfilProfissional(client, userId, perfil) {
  const usuario = await conferirUsuario(client, userId);
  const empresa = nomeProfissional(perfil);
  if (!empresa && perfil.tipoConta !== 'funcionario') throw new Error('Informe seu nome profissional ou o nome da empresa, sem usar o email.');
  let fotoPerfilCaminho = usuario.user_metadata?.preferencias_profissionais?.fotoPerfilCaminho || '';
  if (perfil.fotoPerfilNova) fotoPerfilCaminho = await enviarImagemPerfil(client, userId, perfil.fotoPerfilNova);
  else if (perfil.fotoPerfilRemover) fotoPerfilCaminho = '';
  if (fotoPerfilCaminho && !caminhoImagemPerfilValido(fotoPerfilCaminho, userId)) {
    throw new Error('A imagem de perfil precisa pertencer à sua conta.');
  }
  if (perfil.tipoConta === 'funcionario') {
    const preferencias = { ...usuario.user_metadata?.preferencias_profissionais, fotoPerfilCaminho };
    await conferirUsuario(client, userId);
    const { error } = await client.auth.updateUser({ data: { preferencias_profissionais: preferencias } });
    if (error) throw error;
    return { ...perfil, fotoPerfilCaminho, fotoPerfilNova: null };
  }
  // Envia somente campos editáveis. Não altera assinatura, vínculo ou rotas.
  const { data, error } = await client.from('perfis')
    .upsert({ id: userId, empresa, cidade: String(perfil.cidade || '').trim() }, { onConflict: 'id' })
    .select('*').single();
  if (error) throw error;
  const preferencias = {
    ...usuario.user_metadata?.preferencias_profissionais,
    fotoPerfilCaminho,
    listaProdutos: perfil.listaProdutos,
    listaAcessorios: perfil.listaAcessorios
  };
  // Catálogos são preferências, nunca usados para autorização.
  await conferirUsuario(client, userId);
  const { error: erroPreferencias } = await client.auth.updateUser({ data: { preferencias_profissionais: preferencias } });
  if (erroPreferencias) throw new Error('Nome e cidade foram salvos, mas não foi possível salvar os catálogos: ' + erroPreferencias.message);
  return mapearPerfil(data, preferencias, perfil);
}
