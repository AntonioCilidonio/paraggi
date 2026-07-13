create index if not exists posts_area_active_idx on public.posts(area_id, status, expires_at desc);

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
      coalesce((count(p.id) * 3 + sum(p.comment_count) + count(cr.id) * 2), 0)::integer as activity_score,
      (round(ST_Distance(a.centroid, me.location_position) / 10) * 10)::integer as distance_meters,
      max(p.created_at) as latest_activity_at
    from public.areas a
    join me on true
    left join active_posts p on p.area_id = a.id
    left join public.connection_requests cr on cr.post_id = p.id
    where radius_meters in (100, 500, 1000, 5000)
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
