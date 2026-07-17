with ranked_tokens as (
  select
    id,
    row_number() over (
      partition by device_id
      order by updated_at desc, created_at desc, id desc
    ) as token_rank
  from public.push_tokens
  where device_id is not null
    and enabled = true
)
update public.push_tokens token
set enabled = false,
    updated_at = now()
from ranked_tokens ranked
where token.id = ranked.id
  and ranked.token_rank > 1;

create unique index if not exists push_tokens_one_enabled_per_device_idx
  on public.push_tokens(device_id)
  where enabled = true and device_id is not null;
