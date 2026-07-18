create table if not exists public.bail_details (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.cases(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  bail_amount numeric(12,2),
  payment_status text not null default 'Pending' check (payment_status in ('Pending', 'Partially Paid', 'Paid', 'Not Applicable')),
  surety_name text,
  surety_phone text,
  surety_address text,
  release_order_received boolean not null default false,
  release_order_number text,
  release_date date,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists bail_details_advocate_idx on public.bail_details(advocate_id, updated_at desc);
alter table public.bail_details enable row level security;
create policy "advocates manage their bail tracking" on public.bail_details for all to authenticated
  using (advocate_id in (select id from public.advocates where user_id = auth.uid()))
  with check (advocate_id in (select id from public.advocates where user_id = auth.uid()));
