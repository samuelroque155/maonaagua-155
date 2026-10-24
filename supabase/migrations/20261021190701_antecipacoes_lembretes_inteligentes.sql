-- Desenvolvimento: aplicar somente após revisão e testes. Sem alteração de dados antigos.
begin;
create table public.antecipacoes_visitas (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 cliente_id bigint not null references public.clientes(id),
 criado_por uuid not null default auth.uid() references auth.users(id),
 data_original date not null, nova_data date not null,
 motivo text not null default '' check(length(motivo)<=1000),
 criado_em timestamptz not null default now(),
 cancelado_em timestamptz, cancelado_por uuid references auth.users(id),
 check(nova_data<data_original)
);
create unique index antecipacao_ocorrencia_ativa on public.antecipacoes_visitas(user_id,cliente_id,data_original) where cancelado_em is null;
create unique index antecipacao_destino_ativo on public.antecipacoes_visitas(user_id,cliente_id,nova_data) where cancelado_em is null;
alter table public.antecipacoes_visitas enable row level security;
revoke all on public.antecipacoes_visitas from public,anon,authenticated;
grant select on public.antecipacoes_visitas to authenticated;
grant insert(id,user_id,cliente_id,data_original,nova_data,motivo),update(cancelado_em) on public.antecipacoes_visitas to authenticated;
grant select on public.antecipacoes_visitas to service_role;
create policy antecipacao_acesso on public.antecipacoes_visitas for all to authenticated
using(private.acesso_cliente(user_id,cliente_id) and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=user_id)))
with check(private.acesso_cliente(user_id,cliente_id) and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=user_id)));

-- Predicado compartilhado: adiamento conserva suas regras e passa a reconhecer a nova data antecipada.
create function private.programada_na_data(dono uuid, cliente bigint, dia date) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.clientes c where c.user_id=dono and c.id=cliente
 and (extract(dow from dia)::int=any(coalesce(c.dias_visita,array[]::integer[]))
  or exists(select 1 from public.adiamentos_visitas a where a.user_id=dono and a.cliente_id=cliente and a.nova_data=dia)
  or exists(select 1 from public.antecipacoes_visitas a where a.user_id=dono and a.cliente_id=cliente and a.cancelado_em is null and a.nova_data=dia))
 and not exists(select 1 from public.adiamentos_visitas a where a.user_id=dono and a.cliente_id=cliente and a.data_original=dia)
 and not exists(select 1 from public.antecipacoes_visitas a where a.user_id=dono and a.cliente_id=cliente and a.cancelado_em is null and a.data_original=dia));
$$;
revoke all on function private.programada_na_data(uuid,bigint,date) from public,anon,authenticated;
grant execute on function private.programada_na_data(uuid,bigint,date) to service_role;

create function private.validar_antecipacao() returns trigger language plpgsql security definer set search_path='' as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null or not private.acesso_cliente(new.user_id,new.cliente_id) then raise exception 'Sem permissão para esta visita'; end if;
 perform 1 from public.clientes where id=new.cliente_id and user_id=new.user_id for update;
 if not found then raise exception 'Cliente indisponível'; end if;
 if tg_op='UPDATE' then
  if old.cancelado_em is not null or new.cancelado_em is null then raise exception 'Antecipação já cancelada'; end if;
  if exists(select 1 from public.visitas v where v.antecipacao_id=old.id)
   or exists(select 1 from public.adiamentos_visitas a where a.user_id=old.user_id and a.cliente_id=old.cliente_id and a.data_original=old.nova_data)
   then raise exception 'Não é possível restaurar uma visita já realizada ou adiada'; end if;
  if old.data_original<hoje then raise exception 'A data original já passou'; end if;
  new.cancelado_em=now(); new.cancelado_por=auth.uid(); return new;
 end if;
 if new.data_original<=hoje or new.nova_data<hoje or new.nova_data>=new.data_original then raise exception 'Escolha uma visita futura e uma data entre hoje e o dia anterior'; end if;
 if not private.programada_na_data(new.user_id,new.cliente_id,new.data_original) then raise exception 'A ocorrência original não está mais disponível'; end if;
 if private.programada_na_data(new.user_id,new.cliente_id,new.nova_data)
  or exists(select 1 from public.antecipacoes_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id and a.cancelado_em is null and a.data_original=new.nova_data)
  or exists(select 1 from public.adiamentos_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id and a.data_original=new.nova_data)
  or exists(select 1 from public.visitas v where v.user_id=new.user_id and v.cliente_id=new.cliente_id and v.tipo='visita' and (v.data_visita at time zone 'America/Sao_Paulo')::date in(new.data_original,new.nova_data)) then raise exception 'Já existe outra limpeza nessa data ou a visita foi concluída'; end if;
 -- Uma ocorrência já antecipada não pode ser antecipada novamente; restaure-a primeiro.
 if exists(select 1 from public.antecipacoes_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id and a.cancelado_em is null and a.nova_data=new.data_original) then raise exception 'Restaure a data original antes de antecipar novamente'; end if;
 new.criado_por=auth.uid(); new.criado_em=now(); new.motivo=btrim(new.motivo); return new;
