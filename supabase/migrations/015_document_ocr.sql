alter table public.advocate_subscriptions drop constraint if exists advocate_subscriptions_plan_check;
alter table public.advocate_subscriptions add constraint advocate_subscriptions_plan_check check (plan in ('free', 'strategy_monthly', 'ocr_monthly', 'pro_monthly'));

create table if not exists public.case_ocr_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  source_file_name text not null,
  extraction jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists case_ocr_runs_case_created_idx on public.case_ocr_runs(case_id, created_at desc);
alter table public.case_ocr_runs enable row level security;
create policy "advocates read their OCR runs" on public.case_ocr_runs for select to authenticated using (advocate_id in (select id from public.advocates where user_id = auth.uid()));
