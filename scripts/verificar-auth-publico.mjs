// Somente GET público. Não imprime chaves, sessões ou configuração privada.
const url = process.env.VITE_SUPABASE_URL;
const chave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !chave) throw new Error('Carregue .env.local com --env-file=.env.local.');
try {
  const resposta = await fetch(new URL('/auth/v1/settings', url), {
    headers: { apikey: chave }, signal: AbortSignal.timeout(10000)
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const dados = await resposta.json();
  console.log(JSON.stringify({
    projeto: new URL(url).hostname,
    googleHabilitado: dados.external?.google === true,
    confirmacaoEmailHabilitada: typeof dados.mailer_autoconfirm === 'boolean'
      ? !dados.mailer_autoconfirm
      : null,
    novosCadastrosPermitidos: dados.disable_signup === false
  }, null, 2));
} catch (erro) {
  console.error('Consulta pública não concluída:', erro.cause?.code || erro.message);
  process.exitCode = 1;
}