end; $$;
revoke all on function private.validar_antecipacao() from public,anon,authenticated;
alter table public.visitas add column antecipacao_id uuid references public.antecipacoes_visitas(id);
alter table public.visitas add column data_agendada date;
create index visitas_antecipacao on public.visitas(antecipacao_id) where antecipacao_id is not null;
create trigger validar_antecipacao before insert or update on public.antecipacoes_visitas for each row execute function private.validar_antecipacao();

-- Identidade original acompanha cadeias de adiamentos sem alterar dias recorrentes.
create function private.origem_ocorrencia(dono uuid,cliente bigint,dia date)
returns table(original date,antecipacao uuid) language sql stable security invoker set search_path='' as $$
 with recursive movimentos as (
 select a.data_original,a.nova_data,null::uuid as antecipacao from public.adiamentos_visitas a where a.user_id=dono and a.cliente_id=cliente
 union all select a.data_original,a.nova_data,a.id from public.antecipacoes_visitas a where a.user_id=dono and a.cliente_id=cliente and a.cancelado_em is null
 ), caminho as (
 select dia as data,null::uuid as antecipacao,array[dia] as vistos
 union all select m.data_original,coalesce(m.antecipacao,c.antecipacao),c.vistos||m.data_original from caminho c join movimentos m on m.nova_data=c.data
 where not m.data_original=any(c.vistos) and cardinality(c.vistos)<100
 ) select data,antecipacao from caminho order by (antecipacao is not null) desc,cardinality(vistos) desc,data limit 1;
$$;
revoke all on function private.origem_ocorrencia(uuid,bigint,date) from public,anon,authenticated;
grant execute on function private.origem_ocorrencia(uuid,bigint,date) to service_role;
create function private.vincular_limpeza_antecipada() returns trigger language plpgsql security definer set search_path='' as $$
declare dia date := coalesce(new.data_agendada,(new.data_visita at time zone 'America/Sao_Paulo')::date);
begin
 if new.tipo<>'visita' then new.antecipacao_id=null; return new; end if;
 if auth.uid() is null or not private.acesso_cliente(new.user_id,new.cliente_id) then raise exception 'Sem permissão para esta limpeza'; end if;
 perform 1 from public.clientes where id=new.cliente_id and user_id=new.user_id for update;
 if new.data_agendada is not null and (dia>(now() at time zone 'America/Sao_Paulo')::date or not private.programada_na_data(new.user_id,new.cliente_id,dia)) then raise exception 'Esta ocorrência não está mais disponível. Atualize a agenda'; end if;
 if exists(select 1 from public.antecipacoes_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id and a.cancelado_em is null and a.data_original=dia) then raise exception 'Esta visita foi antecipada. Atualize a agenda'; end if;
 select o.antecipacao into new.antecipacao_id from private.origem_ocorrencia(new.user_id,new.cliente_id,dia) o;
 new.data_agendada=dia;
 if new.antecipacao_id is not null and exists(select 1 from public.visitas v where v.antecipacao_id=new.antecipacao_id and v.id<>new.id and v.tipo='visita') then raise exception 'Esta visita antecipada já foi concluída'; end if;
 return new;
