-- Executar somente ao ativar a publicação, após configurar Vault e Edge Function.
-- Habilitar pg_cron e pg_net no painel antes deste passo.
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='lembretes_function_url')
 or not exists(select 1 from vault.decrypted_secrets where name='lembretes_cron_secret') then
  raise exception 'Configure lembretes_function_url e lembretes_cron_secret no Supabase Vault';
 end if;
end $$;
select cron.schedule('maonaagua-lembretes','* * * * *',
 $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='lembretes_function_url'),
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='lembretes_cron_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
 );
 $job$
);
