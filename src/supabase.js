import { createClient } from "@supabase/supabase-js";
import { Capacitor } from '@capacitor/core';
import { enderecoRetorno, lerRetornoAuth, verificarGoogleDisponivel } from './services/authService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltam as configurações do Supabase no arquivo .env.local");
}

export const authRedirectUrl = enderecoRetorno({
  nativo: Capacitor.isNativePlatform(),
  origem: window.location.origin,
  base: import.meta.env.BASE_URL
});
// Captura o erro antes de o SDK limpar a URL de retorno. Nunca registra tokens.
export const erroRetornoInicial = Capacitor.isNativePlatform() ? null : lerRetornoAuth(window.location.href, authRedirectUrl)?.erro;
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform()
  }
});
export const conferirLoginGoogle = () => verificarGoogleDisponivel({ supabaseUrl, publishableKey: supabaseKey });
export async function testarSupabase() {
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
