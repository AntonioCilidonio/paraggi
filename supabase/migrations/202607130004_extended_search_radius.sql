alter table public.profiles
  drop constraint if exists profiles_search_radius_meters_check,
  add constraint profiles_search_radius_meters_check
    check (search_radius_meters in (100, 500, 1000, 5000, 30000, 60000));

alter table public.private_chats
  drop constraint if exists private_chats_radius_meters_check,
  add constraint private_chats_radius_meters_check
    check (radius_meters in (100, 500, 1000, 5000, 30000, 60000));

alter table public.danger_alerts
  drop constraint if exists danger_alerts_radius_meters_check,
  add constraint danger_alerts_radius_meters_check
    check (radius_meters in (100, 500, 1000, 5000, 30000, 60000));

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
    (round(ST_Distance(p.position, me.location_position) / 10) * 10)::integer as distance_meters,
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
    and radius_meters in (100, 500, 1000, 5000, 30000, 60000)
    and ST_DWithin(p.position, me.location_position, radius_meters)
    and pr.status = 'active'
    and pr.is_shadow_banned = false
    and not public.are_users_blocked(auth.uid(), p.author_id)
  order by p.created_at desc
  limit least(greatest(page_limit, 1), 50);
$$;

create or replace function public.get_heatmap_zones(for_user_id uuid, radius_meters integer default 1000)
returns table (
  id uuid,
  name text,
  city text,
  post_count integer,
  comment_count integer,
  connection_count integer,
  activity_score integer,
  activity_level text,
  distance_meters integer,
  latest_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select location_position
    from public.latest_trusted_location(for_user_id)
    limit 1
  ),
  active_posts as (
    select p.*
    from public.posts p
    where p.status = 'active'
      and p.expires_at > now()
      and p.area_id is not null
  ),
  area_activity as (
    select
      a.id,
      a.name,
      a.city,
      count(p.id)::integer as post_count,
      coalesce(sum(p.comment_count), 0)::integer as comment_count,
      count(cr.id)::integer as connection_count,
      (
        count(p.id) * 3 +
        coalesce(sum(p.comment_count), 0) +
        count(cr.id) * 2
      )::integer as activity_score,
      (round(ST_Distance(a.centroid, me.location_position) / 10) * 10)::integer as distance_meters,
      max(p.created_at) as latest_activity_at
    from public.areas a
    join me on true
    left join active_posts p on p.area_id = a.id
    left join public.connection_requests cr on cr.post_id = p.id
    where radius_meters in (100, 500, 1000, 5000, 30000, 60000)
      and ST_DWithin(a.centroid, me.location_position, radius_meters)
    group by a.id, a.name, a.city, a.centroid, me.location_position
  )
  select
    id,
    name,
    city,
    post_count,
    comment_count,
    connection_count,
    activity_score,
    case
      when activity_score >= 24 then 'high'
      when activity_score >= 8 then 'medium'
      else 'low'
    end as activity_level,
    distance_meters,
    latest_activity_at
  from area_activity
  where activity_score > 0
  order by activity_score desc, distance_meters asc
  limit 12;
$$;