end; $$;
revoke all on function private.vincular_limpeza_antecipada() from public,anon,authenticated;
create trigger vincular_limpeza_antecipada before insert on public.visitas for each row execute function private.vincular_limpeza_antecipada();
-- A revisão de produtos/fotos não pode mudar a ocorrência da limpeza concluída.
create function private.proteger_ocorrencia_concluida() returns trigger language plpgsql set search_path='' as $$
begin
 if new.data_agendada is distinct from old.data_agendada or new.antecipacao_id is distinct from old.antecipacao_id or (old.antecipacao_id is not null and
 (new.user_id is distinct from old.user_id or new.cliente_id is distinct from old.cliente_id or new.data_visita is distinct from old.data_visita or new.tipo is distinct from old.tipo)) then raise exception 'A ocorrência de uma visita concluída não pode ser alterada'; end if;
 return new;
end; $$;
revoke all on function private.proteger_ocorrencia_concluida() from public,anon,authenticated;
create trigger proteger_ocorrencia_concluida before update on public.visitas for each row execute function private.proteger_ocorrencia_concluida();

create table public.notificacoes_preferencias (
 user_id uuid primary key references auth.users(id),
 ativo boolean not null default true,
 modo text not null default 'resumo' check(modo in('resumo','individual','ambos')),
 horario time not null default '07:00',
 antecedencia integer not null default 30 check(antecedencia in(15,30,60)),
 fuso text not null default 'America/Sao_Paulo'
);
alter table public.notificacoes_preferencias enable row level security;
revoke all on public.notificacoes_preferencias from public,anon,authenticated;
grant select,insert,update on public.notificacoes_preferencias to authenticated;
grant select on public.notificacoes_preferencias to service_role;
create policy preferencias_proprias on public.notificacoes_preferencias for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function private.validar_fuso_lembrete() returns trigger language plpgsql set search_path='' as $$
begin if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.fuso) then raise exception 'Fuso horário inválido'; end if; return new; end; $$;
revoke all on function private.validar_fuso_lembrete() from public,anon,authenticated;
create trigger validar_fuso before insert or update on public.notificacoes_preferencias for each row execute function private.validar_fuso_lembrete();

