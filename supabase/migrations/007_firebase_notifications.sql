create table if not exists notification_devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, token text not null unique, platform text not null default 'web', last_seen_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade, reminders_enabled boolean not null default true, case_updates_enabled boolean not null default true, client_messages_enabled boolean not null default true, urgent_enabled boolean not null default true, sound_enabled boolean not null default true, vibration_enabled boolean not null default true, quiet_start time not null default '22:00', quiet_end time not null default '07:00', updated_at timestamptz not null default now()
);
create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, type text not null, title text not null, body text not null, data jsonb not null default '{}'::jsonb, status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'read')), delivery_error text, read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notification_events_user_created_idx on notification_events(user_id, created_at desc);
alter table notification_devices enable row level security;
alter table notification_preferences enable row level security;
alter table notification_events enable row level security;
create policy "notification_devices_own" on notification_devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification_preferences_own" on notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification_events_own" on notification_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
