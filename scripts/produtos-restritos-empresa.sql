begin;
alter policy controle_empresa_visitas_ler on public.visitas to authenticated
using(not private.funcionario_vinculado() or (user_id<>auth.uid() and criado_por=auth.uid() and private.acesso_cliente(user_id,cliente_id)));
-- As solicitações da equipe ficam apenas na tabela privada da empresa.
-- A FK diferida permite gravar o alerta no mesmo comando que cria a visita.
alter table public.alertas_produtos alter constraint alertas_produtos_visita_id_fkey deferrable initially deferred;
drop trigger alerta_da_visita on public.visitas;

-- Preserva solicitações antigas e as revisões já feitas pela empresa.
insert into public.alertas_produtos(user_id,visita_id,cliente_id,produtos,funcionario_nome)
select v.user_id,v.id,v.cliente_id,v.produtos,coalesce(p.empresa,'Funcionário')
from public.visitas v left join public.perfis p on p.id=v.criado_por
where v.criado_por<>v.user_id and jsonb_typeof(v.produtos)='array' and jsonb_array_length(v.produtos)>0
on conflict(visita_id) do nothing;
update public.visitas set produtos='[]' where criado_por<>user_id and produtos<>'[]'::jsonb;

create or replace function private.alerta_da_visita() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.acesso_cliente(new.user_id,new.cliente_id) then
   return new; -- A política RLS rejeita a gravação sem produzir efeitos laterais.
 end if;
 -- Repetir uma sincronização já confirmada não sobrescreve a revisão da empresa.
 if tg_op='INSERT' and exists(select 1 from public.visitas where id=new.id) then
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
 if new.criado_por<>new.user_id then new.produtos='[]'::jsonb; end if;
 return new;
end; $$;
revoke all on function private.alerta_da_visita() from public,anon,authenticated;
create trigger alerta_da_visita before insert or update of produtos on public.visitas
for each row execute function private.alerta_da_visita();
commit;
