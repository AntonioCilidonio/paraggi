alter type public.notification_type add value if not exists 'private_message';

create or replace function public.nearby_users_for_post(post_id_input uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select p.author_id, p.position, pr.search_radius_meters
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = post_id_input
      and p.status = 'active'
      and p.expires_at > now()
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
  select latest.user_id
  from latest
  join public.profiles recipient on recipient.id = latest.user_id
  join target on true
  where latest.user_id <> target.author_id
    and recipient.status = 'active'
    and recipient.is_shadow_banned = false
    and not public.are_users_blocked(target.author_id, latest.user_id)
    and ST_DWithin(
      latest.position,
      target.position,
      least(target.search_radius_meters, recipient.search_radius_meters)
    );
$$;

create or replace function public.get_visible_danger_alert(
  alert_id_input uuid,
  viewer_user_id uuid
)
returns table (
  id uuid,
  author_name text,
  message text,
  latitude double precision,
  longitude double precision,
  accuracy_meters integer,
  radius_meters integer,
  distance_meters integer,
  share_precise_coordinates boolean,
  active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select location_position
    from public.latest_trusted_location(viewer_user_id)
    limit 1
  ),
  visible as (
    select da.*, p.display_name, viewer.location_position as viewer_position
    from public.danger_alerts da
    join public.profiles p on p.id = da.user_id
    left join viewer on true
    where da.id = alert_id_input
      and (
        da.user_id = viewer_user_id
        or exists (
          select 1
          from public.notifications n
          where n.user_id = viewer_user_id
            and n.type = 'danger_alert'
            and n.deep_link = '/danger/' || da.id::text
        )
        or (
          da.active
          and viewer.location_position is not null
          and ST_DWithin(da.position, viewer.location_position, da.radius_meters)
        )
      )
  )
  select
    visible.id,
    visible.display_name,
    visible.message,
    case
      when visible.share_precise_coordinates or visible.user_id = viewer_user_id
        then ST_Y(visible.position::geometry)
      else round(ST_Y(visible.position::geometry)::numeric, 3)::double precision
    end,
    case
      when visible.share_precise_coordinates or visible.user_id = viewer_user_id
        then ST_X(visible.position::geometry)
      else round(ST_X(visible.position::geometry)::numeric, 3)::double precision
    end,
    round(visible.accuracy_meters)::integer,
    visible.radius_meters,
    case
      when visible.viewer_position is null then null
      else round(ST_Distance(visible.position, visible.viewer_position))::integer
    end,
    visible.share_precise_coordinates,
    visible.active,
    visible.created_at
  from visible;
$$;

revoke all on function public.nearby_users_for_post(uuid) from public, anon, authenticated;
revoke all on function public.get_visible_danger_alert(uuid, uuid) from public, anon, authenticated;
grant execute on function public.nearby_users_for_post(uuid) to service_role;
grant execute on function public.get_visible_danger_alert(uuid, uuid) to service_role;
