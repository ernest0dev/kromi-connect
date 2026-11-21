-- Serialize finalization with publication status transitions using the same lock order.
create or replace function public.finalize_publication_deliverable_upload(
  p_upload_id uuid,
  p_publication_id uuid,
  p_actor_id uuid,
  p_drive_file_id text
)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_publication_status public.estatus_enum;
begin
  -- Match transition_publicacion_status: lock publicaciones before any upload row.
  select publication.estatus
    into v_publication_status
    from public.publicaciones as publication
   where publication.id = p_publication_id
     and publication.deleted_at is null
   for update;

  if not found
     or v_publication_status is distinct from 'EN_DISENO'::public.estatus_enum then
    return;
  end if;

  return query
  update public.publicacion_drive_uploads as upload
     set status = 'COMPLETE',
         drive_file_id = p_drive_file_id,
         completed_at = clock_timestamp(),
         session_uri = null
   where upload.id = p_upload_id
     and upload.publicacion_id = p_publication_id
     and upload.actor_id = p_actor_id
     and upload.carpeta = 'ENTREGABLES'
     and upload.status = 'UPLOADING'
     and upload.expires_at > clock_timestamp()
  returning upload.id;

  return;
end;
$function$;

revoke all on function public.finalize_publication_deliverable_upload(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_publication_deliverable_upload(uuid, uuid, uuid, text) to service_role;
