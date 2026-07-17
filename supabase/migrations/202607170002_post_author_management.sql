alter table public.posts
  drop constraint if exists posts_body_check;

alter table public.posts
  add constraint posts_body_check
  check (char_length(btrim(body)) between 1 and 160) not valid;

create policy "posts_author_delete"
  on public.posts
  for delete
  using (author_id = auth.uid());
