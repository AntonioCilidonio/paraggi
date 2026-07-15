alter table public.private_messages
  alter column body set default '',
  add column if not exists attachment_kind text,
  add column if not exists attachment_storage_path text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_duration_seconds integer,
  add column if not exists attachment_label text;

alter table public.private_messages
  drop constraint if exists private_messages_body_check,
  drop constraint if exists private_messages_content_check,
  drop constraint if exists private_messages_attachment_kind_check;

alter table public.private_messages
  add constraint private_messages_attachment_kind_check
    check (attachment_kind is null or attachment_kind in ('image', 'video', 'audio')),
  add constraint private_messages_content_check
    check (
      char_length(trim(body)) between 1 and 2000
      or (
        attachment_kind is not null
        and attachment_storage_path is not null
        and char_length(attachment_storage_path) between 1 and 500
      )
    );

drop policy if exists "private_messages_sender_insert" on public.private_messages;
create policy "private_messages_sender_insert"
on public.private_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.private_chats chat
    where chat.id = chat_id
      and chat.is_connected = true
      and auth.uid() in (chat.user_a_id, chat.user_b_id)
  )
);

create or replace function public.refresh_chat_status(chat_id_input uuid)
returns public.private_chat_status
language plpgsql
security definer
set search_path = public
as $$
declare
  chat_row public.private_chats%rowtype;
begin
  select * into chat_row
  from public.private_chats
  where id = chat_id_input
  for update;

  if not found then
    raise exception 'chat_not_found';
  end if;

  if auth.uid() not in (chat_row.user_a_id, chat_row.user_b_id) then
    raise exception 'not_chat_participant';
  end if;

  if not chat_row.is_connected then
    return chat_row.status;
  end if;

  if chat_row.status is distinct from 'active'::public.private_chat_status
    or chat_row.last_status_reason is distinct from 'connected' then
    update public.private_chats
    set status = 'active',
        last_status_reason = 'connected',
        reactivated_at = coalesce(reactivated_at, now())
    where id = chat_id_input;
  end if;

  return 'active';
end;
$$;

update public.private_chats
set status = 'active',
    last_status_reason = 'connected'
where is_connected = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/x-m4a'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_media_owner_insert" on storage.objects;
create policy "chat_media_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "chat_media_owner_delete" on storage.objects;
create policy "chat_media_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on column public.private_messages.attachment_storage_path is
  'Private object path in chat-media. Clients receive only short-lived signed URLs.';