create table public.notificacoes_entregas (
 dispositivo_id uuid not null references public.notificacoes_dispositivos(id) on delete cascade,
 evento text not null, token uuid not null default gen_random_uuid(),
 reservado_ate timestamptz not null, enviado_em timestamptz,
 primary key(dispositivo_id,evento)
);
alter table public.notificacoes_entregas enable row level security;
revoke all on public.notificacoes_entregas from public,anon,authenticated;
grant select,insert,update on public.notificacoes_entregas to service_role;
-- RPC nova: a função antiga é preservada até a Edge Function ser atualizada.
create function private.eventos_lembretes(p_agora timestamptz)
returns table(dispositivo_id uuid,evento text,assinatura jsonb,tipo text,quantidade bigint,clientes jsonb,validade timestamptz)
language sql security invoker set search_path='' as $$
 with contextos as (
 select n.id,n.assinatura,n.ultimo_envio,n.horario as horario_antigo,n.user_id,
 coalesce(v.dono,u.id) as dono,coalesce(v.total,0) as vinculos,coalesce(v.rotas,'[]'::jsonb) as rotas,
 coalesce(p.fuso,'America/Sao_Paulo') as fuso,coalesce(p.modo,'resumo') as modo,
 coalesce(p.horario,n.horario) as horario,coalesce(p.antecedencia,30) as antecedencia,
 (p_agora at time zone coalesce(p.fuso,'America/Sao_Paulo'))::date as hoje
 from public.notificacoes_dispositivos n join auth.users u on u.id=n.user_id
 left join public.notificacoes_preferencias p on p.user_id=n.user_id
 left join lateral (select count(*) as total,(array_agg(e.employer_uid))[1] as dono,(jsonb_agg(e.rotas))->0 as rotas
 from public.equipes_links e where lower(btrim(e.email_funcionario))=lower(btrim(u.email)) and e.employer_uid<>u.id and u.email_confirmed_at is not null) v on true
 where n.ativo and coalesce(p.ativo,true) and (n.bloqueado_ate is null or n.bloqueado_ate<p_agora)
 ), pendentes as (
 select x.*,c.id as cliente,c.nome,left(coalesce(c.hora_visita,''),5) as hora,d.dia,o.original,
 case when c.hora_visita ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then (d.dia+c.hora_visita::time) at time zone x.fuso end as atendimento
 from contextos x cross join lateral (values(x.hoje),(x.hoje+1)) d(dia)
 join public.clientes c on c.user_id=x.dono
 cross join lateral private.origem_ocorrencia(c.user_id,c.id,d.dia) o
 where x.vinculos<=1 and (x.vinculos=0 or exists(select 1 from jsonb_array_elements_text(x.rotas) r where r=c.id::text))
 and private.programada_na_data(c.user_id,c.id,d.dia)
 and not exists(select 1 from public.visitas v where v.user_id=c.user_id and v.cliente_id=c.id and v.tipo='visita' and (coalesce(v.data_agendada,(coalesce(v.data_visita,v.created_at) at time zone 'America/Sao_Paulo')::date)=d.dia or (o.antecipacao is not null and v.antecipacao_id=o.antecipacao)))
 ), eventos as (
 select p.id,'resumo:'||p.hoje as evento,'resumo' as tipo,count(*) as quantidade,
 (jsonb_agg(jsonb_build_object('nome',left(p.nome,60),'hora',p.hora) order by nullif(p.hora,''),p.cliente))->0 as primeiro,
 jsonb_path_query_array(jsonb_agg(jsonb_build_object('nome',left(p.nome,60),'hora',p.hora) order by nullif(p.hora,''),p.cliente),'$[0 to 4]') as clientes,
 ((p.hoje+1)::timestamp at time zone p.fuso) as validade
 from pendentes p where p.dia=p.hoje and p.modo in('resumo','ambos') and p.ultimo_envio is distinct from p.hoje
 and (p_agora at time zone p.fuso)::time>=p.horario
 group by p.id,p.hoje,p.fuso
 union all
 select p.id,'individual:'||p.cliente||':'||p.original,'individual',1,null::jsonb,jsonb_build_array(jsonb_build_object('nome',left(p.nome,60),'hora',p.hora)),p.atendimento
 from pendentes p where p.modo in('individual','ambos') and p.atendimento>p_agora and p.atendimento-p.antecedencia*interval '1 minute'<=p_agora
 ) select e.id as dispositivo_id,e.evento,x.assinatura,e.tipo,e.quantidade,e.clientes,e.validade from eventos e join contextos x on x.id=e.id;
$$;
revoke all on function private.eventos_lembretes(timestamptz) from public,anon,authenticated;
grant execute on function private.eventos_lembretes(timestamptz) to service_role;
create function public.reivindicar_lembretes_v2(p_agora timestamptz default now())
returns table(dispositivo_id uuid,evento text,token uuid,assinatura jsonb,tipo text,quantidade bigint,clientes jsonb,validade timestamptz)
language sql security invoker set search_path='' as $$
 with candidatos as (
 select e.* from private.eventos_lembretes(p_agora) e left join public.notificacoes_entregas t on t.dispositivo_id=e.dispositivo_id and t.evento=e.evento
 where t.enviado_em is null and (t.reservado_ate is null or t.reservado_ate<p_agora)
 order by e.validade,e.dispositivo_id,e.evento limit 200
 ), reservados as (
 insert into public.notificacoes_entregas as t(dispositivo_id,evento,token,reservado_ate)
 select c.dispositivo_id,c.evento,gen_random_uuid(),p_agora+interval '5 minutes' from candidatos c
 on conflict(dispositivo_id,evento) do update set token=excluded.token,reservado_ate=excluded.reservado_ate
 where t.enviado_em is null and t.reservado_ate<p_agora
 returning t.dispositivo_id,t.evento,t.token
 ) select r.dispositivo_id,r.evento,r.token,c.assinatura,c.tipo,c.quantidade,c.clientes,c.validade
 from reservados r join candidatos c on c.dispositivo_id=r.dispositivo_id and c.evento=r.evento;
