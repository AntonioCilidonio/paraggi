create or replace function public.get_post_detail_for_user(
  post_id_input uuid,
  radius_meters integer default 500
)
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
    select location_position
    from public.latest_trusted_location(auth.uid())
    limit 1
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
  where p.id = post_id_input
    and p.status = 'active'
    and p.expires_at > now()
    and radius_meters in (100, 500, 1000, 5000, 30000, 60000)
    and ST_DWithin(p.position, me.location_position, radius_meters)
    and pr.status = 'active'
    and pr.is_shadow_banned = false
    and not public.are_users_blocked(auth.uid(), p.author_id)
  limit 1;
$$;
