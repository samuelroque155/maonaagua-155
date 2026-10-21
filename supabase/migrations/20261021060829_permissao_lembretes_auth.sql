-- Leitura mínima de identidade para calcular agenda própria ou vínculo confirmado.
-- Nenhum acesso novo é concedido a anon ou authenticated.
grant select (id, email, email_confirmed_at) on auth.users to service_role;
