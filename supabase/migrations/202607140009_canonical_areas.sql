create temporary table area_merge_map on commit drop as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by
        lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(coalesce(city, '')), '\s+', ' ', 'g')),
        upper(country_code)
      order by created_at, id
    ) as keeper_id,
    row_number() over (
      partition by
        lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(coalesce(city, '')), '\s+', ' ', 'g')),
        upper(country_code)
      order by created_at, id
    ) as position
  from public.areas
)
select id as duplicate_id, keeper_id
from ranked
where position > 1;

insert into public.area_history (
  user_id,
  area_id,
  first_seen_at,
  last_seen_at,
  post_count,
  comment_count,
  connection_count
)
select
  history.user_id,
  merge.keeper_id,
  min(history.first_seen_at),
  max(history.last_seen_at),
  sum(history.post_count),
  sum(history.comment_count),
  sum(history.connection_count)
from public.area_history history
join area_merge_map merge on merge.duplicate_id = history.area_id
group by history.user_id, merge.keeper_id
on conflict (user_id, area_id) do update set
  first_seen_at = least(public.area_history.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(public.area_history.last_seen_at, excluded.last_seen_at),
  post_count = public.area_history.post_count + excluded.post_count,
  comment_count = public.area_history.comment_count + excluded.comment_count,
  connection_count = public.area_history.connection_count + excluded.connection_count;

delete from public.area_history history
using area_merge_map merge
where history.area_id = merge.duplicate_id;

update public.user_locations location
set area_id = merge.keeper_id
from area_merge_map merge
where location.area_id = merge.duplicate_id;

update public.posts post
set area_id = merge.keeper_id
from area_merge_map merge
where post.area_id = merge.duplicate_id;

delete from public.areas area
using area_merge_map merge
where area.id = merge.duplicate_id;

alter table public.areas
  add column canonical_key text generated always as (
    lower(regexp_replace(trim(name), '\s+', ' ', 'g')) || '|' ||
    lower(regexp_replace(trim(coalesce(city, '')), '\s+', ' ', 'g')) || '|' ||
    upper(country_code)
  ) stored;

create unique index areas_canonical_key_idx on public.areas(canonical_key);
