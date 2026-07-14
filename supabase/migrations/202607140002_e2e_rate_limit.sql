create or replace function public.consume_rate_limit(
  key_input text,
  action_input text,
  limit_input integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if limit_input < 1 or window_seconds < 1 then
    raise exception 'invalid_rate_limit_configuration';
  end if;

  insert into public.rate_limits as limits (key, action, window_start, count, updated_at)
  values (key_input, action_input, now(), 1, now())
  on conflict (key) do update
  set action = excluded.action,
      window_start = case
        when limits.window_start < now() - make_interval(secs => window_seconds) then now()
        else limits.window_start
      end,
      count = case
        when limits.window_start < now() - make_interval(secs => window_seconds) then 1
        else limits.count + 1
      end,
      updated_at = now()
  returning count into current_count;

  return current_count <= limit_input;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
