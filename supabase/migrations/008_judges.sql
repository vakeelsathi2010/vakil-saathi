-- Advocate-owned judge practice notes. These are manual observations, not court records.
create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  name text not null,
  court text not null,
  bail_grant_rate numeric(5,2) check (bail_grant_rate between 0 and 100),
  avg_case_duration text,
  total_cases integer not null default 0 check (total_cases >= 0),
  works_on text[] not null default '{}',
  preferences text,
  tips text[] not null default '{}',
  working_hours text,
  case_type_success jsonb not null default '{}'::jsonb,
  rating numeric(2,1) check (rating between 1 and 5),
  rating_notes text,
  source text not null default 'manual' check (source in ('manual', 'advocate_feedback', 'court_record')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advocate_id, name, court)
);

create index if not exists judges_advocate_court_idx on public.judges (advocate_id, court);

alter table public.judges enable row level security;

create policy "Advocates manage their own judge notes"
  on public.judges for all
  using (advocate_id in (select id from public.advocates where user_id = auth.uid()))
  with check (advocate_id in (select id from public.advocates where user_id = auth.uid()));
