update storage.buckets
set allowed_mime_types = array[
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
  'audio/wav'
]
where id = 'post-media';

create policy "post_media_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "post_media_owner_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.expire_old_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  update public.posts
  set status = 'expired',
      updated_at = now()
  where status = 'active'
    and expires_at <= now();

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;
