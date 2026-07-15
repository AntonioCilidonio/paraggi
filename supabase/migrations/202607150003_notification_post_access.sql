create index if not exists notifications_user_deep_link_idx
  on public.notifications(user_id, deep_link)
  where deep_link is not null;

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
    select post.*
    from public.posts post
    where post.id = post_id_input
  ), prior_access as (
    select
      exists (
        select 1
        from public.connection_requests request
        where request.post_id = post_id_input
          and auth.uid() in (request.requester_id, request.recipient_id)
      )
      or exists (
        select 1
        from public.comments comment
        where comment.post_id = post_id_input
          and comment.author_id = auth.uid()
      )
      or exists (
        select 1
        from public.notifications notification
        where notification.user_id = auth.uid()
          and notification.deep_link = '/post/' || post_id_input::text
          and notification.type in ('comment_received', 'nearby_relevant_post')
      ) as allowed
  )
  select
    post.id,
    post.author_id,
    profile.display_name,
    profile.avatar_path,
    post.category,
    post.body,
    area.name as area_name,
    area.city,
    case
      when me.location_position is null then null
      else (round(ST_Distance(post.position, me.location_position) / 10) * 10)::integer
    end as distance_meters,
    post.expires_at,
    post.comment_count,
    profile.reputation_score,
    post.created_at
  from requested_post post
  join public.profiles profile on profile.id = post.author_id
  left join public.areas area on area.id = post.area_id
  left join me on true
  cross join prior_access access
  where radius_meters in (100, 500, 1000, 5000, 30000, 60000)
    and profile.status = 'active'
    and profile.is_shadow_banned = false
    and not public.are_users_blocked(auth.uid(), post.author_id)
    and (
      post.author_id = auth.uid()
      or access.allowed
      or (
        post.status = 'active'
        and post.expires_at > now()
        and me.location_position is not null
        and ST_DWithin(post.position, me.location_position, radius_meters)
      )
    )
  limit 1;
$$;

comment on function public.get_post_detail_for_user(uuid, integer) is
  'Returns nearby posts and preserves scoped access for authors, participants, and notification recipients.';
