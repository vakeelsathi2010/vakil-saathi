insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists voice_notes_case_created_idx on public.voice_notes(case_id, created_at desc);
alter table public.voice_notes enable row level security;

create policy "advocates manage their own voice notes" on public.voice_notes
  for all to authenticated
  using (advocate_id in (select id from public.advocates where user_id = auth.uid()))
  with check (advocate_id in (select id from public.advocates where user_id = auth.uid()));

create policy "users upload their own voice audio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read their own voice audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own voice audio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);
