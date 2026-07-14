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

  select location_position into loc_a from public.latest_trusted_location(chat_row.user_a_id);
  select location_position into loc_b from public.latest_trusted_location(chat_row.user_b_id);

  if loc_a is null or loc_b is null then
    next_status := 'frozen_permission';
    distance_value := null;
  else
    distance_value := round(ST_Distance(loc_a, loc_b))::integer;
    next_status := case
      when distance_value <= chat_row.radius_meters then 'active'::public.private_chat_status
      else 'frozen_distance'::public.private_chat_status
    end;
  end if;

  if chat_row.status is distinct from next_status
    or chat_row.last_distance_meters is distinct from distance_value then
    update public.private_chats
    set status = next_status,
        last_distance_meters = distance_value,
        frozen_at = case when next_status <> 'active' and status = 'active' then now() else frozen_at end,
        reactivated_at = case when next_status = 'active' and status <> 'active' then now() else reactivated_at end,
        last_status_reason = next_status::text
    where id = chat_id_input;
  end if;

  return next_status;
end;
$$;
