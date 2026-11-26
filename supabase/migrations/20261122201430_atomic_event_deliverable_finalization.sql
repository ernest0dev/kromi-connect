-- Serialize Event deliverable finalization with cancellation, archive, and delivery.
-- The application must authenticate and authorize the actor before using service_role.
create or replace function public.finalize_evento_deliverable_upload(
  p_upload_id uuid,
  p_evento_id uuid,
  p_actor_id uuid,
  p_drive_file_id text
)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_event public.eventos%rowtype;
begin
  if p_drive_file_id is null or pg_catalog.btrim(p_drive_file_id) = '' then
    raise exception 'El identificador del archivo de Drive no es válido.' using errcode = '22023';
  end if;

  -- Match design_deliver_event_request: lock eventos before inspecting uploads.
  select event.*
    into v_event
    from public.eventos as event
   where event.id = p_evento_id
   for update;

  if not found
     or v_event.diseno_estatus is distinct from 'EN_DISENO'
     or v_event.diseno_iniciado_en is null
     or v_event.estatus = 'CANCELADO'
     or v_event.archivado_en is not null then
    return;
  end if;

  return query
  update public.evento_drive_uploads as upload
     set status = 'COMPLETE',
         drive_file_id = p_drive_file_id,
         completed_at = pg_catalog.clock_timestamp(),
         session_uri = null
   where upload.id = p_upload_id
     and upload.evento_id = p_evento_id
     and upload.actor_id = p_actor_id
     and upload.carpeta = 'ENTREGABLES'
     and upload.status = 'UPLOADING'
     and upload.expires_at > pg_catalog.clock_timestamp()
  returning upload.id;

  return;
end;
$function$;

revoke all on function public.finalize_evento_deliverable_upload(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_evento_deliverable_upload(uuid, uuid, uuid, text) to service_role;

-- Preserve Event cancellation behavior while allowing the finalization RPC to
-- serialize against this trigger's parent-row update. The prior body listed
-- motivo but omitted its value, making cancellation fail for active Design work.
create or replace function public.guard_event_design_archive()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.archivado_en is null and new.archivado_en is not null
     and old.diseno_estatus in ('SOLICITADO', 'EN_DISENO', 'EN_CORRECCION') then
    raise exception 'Retira o cierra la solicitud de diseño antes de archivar el evento.';
  end if;

  if old.estatus is distinct from new.estatus and new.estatus = 'CANCELADO'
     and old.diseno_estatus in ('SOLICITADO', 'EN_DISENO', 'EN_CORRECCION') then
    new.diseno_estatus := 'CANCELADO';
    insert into public.evento_historial(evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    values (
      old.id,
      'DISENO',
      pg_catalog.jsonb_build_object('estatus', old.diseno_estatus),
      pg_catalog.jsonb_build_object('estatus', 'CANCELADO'),
      null,
      new.modificado_por
    );
  end if;

  return new;
end;
$function$;
