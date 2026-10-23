-- Revisão local: não aplicar em produção sem autorização.
begin;
create table public.cancelamentos_visitas (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 cliente_id bigint not null references public.clientes(id),
 criado_por uuid not null default auth.uid() references auth.users(id),
 iniciado_em timestamptz not null,
 cancelado_em timestamptz not null default now(),
 data_original date not null,
 nova_data date,
 motivo text not null check(length(btrim(motivo)) between 1 and 4000),
 rascunho jsonb not null default '{}'::jsonb check(jsonb_typeof(rascunho)='object' and octet_length(rascunho::text)<=131072),
 check(nova_data is null or nova_data>data_original)
);
create index cancelamentos_cliente_data on public.cancelamentos_visitas(user_id,cliente_id,cancelado_em);
alter table public.cancelamentos_visitas enable row level security;
revoke all on public.cancelamentos_visitas from public,anon,authenticated;
grant select on public.cancelamentos_visitas to authenticated;
grant insert(id,user_id,cliente_id,iniciado_em,data_original,nova_data,motivo,rascunho) on public.cancelamentos_visitas to authenticated;
create policy cancelamentos_ler on public.cancelamentos_visitas for select to authenticated
using(private.acesso_cliente(user_id,cliente_id) and (not private.funcionario_vinculado() or criado_por=auth.uid()));
create policy cancelamentos_inserir on public.cancelamentos_visitas for insert to authenticated
with check(criado_por=auth.uid() and private.acesso_cliente(user_id,cliente_id)
 and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=user_id)));

create function private.validar_cancelamento_visita() returns trigger
language plpgsql security definer set search_path='' as $$
declare caminho text;
begin
 if auth.uid() is null or not private.acesso_cliente(new.user_id,new.cliente_id)
 or (private.funcionario_vinculado() and not exists(select 1 from private.meus_vinculos() e where e.employer_uid=new.user_id)) then raise exception 'Sem permissão para cancelar este atendimento'; end if;
 perform 1 from public.clientes where id=new.cliente_id and user_id=new.user_id for update;
 if not found then raise exception 'Cliente indisponível'; end if;
 -- The client lock serializes this occurrence; NULL skips a retry before INSERT.
 -- This avoids duplicate cancellation and reschedule rows.
 if exists(select 1 from public.cancelamentos_visitas where id=new.id) then return null; end if;
 if new.iniciado_em>now()+interval '1 minute' or new.iniciado_em is null then raise exception 'Horário de início inválido'; end if;
 if not private.programada_na_data(new.user_id,new.cliente_id,new.data_original) then raise exception 'A ocorrência não está mais pendente. Atualize a agenda'; end if;
 if exists(select 1 from public.visitas v where v.user_id=new.user_id and v.cliente_id=new.cliente_id and v.tipo='visita'
 and coalesce(v.data_agendada,(v.data_visita at time zone 'America/Sao_Paulo')::date)=new.data_original) then raise exception 'Esta limpeza já foi concluída'; end if;
 if jsonb_typeof(coalesce(new.rascunho->'fotos','[]'))<>'array' or jsonb_typeof(coalesce(new.rascunho->'fotos_alerta','[]'))<>'array' then raise exception 'Fotografias inválidas'; end if;
 for caminho in select jsonb_array_elements_text(coalesce(new.rascunho->'fotos','[]')||coalesce(new.rascunho->'fotos_alerta','[]')) loop
  if caminho !~ ('^'||auth.uid()::text||'/visitas/[0-9a-f-]+\.(jpg|jpeg|png|webp)$') then raise exception 'A fotografia deve pertencer ao responsável pelo atendimento'; end if;
 end loop;
 new.criado_por=auth.uid(); new.cancelado_em=now(); new.motivo=btrim(new.motivo);
 if new.nova_data is not null then
  -- Reuse the existing reschedule validations; transaction failure rolls both writes back.
  insert into public.adiamentos_visitas(id,user_id,criado_por,cliente_id,data_original,nova_data,motivo,comparecimento_em)
  values(new.id,new.user_id,auth.uid(),new.cliente_id,new.data_original,new.nova_data,new.motivo,now());
 end if;
 return new;
end; $$;
revoke all on function private.validar_cancelamento_visita() from public,anon,authenticated;
create trigger validar_cancelamento_visita before insert on public.cancelamentos_visitas for each row execute function private.validar_cancelamento_visita();
create policy fotos_cancelamentos on storage.objects for select to authenticated
using(bucket_id='fotos-visitas' and exists(select 1 from public.cancelamentos_visitas c
 where private.acesso_cliente(c.user_id,c.cliente_id) and ((c.rascunho->'fotos') ? name or (c.rascunho->'fotos_alerta') ? name)));
commit;
