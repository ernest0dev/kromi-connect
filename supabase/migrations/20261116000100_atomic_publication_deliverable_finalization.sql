-- Atomically finalize a Design deliverable only while its reservation is valid.
-- The caller must authenticate and authorize the actor before using service_role.
create or replace function public.finalize_publication_deliverable_upload(
  p_upload_id uuid,
  p_publication_id uuid,
  p_actor_id uuid,
  p_drive_file_id text
)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.publicacion_drive_uploads
     set status = 'COMPLETE',
         drive_file_id = p_drive_file_id,
         completed_at = clock_timestamp(),
         session_uri = null
   where id = p_upload_id
     and publicacion_id = p_publication_id
     and actor_id = p_actor_id
     and carpeta = 'ENTREGABLES'
     and status = 'UPLOADING'
     and expires_at > clock_timestamp()
  returning id;
$$;

revoke all on function public.finalize_publication_deliverable_upload(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_publication_deliverable_upload(uuid, uuid, uuid, text) to service_role;
