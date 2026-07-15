create table public.test_personas (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  persona_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id <> persona_id)
);

alter table public.test_personas enable row level security;
revoke all on public.test_personas from public, anon, authenticated;
grant all on public.test_personas to service_role;

create trigger test_personas_touch_updated_at
before update on public.test_personas
for each row execute function public.touch_updated_at();

-- Older self-tests created a fresh auth identity named "Marta Test" on every
-- run. Keep the most recently used persona for each real account and remove
-- only the redundant synthetic profiles. Cascades intentionally discard their
-- disposable test conversations while leaving every real profile untouched.
with synthetic_links as (
  select
    case when test_profile.id = chat.user_a_id then chat.user_b_id else chat.user_a_id end as owner_id,
    test_profile.id as persona_id,
    chat.updated_at,
    row_number() over (
      partition by case when test_profile.id = chat.user_a_id then chat.user_b_id else chat.user_a_id end
      order by chat.updated_at desc, chat.created_at desc, test_profile.id
    ) as position
  from public.private_chats chat
  join public.profiles test_profile on test_profile.id in (chat.user_a_id, chat.user_b_id)
  join auth.users test_user on test_user.id = test_profile.id
  join auth.users owner_user on owner_user.id = case
    when test_profile.id = chat.user_a_id then chat.user_b_id
    else chat.user_a_id
  end
  where (
      test_user.email like 'paraggi-test-%@paraggi.local'
      or test_user.email like 'paraggi-scenario-%@paraggi.local'
    )
    and coalesce(owner_user.email, '') not like 'paraggi-test-%@paraggi.local'
    and coalesce(owner_user.email, '') not like 'paraggi-scenario-%@paraggi.local'
), canonical_personas as (
  select distinct on (owner_id) owner_id, persona_id
  from synthetic_links
  where position = 1
  order by owner_id, persona_id
)
insert into public.test_personas(owner_id, persona_id)
select owner_id, persona_id from canonical_personas
on conflict (owner_id) do update
set persona_id = excluded.persona_id,
    updated_at = now();

with synthetic_links as (
  select
    case when test_profile.id = chat.user_a_id then chat.user_b_id else chat.user_a_id end as owner_id,
    test_profile.id as persona_id,
    chat.updated_at,
    row_number() over (
      partition by case when test_profile.id = chat.user_a_id then chat.user_b_id else chat.user_a_id end
      order by chat.updated_at desc, chat.created_at desc, test_profile.id
    ) as position
  from public.private_chats chat
  join public.profiles test_profile on test_profile.id in (chat.user_a_id, chat.user_b_id)
  join auth.users test_user on test_user.id = test_profile.id
  join auth.users owner_user on owner_user.id = case
    when test_profile.id = chat.user_a_id then chat.user_b_id
    else chat.user_a_id
  end
  where (
      test_user.email like 'paraggi-test-%@paraggi.local'
      or test_user.email like 'paraggi-scenario-%@paraggi.local'
    )
    and coalesce(owner_user.email, '') not like 'paraggi-test-%@paraggi.local'
    and coalesce(owner_user.email, '') not like 'paraggi-scenario-%@paraggi.local'
), duplicate_personas as (
  select distinct persona_id
  from synthetic_links
  where position > 1
)
delete from public.profiles profile
using duplicate_personas duplicate
where profile.id = duplicate.persona_id;

comment on table public.test_personas is
  'Internal service-role mapping that reuses one synthetic test neighbor per real account.';
