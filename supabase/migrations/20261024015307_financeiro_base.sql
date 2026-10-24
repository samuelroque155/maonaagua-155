-- Módulo financeiro: dados isolados por conta; não modifica clientes nem visitas existentes.
begin;

create table public.contas_recebimento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  instituicao text not null check (instituicao in ('InfinitePay','Nubank','Banco Inter','Mercado Pago','PagBank','Itaú','Bradesco','Banco do Brasil','Caixa','Outros bancos')),
  nome_instituicao text not null default '',
  nome_titular text not null check (length(btrim(nome_titular)) between 1 and 160),
  tipo_chave_pix text check (tipo_chave_pix is null or tipo_chave_pix in ('cpf','cnpj','email','telefone','aleatoria')),
  chave_pix text check (chave_pix is null or length(chave_pix) <= 255),
  link_pagamento text check (link_pagamento is null or (length(link_pagamento) <= 1000 and link_pagamento ~ '^https://')),
  link_recorrencia text check (link_recorrencia is null or (length(link_recorrencia) <= 1000 and link_recorrencia ~ '^https://')),
  tipo_integracao text not null default 'pix_manual' check (tipo_integracao in ('pix_manual','link_manual','infinitepay_plano')),
  identificador_infinitepay text not null default '' check (length(identificador_infinitepay) <= 120),
  principal boolean not null default false,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create unique index contas_recebimento_uma_principal on public.contas_recebimento(user_id) where principal and ativa;
