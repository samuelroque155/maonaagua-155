-- Controle da empresa baseado no v?nculo por email confirmado, nunca no modo salvo.
create or replace function private.funcionario_vinculado() returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.meus_vinculos());
$$;
revoke all on function private.funcionario_vinculado() from public,anon;
grant execute on function private.funcionario_vinculado() to authenticated;

create or replace function private.empresa_habilitada(dono uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid()=dono and not exists(select 1 from private.meus_vinculos()) and (
 exists(select 1 from public.perfis where id=dono and tipo_conta='empresa') or
 exists(select 1 from public.equipes_links where employer_uid=dono));
$$;

create or replace function private.dados_equipe() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'funcionarios',case when auth.uid() is not null and not exists(select 1 from private.meus_vinculos()) then
 coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome,'email_funcionario',e.email_funcionario,'rotas',e.rotas,'created_at',e.created_at,'usuario_id',u.id) order by e.created_at)
 from public.equipes_links e left join auth.users u on lower(btrim(u.email))=lower(btrim(e.email_funcionario)) and u.email_confirmed_at is not null
 where e.employer_uid=auth.uid()),'[]'::jsonb) else '[]'::jsonb end,
 'empresa',(select jsonb_build_object('nome',p.empresa,'cidade',p.cidade,
 'listaProdutos',u.raw_user_meta_data->'preferencias_profissionais'->'listaProdutos',
 'listaAcessorios',u.raw_user_meta_data->'preferencias_profissionais'->'listaAcessorios')
 from private.meus_vinculos() e join public.perfis p on p.id=e.employer_uid join auth.users u on u.id=e.employer_uid limit 1));
$$;
create or replace function public.dados_equipe() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.dados_equipe(); $$;
revoke all on function private.dados_equipe(),public.dados_equipe() from public,anon;
grant execute on function private.dados_equipe(),public.dados_equipe() to authenticated;

create policy controle_empresa_clientes_ler on public.clientes as restrictive for select to authenticated
using(not private.funcionario_vinculado() or (user_id<>auth.uid() and private.acesso_cliente(user_id,id)));
create policy controle_empresa_clientes_inserir on public.clientes as restrictive for insert to authenticated with check(not private.funcionario_vinculado());
create policy controle_empresa_clientes_atualizar on public.clientes as restrictive for update to authenticated using(not private.funcionario_vinculado()) with check(not private.funcionario_vinculado());
create policy controle_empresa_clientes_excluir on public.clientes as restrictive for delete to authenticated using(not private.funcionario_vinculado());
create policy controle_empresa_visitas_inserir on public.visitas as restrictive for insert to authenticated
with check(not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=user_id));
create policy controle_empresa_visitas_ler on public.visitas as restrictive for select to authenticated
using(not private.funcionario_vinculado() or (user_id<>auth.uid() and criado_por=auth.uid() and private.acesso_cliente(user_id,cliente_id)));
create policy controle_empresa_visitas_atualizar on public.visitas as restrictive for update to authenticated using(not private.funcionario_vinculado()) with check(not private.funcionario_vinculado());
create policy controle_empresa_visitas_excluir on public.visitas as restrictive for delete to authenticated using(not private.funcionario_vinculado());
create policy controle_empresa_perfil_atualizar on public.perfis as restrictive for update to authenticated using(not private.funcionario_vinculado()) with check(not private.funcionario_vinculado());
create policy controle_empresa_perfil_inserir on public.perfis as restrictive for insert to authenticated with check(not private.funcionario_vinculado());
create policy controle_empresa_equipe on public.equipes_links as restrictive for all to authenticated using(not private.funcionario_vinculado()) with check(not private.funcionario_vinculado());
