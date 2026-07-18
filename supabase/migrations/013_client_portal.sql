create table if not exists public.client_portal_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  advocate_id uuid not null references public.advocates(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  portal_link_id uuid not null references public.client_portal_links(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.client_portal_documents (
  id uuid primary key default gen_random_uuid(),
  portal_link_id uuid not null references public.client_portal_links(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists client_portal_links_case_idx on public.client_portal_links(case_id, created_at desc);
create index if not exists client_portal_messages_link_idx on public.client_portal_messages(portal_link_id, created_at desc);
alter table public.client_portal_links enable row level security;
alter table public.client_portal_messages enable row level security;
alter table public.client_portal_documents enable row level security;

create policy "advocates manage their case portal links" on public.client_portal_links for all to authenticated
  using (advocate_id in (select id from public.advocates where user_id = auth.uid()))
  with check (advocate_id in (select id from public.advocates where user_id = auth.uid()));
create policy "advocates read portal messages" on public.client_portal_messages for select to authenticated
  using (portal_link_id in (select id from public.client_portal_links where advocate_id in (select id from public.advocates where user_id = auth.uid())));
create policy "advocates read portal documents" on public.client_portal_documents for select to authenticated
  using (portal_link_id in (select id from public.client_portal_links where advocate_id in (select id from public.advocates where user_id = auth.uid())));

insert into storage.buckets (id, name, public) values ('client-portal-uploads', 'client-portal-uploads', false) on conflict (id) do nothing;

create or replace function public.client_portal_data(portal_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare link_row public.client_portal_links; result jsonb;
begin
  select * into link_row from public.client_portal_links where token_hash = portal_token_hash and revoked_at is null and (expires_at is null or expires_at > now()) limit 1;
  if link_row.id is null then return null; end if;
  update public.client_portal_links set last_accessed_at = now() where id = link_row.id;
  select jsonb_build_object(
    'linkId', link_row.id,
    'caseNumber', c.case_number,
    'title', c.case_title,
    'status', c.status,
    'courtName', c.court_name,
    'nextDate', (select coalesce(h.next_date, h.hearing_date) from public.hearings h where h.case_id = c.id order by coalesce(h.next_date, h.hearing_date) asc nulls last limit 1),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('title', a.title, 'dueDate', a.due_date, 'status', a.status) order by a.due_date nulls last) from public.case_action_items a where a.case_id = c.id and a.status <> 'completed'), '[]'::jsonb),
    'advocateName', adv.full_name,
    'advocatePhone', adv.phone
  ) into result
  from public.cases c join public.advocates adv on adv.id = c.advocate_id where c.id = link_row.case_id;
  return result;
end; $$;

create or replace function public.client_portal_add_message(portal_token_hash text, client_message text)
returns boolean language plpgsql security definer set search_path = public as $$
declare link_id uuid;
begin
  select id into link_id from public.client_portal_links where token_hash = portal_token_hash and revoked_at is null and (expires_at is null or expires_at > now()) limit 1;
  if link_id is null then return false; end if;
  insert into public.client_portal_messages(portal_link_id, message) values (link_id, trim(client_message));
  return true;
end; $$;

grant execute on function public.client_portal_data(text) to anon, authenticated;
grant execute on function public.client_portal_add_message(text, text) to anon, authenticated;