$$;
revoke all on function public.reivindicar_lembretes_v2(timestamptz) from public,anon,authenticated;
grant execute on function public.reivindicar_lembretes_v2(timestamptz) to service_role;
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
 if not private.programada_na_data(new.user_id,new.cliente_id,new.data_original) then
   raise exception 'Não existe visita programada para esta data';
 end if;
 if exists(select 1 from public.visitas v where v.cliente_id=new.cliente_id and v.user_id=new.user_id and v.tipo='visita' and coalesce(v.data_agendada,(v.data_visita at time zone 'America/Sao_Paulo')::date)=new.data_original) then
   raise exception 'Esta limpeza já foi finalizada';
 end if;
 if new.foto_caminho is not null and (new.comparecimento_em is null or new.foto_caminho !~ ('^'||auth.uid()::text||'/adiamentos/[0-9a-f-]+\.(jpg|jpeg|png|webp)$')) then
   raise exception 'A fotografia precisa pertencer ao responsável pelo comparecimento';
 end if;
 if exists(select 1 from public.antecipacoes_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id and a.cancelado_em is null and a.data_original=new.nova_data) then raise exception 'Essa data pertence à ocorrência já antecipada. Escolha outra data'; end if;
 if private.programada_na_data(new.user_id,new.cliente_id,new.nova_data) and
 (exists(select 1 from private.origem_ocorrencia(new.user_id,new.cliente_id,new.data_original) o where o.antecipacao is not null)
 or exists(select 1 from private.origem_ocorrencia(new.user_id,new.cliente_id,new.nova_data) o where o.antecipacao is not null)) then
   raise exception 'Essa data já possui outra limpeza deste cliente. Escolha outra data para preservar as ocorrências';
 end if;
 new.motivo=btrim(new.motivo);
 new.horario_original=coalesce(cliente.hora_visita,'');
 new.criado_em=now();
 if new.comparecimento_em is not null then new.comparecimento_em=now(); end if;
 return new;
end; $$;
revoke all on function private.validar_adiamento() from public,anon,authenticated;


-- Revalida agenda, permissão, preferências e conclusão imediatamente antes do envio.
create function public.preparar_envio_lembrete(p_dispositivo uuid,p_evento text,p_token uuid,p_agora timestamptz default now())
returns table(dispositivo_id uuid,evento text,assinatura jsonb,tipo text,quantidade bigint,clientes jsonb,validade timestamptz)
language sql security invoker set search_path='' as $$
 select e.* from private.eventos_lembretes(p_agora) e join public.notificacoes_entregas t on t.dispositivo_id=e.dispositivo_id and t.evento=e.evento
 where t.dispositivo_id=p_dispositivo and t.evento=p_evento and t.token=p_token and t.enviado_em is null and t.reservado_ate>p_agora;
$$;
revoke all on function public.preparar_envio_lembrete(uuid,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.preparar_envio_lembrete(uuid,text,uuid,timestamptz) to service_role;
grant usage on schema private to service_role;
grant select on public.clientes,public.visitas,public.adiamentos_visitas,public.equipes_links to service_role;
-- Datas de conclusão da agenda não mudam quando o atendimento termina após meia-noite.
create or replace function private.conclusoes_agenda(dono uuid)
returns table(id uuid,cliente_id bigint,data_visita timestamptz)
language sql stable security definer set search_path='' as $$
 select v.id,v.cliente_id,coalesce(v.data_agendada::timestamp at time zone 'America/Sao_Paulo',v.data_visita,v.created_at) from public.visitas v
 where auth.uid() is not null and v.user_id=dono and v.tipo='visita'
 and private.acesso_cliente(dono,v.cliente_id)
 and (not private.funcionario_vinculado() or exists(select 1 from private.meus_vinculos() e where e.employer_uid=dono));
$$;
revoke all on function private.conclusoes_agenda(uuid) from public,anon;
grant execute on function private.conclusoes_agenda(uuid) to authenticated;
create or replace function private.validar_limpeza_adiada() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='visita' and auth.uid() is not null and private.acesso_cliente(new.user_id,new.cliente_id) then
   perform 1 from public.clientes c where c.id=new.cliente_id and c.user_id=new.user_id for update;
   if exists(select 1 from public.adiamentos_visitas a where a.user_id=new.user_id and a.cliente_id=new.cliente_id
     and a.data_original=coalesce(new.data_agendada,(new.data_visita at time zone 'America/Sao_Paulo')::date)) then
     raise exception 'Esta visita foi adiada. Confira a nova data na agenda';
   end if;
 end if;
 return new;
end; $$;
revoke all on function private.validar_limpeza_adiada() from public,anon,authenticated;
commit;
