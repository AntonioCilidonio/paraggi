alter type public.notification_type add value if not exists 'danger_alert';

create type public.post_attachment_kind as enum ('image', 'video', 'audio', 'location');

create table if not exists public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind public.post_attachment_kind not null,
  storage_path text,
  mime_type text,
  duration_seconds integer,
  approximate_position geography(Point, 4326),
  label text,
  created_at timestamptz not null default now(),
  check (
    (kind = 'location' and approximate_position is not null)
    or (kind <> 'location' and storage_path is not null)
  )
);

create table if not exists public.danger_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  position geography(Point, 4326) not null,
  accuracy_meters numeric(8,2),
  radius_meters integer not null default 500 check (radius_meters in (100, 500, 1000, 5000)),
  message text not null default 'Richiesta urgente di aiuto nelle vicinanze',
  share_precise_coordinates boolean not null default true,
  active boolean not null default true,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists post_attachments_post_idx on public.post_attachments(post_id, created_at);
create index if not exists danger_alerts_position_gix on public.danger_alerts using gist (position);
create index if not exists danger_alerts_active_idx on public.danger_alerts(active, created_at desc);

alter table public.post_attachments enable row level security;
alter table public.danger_alerts enable row level security;

create policy "post_attachments_nearby_post_read" on public.post_attachments for select using (
  exists (select 1 from public.posts p where p.id = post_id and p.status = 'active')
);
create policy "post_attachments_author_insert" on public.post_attachments for insert with check (author_id = auth.uid());
create policy "danger_alerts_owner_read" on public.danger_alerts for select using (user_id = auth.uid());
create policy "danger_alerts_owner_insert" on public.danger_alerts for insert with check (user_id = auth.uid());
create policy "danger_alerts_owner_update" on public.danger_alerts for update using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav']
)
on conflict (id) do nothing;

create or replace function public.nearby_users_for_point(
  actor_user_id uuid,
  latitude double precision,
  longitude double precision,
  radius_meters integer
)
returns table (
  user_id uuid,
  display_name text,
  expo_push_token text,
  distance_meters integer
)
language sql
stable
security definer
set search_path = public
as $$
  with point_input as (
    select ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography as position
  ),
  latest as (
    select distinct on (ul.user_id)
      ul.user_id,
      ul.position
    from public.user_locations ul
    where ul.captured_at > now() - interval '15 minutes'
      and ul.trust_status in ('trusted', 'uncertain')
    order by ul.user_id, ul.captured_at desc
  )
  select
    latest.user_id,
    p.display_name,
    pt.expo_push_token,
    round(ST_Distance(latest.position, point_input.position))::integer as distance_meters
  from latest
  join point_input on true
  join public.profiles p on p.id = latest.user_id
  left join public.push_tokens pt on pt.user_id = latest.user_id and pt.enabled = true
  where latest.user_id <> actor_user_id
    and p.status = 'active'
    and ST_DWithin(latest.position, point_input.position, radius_meters);
$$;
