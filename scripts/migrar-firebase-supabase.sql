-- Migração aditiva: mantém todos os clientes e visitas existentes.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.equipes_links add column if not exists nome text not null default '';
create unique index equipes_email_normalizado on public.equipes_links(lower(btrim(email_funcionario)));
alter table public.visitas add column if not exists tipo text not null default 'visita' check (tipo in ('visita','problema'));
alter table public.visitas add column if not exists criado_por uuid references auth.users(id);
update public.visitas set criado_por=user_id where criado_por is null;
alter table public.visitas alter column criado_por set default auth.uid();
alter table public.clientes add column if not exists adiado_para integer check (adiado_para between 0 and 6);

-- Helpers privados: identidade e email confirmado vêm do servidor, nunca do formulário/metadados editáveis.
create or replace function private.empresa_habilitada(dono uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
   select 1 from public.perfis p where p.id=dono and p.tipo_conta='empresa'
   and (p.assinatura_ativa or exists(select 1 from auth.users u where u.id=dono and u.raw_app_meta_data->>'role'='admin'))
 );
$$;
create or replace function private.meus_vinculos()
returns setof public.equipes_links language sql stable security definer set search_path='' as $$
 select e.* from public.equipes_links e join auth.users u
 on lower(btrim(u.email))=lower(btrim(e.email_funcionario))
 where u.id=auth.uid() and u.email_confirmed_at is not null and e.employer_uid<>u.id;
$$;
create or replace function private.acesso_cliente(dono uuid, cliente bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=dono or (
   private.empresa_habilitada(dono) and exists(
     select 1 from private.meus_vinculos() e, jsonb_array_elements_text(e.rotas) r
     where e.employer_uid=dono and r=cliente::text
   )
 ));
$$;
create or replace function private.contexto_equipe()
returns table(employer_uid uuid,rotas jsonb,assinatura_ativa boolean)
language sql stable security definer set search_path='' as $$
 select e.employer_uid,e.rotas,private.empresa_habilitada(e.employer_uid)
 from private.meus_vinculos() e;
$$;
create or replace function public.contexto_equipe()
returns table(employer_uid uuid,rotas jsonb,assinatura_ativa boolean)
language sql stable security invoker set search_path='' as $$ select * from private.contexto_equipe(); $$;
revoke all on function private.empresa_habilitada(uuid),private.meus_vinculos(),private.acesso_cliente(uuid,bigint),private.contexto_equipe(),public.contexto_equipe() from public,anon;
grant execute on function private.empresa_habilitada(uuid),private.meus_vinculos(),private.acesso_cliente(uuid,bigint),private.contexto_equipe(),public.contexto_equipe() to authenticated;

-- Uma única linha é o convite/vínculo e a lista de rotas: sem duas gravações que possam divergir.
create or replace function private.validar_vinculo() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.email_funcionario:=lower(btrim(new.email_funcionario));
 if new.email_funcionario='' or jsonb_typeof(new.rotas)<>'array' then
   raise exception 'Email ou rotas inválidos';
 end if;
 if exists(select 1 from jsonb_array_elements_text(new.rotas) r where not exists(
   select 1 from public.clientes c where c.id::text=r and c.user_id=new.employer_uid
 )) then raise exception 'As rotas precisam pertencer à empresa'; end if;
 return new;
end; $$;
create trigger validar_vinculo before insert or update on public.equipes_links
for each row execute function private.validar_vinculo();
alter table public.equipes_links enable row level security;
revoke all on public.equipes_links from anon,authenticated;
grant select,delete on public.equipes_links to authenticated;
grant insert(nome,email_funcionario,employer_uid,rotas),update(nome,email_funcionario,employer_uid,rotas) on public.equipes_links to authenticated;
grant usage,select on sequence public.equipes_links_id_seq to authenticated;
create policy equipe_inserir on public.equipes_links for insert to authenticated
with check(employer_uid=auth.uid() and private.empresa_habilitada(auth.uid()));
create policy equipe_atualizar on public.equipes_links for update to authenticated
using(employer_uid=auth.uid() and private.empresa_habilitada(auth.uid()))
with check(employer_uid=auth.uid() and private.empresa_habilitada(auth.uid()));
create policy equipe_remover on public.equipes_links for delete to authenticated using(employer_uid=auth.uid());

create policy clientes_rotas on public.clientes for select to authenticated
using(private.acesso_cliente(user_id,id));
create policy visitas_rotas on public.visitas for select to authenticated
using(private.acesso_cliente(user_id,cliente_id));
-- Substitui INSERT/UPDATE antigos: a propriedade do cliente também é validada ao editar.
drop policy "Usuarios criam suas visitas" on public.visitas;
drop policy "Usuarios atualizam suas visitas" on public.visitas;
create policy visitas_inserir on public.visitas for insert to authenticated with check(
 criado_por=auth.uid() and private.acesso_cliente(user_id,cliente_id) and exists(
 select 1 from public.clientes c where c.id=cliente_id and c.user_id=visitas.user_id
 ));
create policy visitas_atualizar on public.visitas for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(
 select 1 from public.clientes c where c.id=cliente_id and c.user_id=auth.uid()
));
-- O responsável pode abrir somente fotos referenciadas em visitas da sua empresa;
-- funcionários recebem fotos somente dos clientes atribuídos.
create policy fotos_da_equipe on storage.objects for select to authenticated using(
 bucket_id='fotos-visitas' and exists(select 1 from public.visitas v
 where private.acesso_cliente(v.user_id,v.cliente_id)
 and (v.fotos ? name or v.fotos_alerta ? name))
);

create table public.alertas_produtos(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 visita_id uuid not null unique references public.visitas(id) on delete cascade,
 cliente_id bigint not null references public.clientes(id),
 funcionario_nome text not null default '', produtos jsonb not null default '[]',
 lido boolean not null default false,created_at timestamptz not null default now()
);
alter table public.alertas_produtos enable row level security;
revoke all on public.alertas_produtos from anon,authenticated;
grant select on public.alertas_produtos to authenticated;
grant update(lido) on public.alertas_produtos to authenticated;
create policy alertas_ler on public.alertas_produtos for select to authenticated using(user_id=auth.uid());
create policy alertas_resolver on public.alertas_produtos for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Trigger interno: grava alerta na mesma transação da visita; não é RPC pública.
create or replace function private.alerta_da_visita() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.acesso_cliente(new.user_id,new.cliente_id) then
   raise exception 'Sessão sem acesso ao cliente';
 end if;
 if jsonb_typeof(new.produtos)='array' and jsonb_array_length(new.produtos)>0 then
   insert into public.alertas_produtos(user_id,visita_id,cliente_id,produtos,funcionario_nome)
   values(new.user_id,new.id,new.cliente_id,new.produtos,coalesce((select empresa from public.perfis where id=new.criado_por),''))
   on conflict(visita_id) do update set produtos=excluded.produtos,lido=false;
 else
   update public.alertas_produtos set produtos='[]',lido=true where visita_id=new.id;
 end if;
 return new;
end; $$;
revoke all on function private.alerta_da_visita() from public,anon,authenticated;
create trigger alerta_da_visita after insert or update of produtos on public.visitas
for each row execute function private.alerta_da_visita();
create index alertas_empresa_data on public.alertas_produtos(user_id,created_at desc);
create index visitas_cliente_empresa on public.visitas(cliente_id,user_id);
create index equipes_empresa on public.equipes_links(employer_uid);
commit;
