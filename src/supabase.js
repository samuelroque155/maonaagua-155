import { createClient } from "@supabase/supabase-js";
import { Capacitor } from '@capacitor/core';
import { enderecoRetorno, lerRetornoAuth, verificarGoogleDisponivel } from './services/authService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Keep the app shell renderable when deployment configuration is missing.
export const supabaseConfiguracaoAusente = !supabaseUrl || !supabaseKey;
const supabaseUrlValida = supabaseUrl || 'https://configuration-missing.invalid';
const supabaseChaveValida = supabaseKey || 'configuration-missing';

export const authRedirectUrl = enderecoRetorno({
  nativo: Capacitor.isNativePlatform(),
  origem: window.location.origin,
  base: import.meta.env.BASE_URL
});
// Captura o erro antes de o SDK limpar a URL de retorno. Nunca registra tokens.
export const erroRetornoInicial = Capacitor.isNativePlatform() ? null : lerRetornoAuth(window.location.href, authRedirectUrl)?.erro;
export const supabase = createClient(supabaseUrlValida, supabaseChaveValida, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform()
  }
});
export const conferirLoginGoogle = () => {
  if (supabaseConfiguracaoAusente) throw new Error('A configuração pública do Supabase está ausente na implantação. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente Production e gere um novo build.');
  return verificarGoogleDisponivel({ supabaseUrl, publishableKey: supabaseKey });
};
export function exigirConfiguracaoSupabase() {
  if (supabaseConfiguracaoAusente) {
    throw new Error('O login está temporariamente indisponível: a implantação não recebeu VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
}
export async function testarSupabase() {
  if (supabaseConfiguracaoAusente) {
    console.error('Supabase não inicializado: faltam as variáveis públicas VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY.');
    return;
  }
  const { data, error } = await supabase
    .from("teste_conexao")
    .select("*")
    .limit(1);

  if (error) {
    console.log("Resposta do Supabase:", error.message);
    return;
  }

  console.log("Supabase conectado!", data);
}
