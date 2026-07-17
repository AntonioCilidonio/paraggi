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
  previous_applied_delta smallint := 0;
  score_before integer;
  score_after integer;
  step_delta integer := 0;
  new_applied_delta smallint;
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

  select ratings.rating, ratings.applied_delta
  into previous_rating, previous_applied_delta
  from public.comment_ratings ratings
  where ratings.comment_id = comment_id_input
  for update;
  previous_applied_delta := coalesce(previous_applied_delta, 0);

  select profiles.reputation_score into score_before
  from public.profiles profiles
  where profiles.id = target_comment.author_id
  for update;

  -- A first vote or a changed vote moves the current score by one point.
  -- Repeating the same vote is idempotent and cannot farm reputation.
  if previous_rating is null or previous_rating <> rating_input then
    step_delta := rating_input;
  end if;
  score_after := least(100, greatest(0, score_before + step_delta));
  step_delta := score_after - score_before;
  new_applied_delta := least(1, greatest(-1, previous_applied_delta + step_delta))::smallint;

  insert into public.comment_ratings (
    comment_id, post_id, post_author_id, comment_author_id, rating, applied_delta
  ) values (
    target_comment.id, target_comment.post_id, target_post.author_id,
    target_comment.author_id, rating_input, new_applied_delta
  )
  on conflict (comment_id) do update
  set rating = excluded.rating,
      applied_delta = excluded.applied_delta,
      updated_at = now();

  update public.profiles
  set reputation_score = score_after
  where id = target_comment.author_id;

  if step_delta <> 0 then
    insert into public.reputation_events (user_id, delta, reason)
    values (
      target_comment.author_id,
      step_delta,
      case when rating_input = 1 then 'comment_helpful' else 'comment_unhelpful' end
    );
  end if;

  return query select rating_input, score_after, step_delta;
end;
$$;

revoke all on function public.rate_comment(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.rate_comment(uuid, uuid, smallint) to service_role;
