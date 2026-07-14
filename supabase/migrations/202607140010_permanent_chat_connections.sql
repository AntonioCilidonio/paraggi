alter table public.private_chats
  add column if not exists is_connected boolean not null default true,
  add column if not exists disconnected_at timestamptz,
  add column if not exists disconnected_by_id uuid references public.profiles(id) on delete set null;

create index if not exists private_chats_connected_participants_idx
  on public.private_chats(is_connected, user_a_id, user_b_id, updated_at desc);

with ranked_pending as (
  select
    id,
    row_number() over (
      partition by least(requester_id::text, recipient_id::text), greatest(requester_id::text, recipient_id::text)
      order by created_at desc, id desc
    ) as position
  from public.connection_requests
  where status = 'pending'
)
update public.connection_requests request
set status = 'rejected',
    responded_at = now(),
    updated_at = now()
from ranked_pending ranked
where request.id = ranked.id
  and ranked.position > 1;

drop index if exists public.connection_requests_no_duplicate_pending_idx;

create unique index connection_requests_one_pending_per_pair_idx
  on public.connection_requests(
    least(requester_id::text, recipient_id::text),
    greatest(requester_id::text, recipient_id::text)
  )
  where status = 'pending';

comment on column public.private_chats.is_connected is
  'The accepted relationship persists as one chat per user pair until either participant disconnects it.';
