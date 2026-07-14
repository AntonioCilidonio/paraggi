update public.areas
set name = city,
    updated_at = now()
where city is not null
  and (
    name ~* '^\s*[0-9]+[a-z]?\s*$'
    or lower(trim(name)) = 'area vicina'
  );

with ranked_chats as (
  select
    id,
    first_value(id) over (
      partition by least(user_a_id::text, user_b_id::text), greatest(user_a_id::text, user_b_id::text)
      order by last_message_at desc nulls last, updated_at desc, created_at desc
    ) as keeper_id,
    row_number() over (
      partition by least(user_a_id::text, user_b_id::text), greatest(user_a_id::text, user_b_id::text)
      order by last_message_at desc nulls last, updated_at desc, created_at desc
    ) as position
  from public.private_chats
), duplicate_chats as (
  select id, keeper_id from ranked_chats where position > 1
)
update public.private_messages message
set chat_id = duplicate.keeper_id
from duplicate_chats duplicate
where message.chat_id = duplicate.id;

with ranked_chats as (
  select
    id,
    row_number() over (
      partition by least(user_a_id::text, user_b_id::text), greatest(user_a_id::text, user_b_id::text)
      order by last_message_at desc nulls last, updated_at desc, created_at desc
    ) as position
  from public.private_chats
)
delete from public.private_chats chat
using ranked_chats ranked
where chat.id = ranked.id and ranked.position > 1;

alter table public.private_chats
  add column participant_pair text generated always as (
    least(user_a_id::text, user_b_id::text) || ':' || greatest(user_a_id::text, user_b_id::text)
  ) stored;

create unique index private_chats_one_per_pair_idx
  on public.private_chats(participant_pair);

alter table public.profiles
  add column sos_blocked_until timestamptz,
  add column sos_false_alarm_strikes integer not null default 0 check (sos_false_alarm_strikes >= 0);

alter table public.danger_alerts
  add column moderation_status text not null default 'unreviewed'
    check (moderation_status in ('unreviewed', 'confirmed_helpful', 'false_alarm')),
  add column penalty_applied_at timestamptz,
  add column reward_applied_at timestamptz;

create table public.danger_alert_feedback (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.danger_alerts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  verdict text not null check (verdict in ('helpful', 'false_alarm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_id, reporter_id)
);

create index danger_alert_feedback_alert_idx
  on public.danger_alert_feedback(alert_id, verdict);

alter table public.danger_alert_feedback enable row level security;

create or replace function public.adjust_reputation(user_id_input uuid, delta_input integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set reputation_score = greatest(0, reputation_score + delta_input)
  where id = user_id_input
  returning reputation_score;
$$;

revoke all on function public.adjust_reputation(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_reputation(uuid, integer) to service_role;
