create extension if not exists postgis;
create extension if not exists pgcrypto;

create type public.profile_status as enum ('active', 'limited', 'suspended', 'deleted');
create type public.location_trust_status as enum ('trusted', 'uncertain', 'suspicious', 'blocked');
create type public.post_category as enum ('question', 'information', 'lost_item', 'help', 'event', 'social', 'emergency');
create type public.post_status as enum ('active', 'expired', 'removed', 'shadow_hidden');
create type public.connection_request_status as enum ('pending', 'accepted', 'rejected', 'expired', 'cancelled', 'blocked');
create type public.private_chat_status as enum ('active', 'frozen_distance', 'frozen_permission', 'frozen_moderation', 'closed');
create type public.notification_type as enum ('comment_received', 'private_request', 'request_accepted', 'chat_reactivated', 'nearby_again', 'nearby_relevant_post');
create type public.report_target_type as enum ('user', 'post', 'comment', 'message');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.audit_event_type as enum ('auth', 'location', 'post', 'comment', 'connection', 'chat', 'moderation', 'privacy', 'security', 'system');
create type public.device_platform as enum ('ios', 'android', 'web');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_path text,
  locale text not null default 'it',
  status public.profile_status not null default 'active',
  is_shadow_banned boolean not null default false,
  reputation_score integer not null default 0 check (reputation_score >= 0),
  home_area_label text,
  search_radius_meters integer not null default 500 check (search_radius_meters in (100, 500, 1000, 5000)),
  location_consent_at timestamptz,
  notification_consent_at timestamptz,
  analytics_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform public.device_platform not null,
  installation_id text not null,
  app_version text,
  os_version text,
  is_emulator boolean not null default false,
  is_rooted_or_jailbroken boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  expo_push_token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country_code text not null default 'IT',
  place_label text,
  centroid geography(Point, 4326) not null,
  boundary geometry(MultiPolygon, 4326),
  geohash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  position geography(Point, 4326) not null,
  accuracy_meters numeric(8,2) not null check (accuracy_meters >= 0),
  altitude_meters numeric(9,2),
  speed_mps numeric(8,2),
  heading_degrees numeric(6,2),
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  trust_score integer not null default 50 check (trust_score between 0 and 100),
  trust_status public.location_trust_status not null default 'uncertain',
  anomaly_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.areas(id) on delete set null,
  category public.post_category not null,
  body text not null check (char_length(body) between 1 and 1000),
  position geography(Point, 4326) not null,
  status public.post_status not null default 'active',
  expires_at timestamptz not null,
  comment_count integer not null default 0 check (comment_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '24 hours')
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 700),
  status public.post_status not null default 'active',
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete set null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status public.connection_request_status not null default 'pending',
  message text check (message is null or char_length(message) <= 240),
  expires_at timestamptz not null default now() + interval '24 hours',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

create table public.private_chats (
  id uuid primary key default gen_random_uuid(),
  connection_request_id uuid not null unique references public.connection_requests(id) on delete cascade,
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  status public.private_chat_status not null default 'active',
  radius_meters integer not null default 500 check (radius_meters in (100, 500, 1000, 5000)),
  last_distance_meters integer,
  last_status_reason text,
  last_message_at timestamptz,
  reactivated_at timestamptz,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a_id <> user_b_id)
);

