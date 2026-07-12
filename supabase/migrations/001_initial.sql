-- ============================================================
-- VakilSaathi — Initial Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ADVOCATES TABLE
-- ============================================================
create table if not exists advocates (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null unique,
  full_name     text not null,
  phone         text not null,
  bci_number    text,
  bar_association text default 'Kanpur Bar Association',
  courts        text[] default array['District Court, Kanpur'],
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
create table if not exists clients (
  id              uuid primary key default uuid_generate_v4(),
  advocate_id     uuid references advocates(id) on delete cascade not null,
  full_name       text not null,
  phone           text not null,
  address         text,
  consent_given   boolean default false,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- CASES TABLE
-- ============================================================
create table if not exists cases (
  id              uuid primary key default uuid_generate_v4(),
  advocate_id     uuid references advocates(id) on delete cascade not null,
  client_id       uuid references clients(id) on delete set null,
  case_number     text not null,
  case_title      text,
  court_name      text not null,
  judge_name      text,
  case_type       text not null default 'Civil',  -- Civil, Criminal, Family, Labour, etc.
  opposite_party  text,
  fir_number      text,
  status          text default 'Active',  -- Active, Disposed, Stayed, Transferred
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- HEARINGS TABLE
-- ============================================================
create table if not exists hearings (
  id              uuid primary key default uuid_generate_v4(),
  case_id         uuid references cases(id) on delete cascade not null,
  advocate_id     uuid references advocates(id) on delete cascade not null,
  hearing_date    date not null,
  hearing_time    time,
  hearing_purpose text,  -- Arguments, Evidence, Judgment, Mediation, etc.
  outcome         text,  -- What happened in this hearing
  next_date       date,
  reminder_sent_advocate  boolean default false,
  reminder_sent_client    boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- REMINDERS LOG TABLE
-- ============================================================
create table if not exists reminder_logs (
  id            uuid primary key default uuid_generate_v4(),
  hearing_id    uuid references hearings(id) on delete cascade not null,
  recipient_type text not null,  -- 'advocate' or 'client'
  phone         text not null,
  channel       text not null,   -- 'whatsapp' or 'sms'
  status        text default 'sent',  -- 'sent', 'failed'
  error_msg     text,
  sent_at       timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Har advocate sirf apna data dekh sake
-- ============================================================

alter table advocates enable row level security;
alter table clients enable row level security;
alter table cases enable row level security;
alter table hearings enable row level security;
alter table reminder_logs enable row level security;

-- Advocates: khud ki row
create policy "advocates_own_row" on advocates
  for all using (auth.uid() = user_id);

-- Clients: sirf apne advocate ki
create policy "clients_own_advocate" on clients
  for all using (
    advocate_id in (select id from advocates where user_id = auth.uid())
  );

-- Cases: sirf apne
create policy "cases_own_advocate" on cases
  for all using (
    advocate_id in (select id from advocates where user_id = auth.uid())
  );

-- Hearings: sirf apne
create policy "hearings_own_advocate" on hearings
  for all using (
    advocate_id in (select id from advocates where user_id = auth.uid())
  );

-- Reminder logs: sirf apne hearings ke
create policy "reminder_logs_own" on reminder_logs
  for all using (
    hearing_id in (
      select h.id from hearings h
      join advocates a on a.id = h.advocate_id
      where a.user_id = auth.uid()
    )
  );

-- ============================================================
-- HELPFUL VIEWS
-- ============================================================

-- Upcoming hearings view (agle 30 din ki)
create or replace view upcoming_hearings_view as
  select
    h.id,
    h.hearing_date,
    h.hearing_time,
    h.hearing_purpose,
    h.reminder_sent_advocate,
    h.reminder_sent_client,
    c.case_number,
    c.case_title,
    c.court_name,
    c.judge_name,
    c.case_type,
    cl.full_name as client_name,
    cl.phone as client_phone,
    a.full_name as advocate_name,
    a.phone as advocate_phone,
    a.user_id
  from hearings h
  join cases c on c.id = h.case_id
  left join clients cl on cl.id = c.client_id
  join advocates a on a.id = h.advocate_id
  where h.hearing_date >= current_date
  order by h.hearing_date asc;

-- ============================================================
-- FUNCTION: Auto-update updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger advocates_updated_at before update on advocates
  for each row execute function update_updated_at();
create trigger clients_updated_at before update on clients
  for each row execute function update_updated_at();
create trigger cases_updated_at before update on cases
  for each row execute function update_updated_at();
create trigger hearings_updated_at before update on hearings
  for each row execute function update_updated_at();
