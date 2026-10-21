begin;
create table public.notificacoes_dispositivos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 endpoint text not null check(length(endpoint) between 20 and 2048 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/'),
 assinatura jsonb not null check(assinatura ? 'endpoint' and assinatura ? 'keys' and assinatura->'keys' ? 'p256dh' and assinatura->'keys' ? 'auth' and assinatura->>'endpoint'=endpoint and length(assinatura#>>'{keys,p256dh}') between 80 and 100 and length(assinatura#>>'{keys,auth}') between 20 and 30),
 horario time not null default '07:00',
 ativo boolean not null default false,
 ultimo_envio date,
 bloqueado_ate timestamptz,
 unique(user_id,endpoint)
);
alter table public.notificacoes_dispositivos enable row level security;
revoke all on public.notificacoes_dispositivos from public,anon,authenticated;
grant select,delete on public.notificacoes_dispositivos to authenticated;
grant insert(user_id,endpoint,assinatura,horario,ativo),update(user_id,endpoint,assinatura,horario,ativo) on public.notificacoes_dispositivos to authenticated;
grant all on public.notificacoes_dispositivos to service_role;
create policy dispositivos_proprios on public.notificacoes_dispositivos for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index dispositivos_ativos on public.notificacoes_dispositivos(horario) where ativo;
create index dispositivos_usuario on public.notificacoes_dispositivos(user_id);

-- Somente o serviço agendado pode consultar e reservar entregas.
-- O papel service_role já ignora RLS; não é necessário SECURITY DEFINER.
create function public.reivindicar_lembretes()
returns table(id uuid,assinatura jsonb,quantidade bigint,dia date)
language sql security invoker set search_path='' as $$
 with contextos as (
  select u.id as uid, coalesce(v.dono,u.id) as dono, coalesce(v.total,0) as vinculos,
   coalesce(v.rotas,'[]'::jsonb) as rotas,
   (now() at time zone 'America/Sao_Paulo')::date as hoje
  from auth.users u
  left join lateral (
   select count(*) as total,(array_agg(e.employer_uid))[1] as dono,(jsonb_agg(e.rotas))->0 as rotas
   from public.equipes_links e where lower(btrim(e.email_funcionario))=lower(btrim(u.email))
    and e.employer_uid<>u.id and u.email_confirmed_at is not null
  ) v on true
 ), candidatos as (
  select n.id, x.hoje, p.quantidade
  from public.notificacoes_dispositivos n join contextos x on x.uid=n.user_id
  cross join lateral (
   select count(*) as quantidade from public.clientes c
   where c.user_id=x.dono and x.vinculos<=1
    and (x.vinculos=0 or exists(select 1 from jsonb_array_elements_text(x.rotas) r where r=c.id::text))
    and (extract(dow from x.hoje)::int=any(coalesce(c.dias_visita,array[]::integer[]))
      or exists(select 1 from public.adiamentos_visitas a where a.user_id=c.user_id and a.cliente_id=c.id and a.nova_data=x.hoje))
    and not exists(select 1 from public.adiamentos_visitas a where a.user_id=c.user_id and a.cliente_id=c.id and a.data_original=x.hoje)
    and not exists(select 1 from public.visitas v where v.user_id=c.user_id and v.cliente_id=c.id and v.tipo='visita' and (coalesce(v.data_visita,v.created_at) at time zone 'America/Sao_Paulo')::date=x.hoje)
  ) p
  where n.ativo and n.horario<=(now() at time zone 'America/Sao_Paulo')::time
   and n.ultimo_envio is distinct from x.hoje and (n.bloqueado_ate is null or n.bloqueado_ate<now()) and p.quantidade>0
  order by n.horario,n.id limit 200
 ), reservados as (
  update public.notificacoes_dispositivos n set bloqueado_ate=now()+interval '5 minutes'
  from candidatos c where n.id=c.id and (n.bloqueado_ate is null or n.bloqueado_ate<now())
   and n.ultimo_envio is distinct from c.hoje
  returning n.id,n.assinatura,c.quantidade,c.hoje
 ) select * from reservados;
$$;
revoke all on function public.reivindicar_lembretes() from public,anon,authenticated;
grant execute on function public.reivindicar_lembretes() to service_role;
commit;
