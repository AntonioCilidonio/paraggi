create index if not exists private_messages_unread_chat_sender_idx
  on public.private_messages(chat_id, sender_id)
  where read_at is null;

create or replace function public.get_chat_unread_counts(for_user_id uuid)
returns table (chat_id uuid, unread_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select message.chat_id, count(*)::integer
  from public.private_messages message
  join public.private_chats chat on chat.id = message.chat_id
  where for_user_id in (chat.user_a_id, chat.user_b_id)
    and message.sender_id <> for_user_id
    and message.read_at is null
  group by message.chat_id;
$$;

revoke all on function public.get_chat_unread_counts(uuid) from public, anon, authenticated;
grant execute on function public.get_chat_unread_counts(uuid) to service_role;

comment on function public.get_chat_unread_counts(uuid) is
  'Returns per-chat unread message counters for one chat participant.';
