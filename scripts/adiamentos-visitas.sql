-- Apenas para revisão e aplicação após validar em desenvolvimento.
-- Mantém clientes, dias fixos, visitas, produtos e fotografias existentes.
begin;
create table public.adiamentos_visitas (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 criado_por uuid not null default auth.uid() references auth.users(id),
 cliente_id bigint not null references public.clientes(id),
 data_original date not null,
 horario_original text not null default '',
 nova_data date not null,
 motivo text not null check(length(btrim(motivo)) between 1 and 4000),
 criado_em timestamptz not null default now(),
 comparecimento_em timestamptz,
 foto_caminho text,
 constraint adiamento_data_futura check(nova_data>data_original),
 constraint adiamento_ocorrencia_unica unique(user_id,cliente_id,data_original)
);
alter table public.adiamentos_visitas enable row level security;
revoke all on public.adiamentos_visitas from public,anon,authenticated;
grant select,insert on public.adiamentos_visitas to authenticated;
create index adiamentos_empresa_datas on public.adiamentos_visitas(user_id,nova_data,data_original);
create index adiamentos_cliente on public.adiamentos_visitas(cliente_id);
create policy adiamentos_ler on public.adiamentos_visitas for select to authenticated
using(private.acesso_cliente(user_id,cliente_id)
 and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=user_id)));
create policy adiamentos_inserir on public.adiamentos_visitas for insert to authenticated
with check(criado_por=auth.uid() and private.acesso_cliente(user_id,cliente_id)
 and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=user_id))
 and exists(select 1 from public.clientes c where c.id=cliente_id and c.user_id=adiamentos_visitas.user_id));

-- A checagem e a trava evitam dois adiamentos concorrentes da mesma ocorrência.
create or replace function private.validar_adiamento() returns trigger
language plpgsql security definer set search_path='' as $$
declare cliente public.clientes; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null or new.criado_por<>auth.uid() or not private.acesso_cliente(new.user_id,new.cliente_id) then
   raise exception 'Sem permissão para adiar esta visita';
 end if;
 select * into cliente from public.clientes c where c.id=new.cliente_id and c.user_id=new.user_id for update;
 if not found then raise exception 'Cliente indisponível'; end if;
 if new.data_original<>hoje or new.nova_data<=hoje then
   raise exception 'Selecione uma visita de hoje e uma nova data futura';
 end if;
 if not (extract(dow from new.data_original)::int=any(coalesce(cliente.dias_visita,array[]::integer[])))
 and not exists(select 1 from public.adiamentos_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id and a.nova_data=new.data_original) then
   raise exception 'Não existe visita programada para esta data';
 end if;
 if exists(select 1 from public.visitas v where v.cliente_id=new.cliente_id and v.user_id=new.user_id and v.tipo='visita' and (v.data_visita at time zone 'America/Sao_Paulo')::date=new.data_original) then
   raise exception 'Esta limpeza já foi finalizada';
 end if;
 if new.foto_caminho is not null and (new.comparecimento_em is null or new.foto_caminho !~ ('^'||auth.uid()::text||'/adiamentos/[0-9a-f-]+\.(jpg|jpeg|png|webp)$')) then
   raise exception 'A fotografia precisa pertencer ao responsável pelo comparecimento';
 end if;
 new.motivo=btrim(new.motivo);
 new.horario_original=coalesce(cliente.hora_visita,'');
 new.criado_em=now();
 if new.comparecimento_em is not null then new.comparecimento_em=now(); end if;
 return new;
end; $$;
revoke all on function private.validar_adiamento() from public,anon,authenticated;
create trigger validar_adiamento before insert on public.adiamentos_visitas
for each row execute function private.validar_adiamento();

create or replace function private.validar_limpeza_adiada() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='visita' and auth.uid() is not null and private.acesso_cliente(new.user_id,new.cliente_id) then
   perform 1 from public.clientes c where c.id=new.cliente_id and c.user_id=new.user_id for update;
   if exists(select 1 from public.adiamentos_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id
     and a.data_original=(new.data_visita at time zone 'America/Sao_Paulo')::date) then
     raise exception 'Esta visita foi adiada. Confira a nova data na agenda';
   end if;
 end if;
 return new;
end; $$;
revoke all on function private.validar_limpeza_adiada() from public,anon,authenticated;
create trigger validar_limpeza_adiada before insert on public.visitas
for each row execute function private.validar_limpeza_adiada();
create policy fotos_dos_adiamentos on storage.objects for select to authenticated
using(bucket_id='fotos-visitas' and exists(select 1 from public.adiamentos_visitas a where a.foto_caminho=storage.objects.name));
-- Apenas datas de conclusão: produtos e relatórios continuam privados da empresa.
create or replace function private.conclusoes_agenda(dono uuid)
returns table(id uuid,cliente_id bigint,data_visita timestamptz)
language sql stable security definer set search_path='' as $$
 select v.id,v.cliente_id,coalesce(v.data_visita,v.created_at) from public.visitas v
 where auth.uid() is not null and v.user_id=dono and v.tipo='visita'
 and private.acesso_cliente(dono,v.cliente_id)
 and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=dono));
$$;
create or replace function public.conclusoes_agenda(dono uuid)
returns table(id uuid,cliente_id bigint,data_visita timestamptz)
language sql stable security invoker set search_path='' as $$ select * from private.conclusoes_agenda(dono); $$;
revoke all on function private.conclusoes_agenda(uuid),public.conclusoes_agenda(uuid) from public,anon;
grant execute on function private.conclusoes_agenda(uuid),public.conclusoes_agenda(uuid) to authenticated;
commit;
