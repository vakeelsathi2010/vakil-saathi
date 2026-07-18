insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default now()
);

create index if not exists case_documents_case_created_idx on public.case_documents(case_id, created_at desc);
create index if not exists case_documents_advocate_created_idx on public.case_documents(advocate_id, created_at desc);
alter table public.case_documents enable row level security;

create policy "advocates manage their own case documents" on public.case_documents
  for all to authenticated
  using (advocate_id in (select id from public.advocates where user_id = auth.uid()))
  with check (advocate_id in (select id from public.advocates where user_id = auth.uid()));

create policy "users upload their own case documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read their own case documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own case documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
