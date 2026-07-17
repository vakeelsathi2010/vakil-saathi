create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  level smallint not null check (level in (1, 2, 3)),
  scheduled_time timestamptz not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed', 'failed')),
  advocate_phone text,
  fcm_token text,
  payload jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0 check (retry_count between 0 and 3),
  last_error text,
  sent_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reminders_pending_schedule_idx on reminders(status, scheduled_time);
create index if not exists reminders_case_id_idx on reminders(case_id);

alter table reminders enable row level security;

create policy "reminders_own_advocate" on reminders
  for all to authenticated
  using (exists (
    select 1 from cases join advocates on advocates.id = cases.advocate_id
    where cases.id = reminders.case_id and advocates.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from cases join advocates on advocates.id = cases.advocate_id
    where cases.id = reminders.case_id and advocates.user_id = auth.uid()
  ));
