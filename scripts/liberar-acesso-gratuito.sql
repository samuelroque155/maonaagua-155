-- Acesso gratuito autorizado pelo responsável: não altera pagamentos nem propriedade dos dados.
begin;
create or replace function private.empresa_habilitada(dono uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
   select 1 from public.perfis p where p.id=dono and p.tipo_conta='empresa'
 );
$$;
-- Mantém o campo informativo de assinatura sem usá-lo como permissão.
create or replace function private.contexto_equipe()
returns table(employer_uid uuid,rotas jsonb,assinatura_ativa boolean)
language sql stable security definer set search_path='' as $$
 select e.employer_uid,e.rotas,coalesce(p.assinatura_ativa,false)
 from private.meus_vinculos() e left join public.perfis p on p.id=e.employer_uid;
$$;
commit;
