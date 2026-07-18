create table if not exists public.advocate_subscriptions (
  advocate_id uuid primary key references public.advocates(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'strategy_monthly')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'cancelled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.case_strategies (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  strategy jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists case_strategies_case_created_idx on public.case_strategies(case_id, created_at desc);
alter table public.advocate_subscriptions enable row level security;
alter table public.case_strategies enable row level security;
create policy "advocates read their subscription" on public.advocate_subscriptions for select to authenticated using (advocate_id in (select id from public.advocates where user_id = auth.uid()));
create policy "advocates read their strategies" on public.case_strategies for select to authenticated using (advocate_id in (select id from public.advocates where user_id = auth.uid()));
