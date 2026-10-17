import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltam as configurações do Supabase no arquivo .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
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