export const RETORNO_ANDROID = 'com.maonaagua.app://auth/callback';

export function enderecoRetorno({ nativo, origem, base = '/' }) {
  return nativo ? RETORNO_ANDROID : new URL(base, origem).href;
}

export function lerRetornoAuth(endereco, destino) {
  const url = new URL(endereco);
  const esperado = new URL(destino);
  if (url.protocol !== esperado.protocol || url.host !== esperado.host || url.pathname !== esperado.pathname) return null;
  const fragmento = new URLSearchParams(url.hash.slice(1));
  const valor = chave => url.searchParams.get(chave) || fragmento.get(chave);
  if (valor('error') || valor('error_description')) {
    return { erro: { code: valor('error_code') || valor('error'), message: valor('error_description') || 'O login foi cancelado.' } };
  }
  const code = valor('code');
  return code ? { code } : null;
}

export function mensagemErroAuth(erro) {
  const texto = String(erro?.message || erro?.msg || 'Não foi possível concluir. Tente novamente.');
  const codigo = String(erro?.error_code || erro?.code || '');
  if (/provider.*(not enabled|disabled)|unsupported provider/i.test(texto)) return 'O login Google ainda não está habilitado no Supabase. Confira Authentication → Sign In / Providers → Google.';
  if (/email_address_not_authorized/.test(codigo) || /email address.*not authorized|only.*authorized.*email/i.test(texto)) return 'O serviço de email do Supabase não está autorizado a enviar para este endereço. É necessário configurar um SMTP próprio; a confirmação de email continuará obrigatória.';
  if (/rate_limit|over_email_send/.test(codigo) || erro?.status === 429) return 'Muitas solicitações em pouco tempo. Aguarde o prazo informado pelo serviço antes de tentar novamente.';
  if (/email_not_confirmed/.test(codigo) || /email not confirmed/i.test(texto)) return 'Confirme seu email antes de entrar. Confira também a pasta de spam ou use “Reenviar confirmação”.';
  if (/invalid_credentials/.test(codigo)) return 'Email ou senha incorretos. Se criou sua conta pelo Google, use “Continuar com o Google”. Para entrar com senha, use “Esqueci minha senha” e defina uma pelo link recebido.';
  if (/user_already_exists|email_exists/.test(codigo) || /already registered|already been registered/i.test(texto)) return 'Este email já está cadastrado. Use Entrar, Continuar com o Google ou Esqueci minha senha. Cadastrar novamente não altera a senha da conta existente.';
  if (/weak_password/.test(codigo)) return 'A senha não atende aos requisitos de segurança. Use uma senha mais longa, com letras, números e símbolos.';
  if (/signup_disabled|email_provider_disabled/.test(codigo)) return 'O cadastro por email está desabilitado no serviço de autenticação. Entre com o Google e informe o responsável pelo aplicativo.';
  if (/flow_state|code_verifier|bad_code|pkce/i.test(codigo + texto)) return 'Esse retorno de login expirou ou foi aberto em outro navegador. Tente entrar novamente no mesmo aparelho. Se confirmou o email, entre agora com email e senha.';
  return texto;
}

export async function cadastrarComEmail(client, { email, senha, redirectTo }) {
  const endereco = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco)) throw new Error('Informe um email válido.');
  if (typeof senha !== 'string' || senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
  const { data, error } = await client.auth.signUp({
    email: endereco, password: senha, options: { emailRedirectTo: redirectTo }
  });
  if (error) throw error;
  // O Auth pode ocultar contas existentes retornando um usuário sem identidades.
  // Não tentar definir senha, criar perfil ou entrar automaticamente nessa conta.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return 'Este email já está cadastrado. Use Entrar, Continuar com o Google ou Esqueci minha senha. Cadastrar novamente não altera sua conta.';
  }
  if (data?.session) return '';
  return 'Se este email é novo, confira sua caixa de entrada e o spam para confirmar o cadastro antes de entrar. Se já possui conta, use Entrar ou Continuar com o Google; para definir uma senha, use Esqueci minha senha. Cadastrar novamente não redefine a senha.';
}

// /settings contém somente as configurações públicas de autenticação.
// Consulta antes do redirecionamento para evitar uma página de erro JSON.
export async function verificarGoogleDisponivel({ supabaseUrl, publishableKey, fetcher = fetch }) {
  const abortar = new AbortController();
  const timer = setTimeout(() => abortar.abort(), 10000);
  try {
    const resposta = await fetcher(new URL('/auth/v1/settings', supabaseUrl).href, {
      headers: { apikey: publishableKey }, signal: abortar.signal
    });
    if (!resposta.ok) throw new Error('Não foi possível verificar o login Google. Tente novamente ou entre com email e senha.');
    const configuracao = await resposta.json();
    if (configuracao.external?.google !== true) throw new Error('Unsupported provider: provider is not enabled');
  } catch (erro) {
    if (erro.name === 'AbortError') throw new Error('A verificação do login Google demorou demais. Tente novamente ou entre com email e senha.', { cause: erro });
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

export function criarProcessadorRetorno(client) {
  const processados = new Map();
  return async endereco => {
    const retorno = lerRetornoAuth(endereco, RETORNO_ANDROID);
    if (!retorno) return false;
    if (retorno.erro) throw retorno.erro;
    // Um cold start pode entregar o mesmo link por getLaunchUrl e appUrlOpen.
    if (!processados.has(retorno.code)) {
      processados.set(retorno.code, client.auth.exchangeCodeForSession(retorno.code).then(({ error }) => {
        if (error) throw error;
        return true;
      }));
    }
    return processados.get(retorno.code);
  };
}
