-- Um vínculo explícito continua válido mesmo se o responsável alternar o modo do perfil.
-- Não permite acesso sem email confirmado nem a clientes fora das rotas atribuídas.
begin;
create or replace function private.acesso_cliente(dono uuid, cliente bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=dono or exists(
   select 1 from private.meus_vinculos() e, jsonb_array_elements_text(e.rotas) r
   where e.employer_uid=dono and r=cliente::text
 ));
$$;
commit;
