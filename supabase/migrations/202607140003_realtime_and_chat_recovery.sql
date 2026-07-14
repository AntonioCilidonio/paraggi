do $$
declare
  table_name text;
begin
  foreach table_name in array array['comments', 'private_messages', 'private_chats', 'notifications']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

update public.connection_requests request
set status = 'pending',
    responded_at = null
where request.status = 'accepted'
  and not exists (
    select 1
    from public.private_chats chat
    where chat.connection_request_id = request.id
  );
