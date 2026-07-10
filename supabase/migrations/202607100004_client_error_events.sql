create table public.client_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  severity text not null check (severity in ('debug', 'info', 'warning', 'error', 'fatal')),
  source text not null check (char_length(source) between 2 and 80),
  message text not null check (char_length(message) between 1 and 1000),
  stack text,
  context jsonb not null default '{}'::jsonb,
  app_version text,
  platform text,
  device_model text,
  os_version text,
  created_at timestamptz not null default now()
);

create index client_error_events_created_idx on public.client_error_events(created_at desc);
create index client_error_events_user_idx on public.client_error_events(user_id, created_at desc);
create index client_error_events_severity_idx on public.client_error_events(severity, created_at desc);

alter table public.client_error_events enable row level security;

create policy "client_error_events_no_client_read"
on public.client_error_events for select
using (false);
