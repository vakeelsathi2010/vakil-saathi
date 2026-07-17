-- Supporting records used by backend/routes/cases.js.
-- Apply through the Supabase SQL editor or migration workflow before enabling the endpoint.

create unique index if not exists cases_case_number_unique_idx on cases(case_number);

create table if not exists case_history (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade not null,
  advocate_id uuid references advocates(id) on delete cascade not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists case_action_items (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade not null,
  advocate_id uuid references advocates(id) on delete cascade not null,
  title text not null,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_reminders (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade not null,
  advocate_id uuid references advocates(id) on delete cascade not null,
  recipient_type text not null check (recipient_type in ('advocate', 'client')),
  reminder_date date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

alter table case_history enable row level security;
alter table case_action_items enable row level security;
alter table case_reminders enable row level security;

create policy "case_history_own_advocate" on case_history
  for all using (advocate_id in (select id from advocates where user_id = auth.uid()));
create policy "case_actions_own_advocate" on case_action_items
  for all using (advocate_id in (select id from advocates where user_id = auth.uid()));
create policy "case_reminders_own_advocate" on case_reminders
  for all using (advocate_id in (select id from advocates where user_id = auth.uid()));

create trigger case_action_items_updated_at before update on case_action_items
  for each row execute function update_updated_at();
