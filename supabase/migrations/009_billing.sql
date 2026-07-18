create table if not exists public.billing (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  fee_amount numeric(12,2) not null check (fee_amount > 0),
  fee_status text not null default 'Pending' check (fee_status in ('Paid', 'Pending')),
  due_date date,
  paid_date date,
  payment_mode text,
  notes text not null default '',
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_case_status_due_idx on public.billing (case_id, fee_status, due_date);
create index if not exists billing_client_idx on public.billing (client_id);

alter table public.billing enable row level security;

create policy "Advocates manage billing for their own cases"
  on public.billing for all
  using (case_id in (select id from public.cases where advocate_id in (select id from public.advocates where user_id = auth.uid())))
  with check (case_id in (select id from public.cases where advocate_id in (select id from public.advocates where user_id = auth.uid())));
