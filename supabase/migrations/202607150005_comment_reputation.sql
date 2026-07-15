alter table public.profiles
  alter column reputation_score set default 100,
  drop constraint if exists profiles_reputation_score_check;

update public.profiles set reputation_score = 100;

alter table public.profiles
  add constraint profiles_reputation_score_check
  check (reputation_score between 0 and 100);

create table public.comment_ratings (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null unique references public.comments(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  post_author_id uuid not null references public.profiles(id) on delete cascade,
  comment_author_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (post_author_id <> comment_author_id)
);

create index comment_ratings_comment_author_idx
  on public.comment_ratings(comment_author_id, updated_at desc);

alter table public.comment_ratings enable row level security;

create policy "comment_ratings_participant_read"
  on public.comment_ratings
  for select
  to authenticated
  using (auth.uid() in (post_author_id, comment_author_id));

create or replace function public.adjust_reputation(user_id_input uuid, delta_input integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set reputation_score = least(100, greatest(0, reputation_score + delta_input))
  where id = user_id_input
  returning reputation_score;
$$;

revoke all on function public.adjust_reputation(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_reputation(uuid, integer) to service_role;

create or replace function public.rate_comment(
  comment_id_input uuid,
  rater_id_input uuid,
  rating_input smallint
)
returns table (
  applied_rating smallint,
  reputation_score integer,
  reputation_delta integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment public.comments%rowtype;
  target_post public.posts%rowtype;
  previous_rating smallint;
  score_after integer;
  score_before integer;
  requested_delta integer;
  actual_delta integer;
begin
  if rating_input not in (-1, 1) then
    raise exception 'invalid_comment_rating';
  end if;

  select * into target_comment
  from public.comments
  where id = comment_id_input and status = 'active';
  if not found then raise exception 'comment_not_found'; end if;

  select * into target_post
  from public.posts
  where id = target_comment.post_id;
  if not found then raise exception 'post_not_found'; end if;
  if target_post.author_id <> rater_id_input then raise exception 'comment_rating_not_allowed'; end if;
  if target_comment.author_id = rater_id_input then raise exception 'cannot_rate_own_comment'; end if;

  select rating into previous_rating
  from public.comment_ratings
  where comment_id = comment_id_input
  for update;

  insert into public.comment_ratings (
    comment_id, post_id, post_author_id, comment_author_id, rating
  ) values (
    target_comment.id, target_comment.post_id, target_post.author_id, target_comment.author_id, rating_input
  )
  on conflict (comment_id) do update
  set rating = excluded.rating, updated_at = now();

  requested_delta := rating_input - coalesce(previous_rating, 0);
  select profiles.reputation_score into score_before
  from public.profiles profiles
  where profiles.id = target_comment.author_id
  for update;

  update public.profiles
  set reputation_score = least(100, greatest(0, profiles.reputation_score + requested_delta))
  where profiles.id = target_comment.author_id
  returning profiles.reputation_score into score_after;

  actual_delta := score_after - score_before;
  if actual_delta <> 0 then
    insert into public.reputation_events (user_id, delta, reason)
    values (
      target_comment.author_id,
      actual_delta,
      case when rating_input = 1 then 'comment_helpful' else 'comment_unhelpful' end
    );
  end if;

  return query select rating_input, score_after, actual_delta;
end;
$$;

revoke all on function public.rate_comment(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.rate_comment(uuid, uuid, smallint) to service_role;

comment on table public.comment_ratings is
  'One reputation vote per comment, controlled exclusively by the author of the related post.';
