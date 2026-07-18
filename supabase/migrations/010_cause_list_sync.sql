create table if not exists public.cause_list_entries (
  id uuid primary key default gen_random_uuid(),
  court_name text not null,
  cause_date date not null,
  case_number text not null,
  party_name text,
  judge_name text,
  queue_position integer,
  raw_data jsonb not null default '{}'::jsonb,
  source_url text,
  fetched_at timestamptz not null default now(),
  unique (court_name, cause_date, case_number)
);

create table if not exists public.case_cause_list_sync (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  cause_list_entry_id uuid not null references public.cause_list_entries(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  queue_position integer,
  last_seen_at timestamptz not null default now(),
  unique (case_id, cause_list_entry_id)
);

create index if not exists cause_list_entries_lookup_idx on public.cause_list_entries (cause_date, court_name, case_number);
create index if not exists case_cause_list_sync_case_idx on public.case_cause_list_sync (case_id, last_seen_at desc);

alter table public.cause_list_entries enable row level security;
alter table public.case_cause_list_sync enable row level security;

create policy "cause list entries visible to advocates with a linked case"
  on public.cause_list_entries for select to authenticated
  using (id in (select cause_list_entry_id from public.case_cause_list_sync where advocate_id in (select id from public.advocates where user_id = auth.uid())));

create policy "advocates view their own cause list matches"
  on public.case_cause_list_sync for select to authenticated
  using (advocate_id in (select id from public.advocates where user_id = auth.uid()));