create index contas_recebimento_usuario on public.contas_recebimento(user_id);
alter table public.contas_recebimento enable row level security;
revoke all on public.contas_recebimento from public, anon, authenticated;
grant select, insert, update on public.contas_recebimento to authenticated;
create policy contas_recebimento_proprias on public.contas_recebimento for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy contas_recebimento_criar_proprias on public.contas_recebimento for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy contas_recebimento_editar_proprias on public.contas_recebimento for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create table public.clientes_financeiro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  cliente_id bigint not null references public.clientes(id),
  valor_mensal numeric(12,2) not null check (valor_mensal > 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  telefone_cobranca text not null default '' check (length(telefone_cobranca) <= 40),
  forma_pagamento text not null default 'pix' check (forma_pagamento in ('pix','link','dinheiro','transferencia','infinitepay')),
  conta_recebimento_id uuid,
  recorrencia_ativa boolean not null default false,
  descricao text not null default 'Manutenção mensal de piscina.' check (length(descricao) <= 300),
  link_pagamento text not null default '' check (length(link_pagamento) <= 1000 and (link_pagamento = '' or link_pagamento ~ '^https://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cliente_id),
  foreign key (user_id, conta_recebimento_id) references public.contas_recebimento(user_id, id)
);
create index clientes_financeiro_usuario on public.clientes_financeiro(user_id);
create index clientes_financeiro_cliente on public.clientes_financeiro(cliente_id);
alter table public.clientes_financeiro enable row level security;
revoke all on public.clientes_financeiro from public, anon, authenticated;
grant select, insert, update on public.clientes_financeiro to authenticated;
create policy clientes_financeiro_proprios on public.clientes_financeiro for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy clientes_financeiro_criar_proprios on public.clientes_financeiro for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy clientes_financeiro_editar_proprios on public.clientes_financeiro for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create table public.cobrancas_financeiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  cliente_id bigint not null references public.clientes(id),
  conta_recebimento_id uuid,
  competencia date not null,
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  descricao text not null check (length(descricao) between 1 and 300),
  forma_pagamento text not null check (forma_pagamento in ('pix','link','dinheiro','transferencia','infinitepay')),
  link_pagamento text not null default '' check (length(link_pagamento) <= 1000 and (link_pagamento = '' or link_pagamento ~ '^https://')),
  status text not null default 'aberta' check (status in ('aberta','cancelada')),
  cancelada_em timestamptz,
  motivo_cancelamento text not null default '' check (length(motivo_cancelamento) <= 500),
  provedor text not null default 'manual' check (provedor in ('manual','infinitepay')),
  identificador_externo text not null default '' check (length(identificador_externo) <= 180),
  created_at timestamptz not null default now(),
  unique (user_id, cliente_id, competencia),
  foreign key (user_id, conta_recebimento_id) references public.contas_recebimento(user_id, id)
);
create index cobrancas_financeiras_usuario_mes on public.cobrancas_financeiras(user_id, competencia desc);
create index cobrancas_financeiras_vencimento on public.cobrancas_financeiras(user_id, vencimento);
alter table public.cobrancas_financeiras enable row level security;
revoke all on public.cobrancas_financeiras from public, anon, authenticated;
grant select, insert, update on public.cobrancas_financeiras to authenticated;
create policy cobrancas_financeiras_proprias on public.cobrancas_financeiras for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy cobrancas_financeiras_criar_proprias on public.cobrancas_financeiras for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy cobrancas_financeiras_editar_proprias on public.cobrancas_financeiras for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create table public.pagamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  cobranca_id uuid not null references public.cobrancas_financeiras(id),
  valor numeric(12,2) not null check (valor <> 0),
  tipo text not null check (tipo in ('pagamento','estorno')),
  forma_pagamento text not null check (forma_pagamento in ('pix_manual','link_manual','dinheiro','transferencia','infinitepay')),
  origem_confirmacao text not null check (origem_confirmacao in ('manual','provedor')),
  transaction_id text not null default '' check (length(transaction_id) <= 180),
  corrige_pagamento_id uuid references public.pagamentos_financeiros(id),
  pago_em date not null default (now() at time zone 'America/Sao_Paulo')::date,
  criado_por uuid not null default auth.uid() references auth.users(id),
  observacao text not null default '' check (length(observacao) <= 1000),
  created_at timestamptz not null default now(),
  check ((tipo = 'pagamento' and valor > 0 and corrige_pagamento_id is null)
      or (tipo = 'estorno' and valor < 0 and corrige_pagamento_id is not null))
);
create unique index pagamentos_financeiros_um_estorno on public.pagamentos_financeiros(corrige_pagamento_id) where corrige_pagamento_id is not null;
create index pagamentos_financeiros_usuario_data on public.pagamentos_financeiros(user_id, pago_em desc);
create index pagamentos_financeiros_cobranca on public.pagamentos_financeiros(cobranca_id, created_at);
alter table public.pagamentos_financeiros enable row level security;
revoke all on public.pagamentos_financeiros from public, anon, authenticated;
grant select, insert on public.pagamentos_financeiros to authenticated;
create policy pagamentos_financeiros_proprios on public.pagamentos_financeiros for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pagamentos_financeiros_criar_proprios on public.pagamentos_financeiros for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select auth.uid()) = criado_por);

