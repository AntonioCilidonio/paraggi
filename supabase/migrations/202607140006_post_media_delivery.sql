create or replace function public.get_post_attachments_for_posts(post_ids_input uuid[])
returns table (
  id uuid,
  post_id uuid,
  kind public.post_attachment_kind,
  storage_path text,
  mime_type text,
  duration_seconds integer,
  label text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pa.id,
    pa.post_id,
    pa.kind,
    pa.storage_path,
    pa.mime_type,
    pa.duration_seconds,
    pa.label,
    case when pa.approximate_position is not null then ST_Y(pa.approximate_position::geometry) end,
    case when pa.approximate_position is not null then ST_X(pa.approximate_position::geometry) end,
    pa.created_at
  from public.post_attachments pa
  where pa.post_id = any(post_ids_input)
  order by pa.created_at asc;
$$;

revoke all on function public.get_post_attachments_for_posts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_post_attachments_for_posts(uuid[]) to service_role;