create table public.private_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.private_chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  deep_link text,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text,
  delta integer not null default 0,
  reason text not null,
  area_id uuid references public.areas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null,
  awarded_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, badge)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 80),
  details text not null default '' check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.area_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  post_count integer not null default 0,
  comment_count integer not null default 0,
  connection_count integer not null default 0,
  unique (user_id, area_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type public.audit_event_type not null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index profiles_status_idx on public.profiles(status);
create index devices_user_id_idx on public.devices(user_id);
create index push_tokens_user_id_idx on public.push_tokens(user_id) where enabled;
create index areas_centroid_gix on public.areas using gist (centroid);
create index user_locations_user_recent_idx on public.user_locations(user_id, captured_at desc);
create index user_locations_position_gix on public.user_locations using gist (position);
create index posts_position_gix on public.posts using gist (position);
create index posts_active_time_idx on public.posts(status, expires_at desc, created_at desc);
create index posts_author_idx on public.posts(author_id, created_at desc);
create index comments_post_idx on public.comments(post_id, created_at asc);
create index connection_requests_recipient_idx on public.connection_requests(recipient_id, status, created_at desc);
create index connection_requests_requester_idx on public.connection_requests(requester_id, status, created_at desc);
create unique index connection_requests_no_duplicate_pending_idx
  on public.connection_requests(post_id, requester_id, recipient_id)
  where status = 'pending';
create index private_chats_user_a_idx on public.private_chats(user_a_id, status);
create index private_chats_user_b_idx on public.private_chats(user_b_id, status);
create index private_messages_chat_idx on public.private_messages(chat_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index reports_target_idx on public.reports(target_type, target_id);
create index area_history_user_idx on public.area_history(user_id, last_seen_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger areas_touch_updated_at before update on public.areas for each row execute function public.touch_updated_at();
create trigger posts_touch_updated_at before update on public.posts for each row execute function public.touch_updated_at();
create trigger comments_touch_updated_at before update on public.comments for each row execute function public.touch_updated_at();
create trigger connection_requests_touch_updated_at before update on public.connection_requests for each row execute function public.touch_updated_at();
create trigger private_chats_touch_updated_at before update on public.private_chats for each row execute function public.touch_updated_at();
create trigger push_tokens_touch_updated_at before update on public.push_tokens for each row execute function public.touch_updated_at();
create trigger reports_touch_updated_at before update on public.reports for each row execute function public.touch_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.are_users_blocked(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = left_user_id and blocked_id = right_user_id)
       or (blocker_id = right_user_id and blocked_id = left_user_id)
  );
$$;

create or replace function public.latest_trusted_location(for_user_id uuid)
returns table (
  location_id uuid,
  position geography(Point, 4326),
  area_id uuid,
  captured_at timestamptz,
  trust_score integer,
  trust_status public.location_trust_status
)
language sql
stable
security definer
set search_path = public
as $$
  select id, position, area_id, captured_at, trust_score, trust_status
  from public.user_locations
  where user_id = for_user_id
    and captured_at > now() - interval '15 minutes'
    and trust_status in ('trusted', 'uncertain')
  order by captured_at desc
  limit 1;
$$;

create or replace function public.get_nearby_posts(radius_meters integer, page_limit integer default 30)
returns table (
  id uuid,
  author_id uuid,
  display_name text,
  avatar_path text,
  category public.post_category,
  body text,
  area_name text,
  city text,
  distance_meters integer,
  expires_at timestamptz,
  comment_count integer,
  reputation_score integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select * from public.latest_trusted_location(auth.uid())
  )
  select
    p.id,
    p.author_id,
    pr.display_name,
    pr.avatar_path,
    p.category,
    p.body,
    a.name as area_name,
    a.city,
    (round(ST_Distance(p.position, me.position) / 10) * 10)::integer as distance_meters,
    p.expires_at,
    p.comment_count,
    pr.reputation_score,
    p.created_at
  from public.posts p
  join me on true
  join public.profiles pr on pr.id = p.author_id
  left join public.areas a on a.id = p.area_id
  where p.status = 'active'
    and p.expires_at > now()
    and radius_meters in (100, 500, 1000, 5000)
    and ST_DWithin(p.position, me.position, radius_meters)
    and pr.status = 'active'
    and pr.is_shadow_banned = false
    and not public.are_users_blocked(auth.uid(), p.author_id)
  order by p.created_at desc
  limit least(greatest(page_limit, 1), 50);
$$;

create or replace function public.refresh_chat_status(chat_id_input uuid)
returns public.private_chat_status
language plpgsql
security definer
set search_path = public
as $$
declare
  chat_row public.private_chats%rowtype;
  loc_a geography(Point, 4326);
  loc_b geography(Point, 4326);
  distance_value integer;
  next_status public.private_chat_status;
begin
  select * into chat_row from public.private_chats where id = chat_id_input for update;
  if not found then
    raise exception 'chat_not_found';
  end if;

  if auth.uid() not in (chat_row.user_a_id, chat_row.user_b_id) then
    raise exception 'not_chat_participant';
  end if;

  if chat_row.status = 'closed' then
    return 'closed';
  end if;

  select position into loc_a from public.latest_trusted_location(chat_row.user_a_id);
  select position into loc_b from public.latest_trusted_location(chat_row.user_b_id);

  if loc_a is null or loc_b is null then
    next_status := 'frozen_permission';
    distance_value := null;
  else
    distance_value := round(ST_Distance(loc_a, loc_b))::integer;
    next_status := case when distance_value <= chat_row.radius_meters then 'active'::public.private_chat_status else 'frozen_distance'::public.private_chat_status end;
  end if;

  update public.private_chats
  set status = next_status,
      last_distance_meters = distance_value,
      frozen_at = case when next_status <> 'active' and status = 'active' then now() else frozen_at end,
      reactivated_at = case when next_status = 'active' and status <> 'active' then now() else reactivated_at end,
      last_status_reason = next_status::text
  where id = chat_id_input;

  return next_status;
end;
$$;

create or replace function public.increment_post_comment_count()
returns trigger
language plpgsql
as $$
begin
  update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  return new;
end;
$$;

create trigger comments_increment_post_count after insert on public.comments for each row execute function public.increment_post_comment_count();

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.push_tokens enable row level security;
alter table public.areas enable row level security;
alter table public.user_locations enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.connection_requests enable row level security;
alter table public.private_chats enable row level security;
alter table public.private_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reputation_events enable row level security;
alter table public.user_badges enable row level security;
alter table public.reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.area_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

create policy "profiles_read_active" on public.profiles for select using (status = 'active' or id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "devices_owner_all" on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_tokens_owner_all" on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "areas_authenticated_read" on public.areas for select to authenticated using (true);

create policy "locations_owner_insert" on public.user_locations for insert with check (user_id = auth.uid());
create policy "locations_owner_read" on public.user_locations for select using (user_id = auth.uid());

create policy "posts_author_read" on public.posts for select using (author_id = auth.uid());
create policy "posts_author_insert" on public.posts for insert with check (author_id = auth.uid());
create policy "posts_author_update" on public.posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "comments_author_read" on public.comments for select using (author_id = auth.uid());
create policy "comments_post_author_read" on public.comments for select using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "comments_author_insert" on public.comments for insert with check (author_id = auth.uid());
create policy "comments_author_update" on public.comments for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "connection_requests_participants_read" on public.connection_requests for select using (requester_id = auth.uid() or recipient_id = auth.uid());
create policy "connection_requests_requester_insert" on public.connection_requests for insert with check (requester_id = auth.uid());
create policy "connection_requests_participants_update" on public.connection_requests for update using (requester_id = auth.uid() or recipient_id = auth.uid());

create policy "private_chats_participants_read" on public.private_chats for select using (user_a_id = auth.uid() or user_b_id = auth.uid());
create policy "private_messages_participants_read" on public.private_messages for select using (
  exists (select 1 from public.private_chats c where c.id = chat_id and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid()))
);
create policy "private_messages_sender_insert" on public.private_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.private_chats c where c.id = chat_id and c.status = 'active' and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid()))
);

create policy "notifications_owner_read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications_owner_update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "reputation_public_read" on public.reputation_events for select using (true);
create policy "badges_public_read" on public.user_badges for select using (revoked_at is null);

create policy "reports_reporter_insert" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_reporter_read" on public.reports for select using (reporter_id = auth.uid());

create policy "blocks_owner_all" on public.user_blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "area_history_owner_read" on public.area_history for select using (user_id = auth.uid());
create policy "audit_no_client_read" on public.audit_logs for select using (false);
create policy "rate_limits_no_client_access" on public.rate_limits for all using (false) with check (false);
