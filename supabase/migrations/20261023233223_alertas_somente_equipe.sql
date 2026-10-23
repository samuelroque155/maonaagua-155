begin;
create or replace function private.alerta_da_visita() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.acesso_cliente(new.user_id,new.cliente_id) then
   return new;
 end if;
 if tg_op='INSERT' and exists(select 1 from public.visitas where id=new.id) then
   return new;
 end if;
 -- Visitas próprias registram produtos no histórico, não em alertas de equipe.
 if new.criado_por=new.user_id then
   return new;
 end if;
 if jsonb_typeof(new.produtos)='array' and jsonb_array_length(new.produtos)>0 then
   insert into public.alertas_produtos(user_id,visita_id,cliente_id,produtos,funcionario_nome)
   values(new.user_id,new.id,new.cliente_id,new.produtos,coalesce(
    (select e.nome from public.equipes_links e join auth.users u on lower(btrim(u.email))=lower(btrim(e.email_funcionario)) where u.id=new.criado_por and e.employer_uid=new.user_id),
    (select empresa from public.perfis where id=new.criado_por),''))
   on conflict(visita_id) do update set produtos=excluded.produtos,lido=false;
 else
   update public.alertas_produtos set produtos='[]',lido=true where visita_id=new.id;
 end if;
 new.produtos='[]'::jsonb;
 return new;
end; $$;
revoke all on function private.alerta_da_visita() from public,anon,authenticated;
commit;
