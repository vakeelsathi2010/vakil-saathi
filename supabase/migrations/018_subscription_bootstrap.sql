-- Safe catch-up migration for all paid modules.
create table if not exists public.advocate_subscriptions (
  advocate_id uuid primary key references public.advocates(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive' check (status in ('active', 'inactive', 'cancelled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.advocate_subscriptions drop constraint if exists advocate_subscriptions_plan_check;
alter table public.advocate_subscriptions add constraint advocate_subscriptions_plan_check check (plan in ('free', 'strategy_monthly', 'ocr_monthly', 'analytics_monthly', 'pro_monthly'));

alter table public.advocate_subscriptions enable row level security;
drop policy if exists "advocates read their subscription" on public.advocate_subscriptions;
create policy "advocates read their subscription" on public.advocate_subscriptions for select to authenticated using (advocate_id in (select id from public.advocates where user_id = auth.uid()));
