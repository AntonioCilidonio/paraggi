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
  ), requested_post as (
    select p.*
    from public.posts p
    where p.id = post_id_input
  ), prior_interaction as (
    select exists (
      select 1
      from public.connection_requests request
      where request.post_id = post_id_input
        and (request.requester_id = auth.uid() or request.recipient_id = auth.uid())
    ) or exists (
      select 1
      from public.comments comment
      where comment.post_id = post_id_input
        and comment.author_id = auth.uid()
    ) as allowed
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
    case
      when me.location_position is null then null
      else (round(ST_Distance(p.position, me.location_position) / 10) * 10)::integer
    end as distance_meters,
    p.expires_at,
    p.comment_count,
    pr.reputation_score,
    p.created_at
  from requested_post p
  join public.profiles pr on pr.id = p.author_id
  left join public.areas a on a.id = p.area_id
  left join me on true
  cross join prior_interaction interaction
  where radius_meters in (100, 500, 1000, 5000, 30000, 60000)
    and pr.status = 'active'
    and pr.is_shadow_banned = false
    and not public.are_users_blocked(auth.uid(), p.author_id)
    and (
      p.author_id = auth.uid()
      or interaction.allowed
      or (
        p.status = 'active'
        and p.expires_at > now()
        and me.location_position is not null
        and ST_DWithin(p.position, me.location_position, radius_meters)
      )
    )
  limit 1;
$$;

comment on function public.get_post_detail_for_user(uuid, integer) is
  'Returns nearby active posts and preserves access for authors or users who already interacted with the post.';