create table public.financeiro_auditoria (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  entidade text not null check (entidade in ('conta','cliente','cobranca','pagamento')),
  entidade_id text not null,
  acao text not null check (acao in ('criado','alterado')),
  dados_anteriores jsonb,
  dados_novos jsonb not null,
  criado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index financeiro_auditoria_usuario_data on public.financeiro_auditoria(user_id, created_at desc);
alter table public.financeiro_auditoria enable row level security;
revoke all on public.financeiro_auditoria from public, anon, authenticated;
grant select on public.financeiro_auditoria to authenticated;
create policy financeiro_auditoria_propria on public.financeiro_auditoria for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create function private.validar_vinculo_financeiro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare configuracao public.clientes_financeiro;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then raise exception 'Dados financeiros pertencem à conta autenticada'; end if;
  if tg_table_name = 'clientes_financeiro' then
    if not exists (select 1 from public.clientes c where c.id = new.cliente_id and c.user_id = new.user_id) then
      raise exception 'O cliente não pertence a esta conta';
    end if;
    if new.conta_recebimento_id is not null and not exists (
      select 1 from public.contas_recebimento a where a.id = new.conta_recebimento_id and a.user_id = new.user_id and a.ativa
    ) then raise exception 'A conta de recebimento não pertence a esta conta ou está inativa'; end if;
    new.updated_at = now();
  elsif tg_table_name = 'cobrancas_financeiras' then
    if not exists (select 1 from public.clientes c where c.id = new.cliente_id and c.user_id = new.user_id) then
      raise exception 'O cliente da cobrança não pertence a esta conta';
    end if;
    if new.conta_recebimento_id is not null and not exists (
      select 1 from public.contas_recebimento a where a.id = new.conta_recebimento_id and a.user_id = new.user_id
    ) then raise exception 'A conta da cobrança não pertence a esta conta'; end if;
    if tg_op = 'INSERT' then
      select * into configuracao from public.clientes_financeiro f where f.user_id = new.user_id and f.cliente_id = new.cliente_id;
      if not found or not configuracao.recorrencia_ativa or configuracao.valor_mensal <> new.valor or
        configuracao.descricao <> new.descricao or configuracao.forma_pagamento <> new.forma_pagamento then
        raise exception 'A cobrança precisa corresponder ao contrato mensal ativo do cliente';
      end if;
      if new.vencimento <> make_date(extract(year from new.competencia)::integer, extract(month from new.competencia)::integer,
        least(configuracao.dia_vencimento::integer, extract(day from (date_trunc('month', new.competencia) + interval '1 month - 1 day'))::integer)) then
        raise exception 'Data de vencimento mensal inválida';
      end if;
    end if;
    if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id or
      new.cliente_id is distinct from old.cliente_id or new.conta_recebimento_id is distinct from old.conta_recebimento_id or
      new.competencia is distinct from old.competencia or new.valor is distinct from old.valor or
      new.vencimento is distinct from old.vencimento or new.descricao is distinct from old.descricao or
      new.forma_pagamento is distinct from old.forma_pagamento or new.link_pagamento is distinct from old.link_pagamento or
      new.provedor is distinct from old.provedor or new.identificador_externo is distinct from old.identificador_externo or
      old.status <> 'aberta' or new.status <> 'cancelada' or length(btrim(new.motivo_cancelamento)) = 0) then
      raise exception 'Uma mensalidade emitida não pode ser reescrita; cancele-a com motivo e gere outro lançamento';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.validar_vinculo_financeiro() from public, anon, authenticated;
create trigger validar_conta_financeira before insert or update on public.contas_recebimento
  for each row execute function private.validar_vinculo_financeiro();
create trigger validar_cliente_financeiro before insert or update on public.clientes_financeiro
  for each row execute function private.validar_vinculo_financeiro();
create trigger validar_cobranca_financeira before insert or update on public.cobrancas_financeiras
  for each row execute function private.validar_vinculo_financeiro();

create function private.validar_pagamento_financeiro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare original public.pagamentos_financeiros; total_cobranca numeric(12,2); total_registrado numeric(12,2);
begin
  if auth.uid() is null or new.user_id <> auth.uid() or new.criado_por <> auth.uid() then raise exception 'Pagamento pertence à conta autenticada'; end if;
  select c.valor into total_cobranca from public.cobrancas_financeiras c
    where c.id = new.cobranca_id and c.user_id = new.user_id and c.status = 'aberta' for update;
  if not found then
    raise exception 'A cobrança não está aberta ou não pertence a esta conta';
  end if;
  select coalesce(sum(p.valor),0) into total_registrado from public.pagamentos_financeiros p
    where p.cobranca_id = new.cobranca_id and p.user_id = new.user_id;
  if new.tipo = 'estorno' then
    select * into original from public.pagamentos_financeiros p where p.id = new.corrige_pagamento_id
      and p.cobranca_id = new.cobranca_id and p.user_id = new.user_id and p.tipo = 'pagamento';
    if not found or new.valor <> -original.valor or original.origem_confirmacao <> 'manual' then
      raise exception 'O estorno precisa corrigir integralmente um pagamento manual desta cobrança';
    end if;
  elsif new.corrige_pagamento_id is not null then
    raise exception 'Pagamento novo não pode alterar um registro anterior';
  elsif new.origem_confirmacao <> 'manual' then
    raise exception 'Confirmação por provedor exige webhook verificado no servidor';
  elsif total_registrado + new.valor > total_cobranca then
    raise exception 'O pagamento ultrapassa o saldo da cobrança';
  end if;
  return new;
