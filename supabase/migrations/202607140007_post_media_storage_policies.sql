update storage.buckets
set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array[
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
where id = 'post-media';

drop policy if exists "post_media_owner_insert" on storage.objects;
create policy "post_media_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "post_media_owner_delete" on storage.objects;
create policy "post_media_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);