end; $$;
revoke all on function private.validar_pagamento_financeiro() from public, anon, authenticated;
create trigger validar_pagamento_financeiro before insert on public.pagamentos_financeiros
  for each row execute function private.validar_pagamento_financeiro();

create function private.registrar_auditoria_financeira() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dono uuid; identificador text; entidade_nome text; acao_nome text;
begin
  dono := coalesce(new.user_id, old.user_id);
  if auth.uid() is null or dono <> auth.uid() then raise exception 'A auditoria exige a conta proprietária'; end if;
  identificador := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'cliente_id');
  entidade_nome := case tg_table_name when 'contas_recebimento' then 'conta' when 'clientes_financeiro' then 'cliente'
    when 'cobrancas_financeiras' then 'cobranca' else 'pagamento' end;
  acao_nome := case when tg_op = 'INSERT' then 'criado' else 'alterado' end;
  insert into public.financeiro_auditoria(user_id, entidade, entidade_id, acao, dados_anteriores, dados_novos, criado_por)
  values(dono, entidade_nome, identificador, acao_nome,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new), auth.uid());
  return new;
end; $$;
revoke all on function private.registrar_auditoria_financeira() from public, anon, authenticated;
create trigger auditar_conta_financeira after insert or update on public.contas_recebimento
  for each row execute function private.registrar_auditoria_financeira();
create trigger auditar_cliente_financeiro after insert or update on public.clientes_financeiro
  for each row execute function private.registrar_auditoria_financeira();
create trigger auditar_cobranca_financeira after insert or update on public.cobrancas_financeiras
  for each row execute function private.registrar_auditoria_financeira();
create trigger auditar_pagamento_financeiro after insert on public.pagamentos_financeiros
  for each row execute function private.registrar_auditoria_financeira();

create function public.gerar_cobrancas_financeiras(p_mes date default current_date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare dono uuid := auth.uid(); primeiro date; total integer;
begin
  if dono is null then raise exception 'Entre na sua conta para gerar mensalidades'; end if;
  primeiro := date_trunc('month', p_mes)::date;
  insert into public.cobrancas_financeiras(user_id, cliente_id, conta_recebimento_id, competencia, valor, vencimento, descricao, forma_pagamento, link_pagamento)
  select dono, f.cliente_id, coalesce(f.conta_recebimento_id, principal.id), primeiro, f.valor_mensal,
    make_date(extract(year from primeiro)::integer, extract(month from primeiro)::integer,
      least(f.dia_vencimento::integer, extract(day from (date_trunc('month', primeiro) + interval '1 month - 1 day'))::integer)),
    f.descricao, f.forma_pagamento, coalesce(nullif(f.link_pagamento, ''), nullif(principal.link_pagamento, ''), nullif(principal.link_recorrencia, ''), '')
  from public.clientes_financeiro f
  join public.clientes c on c.id = f.cliente_id and c.user_id = dono
  left join lateral (select a.id, a.link_pagamento, a.link_recorrencia from public.contas_recebimento a
    where a.user_id = dono and a.ativa and a.principal order by a.created_at limit 1) principal on true
  where f.user_id = dono and f.recorrencia_ativa and f.valor_mensal > 0
  on conflict (user_id, cliente_id, competencia) do nothing;
  get diagnostics total = row_count;
  return total;
end; $$;
revoke all on function public.gerar_cobrancas_financeiras(date) from public, anon;
grant execute on function public.gerar_cobrancas_financeiras(date) to authenticated;

commit;
