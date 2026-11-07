begin;

-- Extend the existing source-specific states without changing the unified DTO.
alter table public.eventos drop constraint if exists eventos_diseno_estatus_check;
alter table public.eventos add constraint eventos_diseno_estatus_check
  check (diseno_estatus is null or diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO','CANCELADO'));

alter table public.pendientes_tienda drop constraint if exists pendientes_tienda_diseno_estatus_check;
alter table public.pendientes_tienda add constraint pendientes_tienda_diseno_estatus_check
  check (diseno_estatus is null or diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO'));

create or replace function public.reserve_evento_brief_upload(
  p_actor_id uuid,p_evento_id uuid,p_file_name text,p_mime_type text,p_file_size bigint
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles pr join public.role_permissions rp on rp.role_code=pr.role_code
    where pr.user_id=p_actor_id and pr.role_code='events' and rp.permission_code='events.schedule.design') then
    raise exception 'No tienes permiso para cargar el brief.' using errcode='42501';
  end if;
  perform 1 from public.eventos where id=p_evento_id and requiere_diseno
    and diseno_estatus is distinct from 'CANCELADO' and estatus in ('EN_PLANIFICACION','PROGRAMADO')
    and archivado_en is null for update;
  if not found then raise exception 'El evento ya no admite archivos de brief.' using errcode='22023'; end if;
  if length(coalesce(p_file_name,'')) not between 1 and 180 then raise exception 'Nombre de archivo no válido.' using errcode='22023'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') then raise exception 'Formato de brief no permitido.' using errcode='22023'; end if;
  if p_file_size<1 or p_file_size>104857600 then raise exception 'Cada archivo de brief admite hasta 100 MB.' using errcode='22023'; end if;
  if (select count(*) from public.evento_drive_uploads where evento_id=p_evento_id and carpeta='BRIEF'
      and status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING') and expires_at>now())>=10 then
    raise exception 'El brief admite hasta 10 archivos.' using errcode='22023';
  end if;
  insert into public.evento_drive_uploads(evento_id,actor_id,carpeta,file_name,mime_type,file_size)
  values(p_evento_id,p_actor_id,'BRIEF',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.request_pendiente_design_correction(p_pendiente_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pendientes_tienda%rowtype; actor uuid := (select auth.uid());
begin
  perform public.internal_require('internal.store-tasks.status.update');
  if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Describe la corrección (hasta 500 caracteres).' using errcode='22023'; end if;
  select * into r from public.pendientes_tienda where id=p_pendiente_id for update;
  if not found or r.diseno_estatus<>'ENTREGADO' or r.estatus in ('CANCELADO','ENTREGADO') or r.archivado_en is not null then
    raise exception 'Solo puedes pedir cambios a una solicitud entregada y activa.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='EN_CORRECCION',modificado_por=actor where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por)
  values(p_pendiente_id,'DISENO','{"estatus":"ENTREGADO"}'::jsonb,'{"estatus":"EN_CORRECCION"}'::jsonb,trim(p_reason),actor);
end; $$;

create or replace function public.request_evento_to_design(p_evento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  select * into e from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
  if e.archivado_en is not null or e.estatus not in ('EN_PLANIFICACION','PROGRAMADO') then raise exception 'Solo se puede solicitar diseño para un evento activo en planificación o programado.'; end if;
  if e.inicio is null or not e.requiere_diseno or cardinality(e.diseno_formatos)=0 or length(trim(coalesce(e.instrucciones_diseno,'')))<10 or e.fecha_entrega_diseno is null then
    raise exception 'Completa fecha, formatos, al menos 10 caracteres de instrucciones y fecha de entrega.';
  end if;
  if e.fecha_entrega_diseno < (now() at time zone 'America/Caracas')::date or e.fecha_entrega_diseno > (e.inicio at time zone 'America/Caracas')::date then
    raise exception 'La fecha de entrega debe ser válida y no superar el día del evento.';
  end if;
  if e.diseno_estatus is not null then raise exception 'Este evento ya tiene una solicitud de diseño.'; end if;
  update public.eventos set diseno_estatus='SOLICITADO',diseno_solicitado_en=now(),version=version+1,modificado_en=now(),modificado_por=actor where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por)
  values(p_evento_id,'DISENO','{"estatus":null}'::jsonb,'{"estatus":"SOLICITADO"}'::jsonb,actor);
end; $$;

create or replace function public.design_reopen_internal_request(p_pendiente_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pendientes_tienda%rowtype; actor uuid := (select auth.uid());
begin
  perform public.internal_require('design.internal.start');
  select * into r from public.pendientes_tienda where id=p_pendiente_id for update;
  if not found or r.diseno_estatus<>'EN_CORRECCION' or r.estatus in ('CANCELADO','ENTREGADO') or r.archivado_en is not null then
    raise exception 'La solicitud no está pendiente de corrección.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),
    disenador_id=coalesce(disenador_id,actor),modificado_por=actor where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO','{"estatus":"EN_CORRECCION"}'::jsonb,'{"estatus":"EN_DISENO"}'::jsonb,actor);
end; $$;

create or replace function public.request_event_design_correction(p_evento_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Describe la corrección (hasta 500 caracteres).' using errcode='22023'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus<>'ENTREGADO' or e.estatus in ('CANCELADO','TERMINADO') or e.archivado_en is not null then
    raise exception 'Solo puedes pedir cambios a una solicitud entregada y activa.' using errcode='22023';
  end if;
  update public.eventos set diseno_estatus='EN_CORRECCION' where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,motivo,cambiado_por)
  values(p_evento_id,'DISENO','{"estatus":"ENTREGADO"}'::jsonb,'{"estatus":"EN_CORRECCION"}'::jsonb,trim(p_reason),actor);
end; $$;

create or replace function public.design_reopen_event_request(p_evento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.start')) then raise exception 'No tienes permiso para reabrir solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus<>'EN_CORRECCION' or e.estatus in ('CANCELADO','TERMINADO') or e.archivado_en is not null then
    raise exception 'La solicitud no está pendiente de corrección.' using errcode='22023';
  end if;
  update public.eventos set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),disenador_id=coalesce(disenador_id,actor) where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por)
  values(p_evento_id,'DISENO','{"estatus":"EN_CORRECCION"}'::jsonb,'{"estatus":"EN_DISENO"}'::jsonb,actor);
end; $$;

create or replace function public.get_design_internal_queue()
returns table(id uuid,titulo text,tipo text,sede_nombre text,cantidad integer,instrucciones_diseno text,
  fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,
  diseno_iniciado_en timestamptz,drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,
    p.diseno_estatus,p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.drive_folder_id,p.drive_brief_folder_id,p.drive_deliverables_folder_id
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
  where p.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') and p.archivado_en is null and p.estatus<>'CANCELADO'
  order by p.fecha_entrega_diseno,p.diseno_solicitado_en;
end; $$;

create or replace function public.get_design_internal_request(p_pendiente_id uuid)
returns table(id uuid,titulo text,tipo text,sede_nombre text,cantidad integer,instrucciones_diseno text,
  fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,
  diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,drive_folder_id text,
  drive_brief_folder_id text,drive_deliverables_folder_id text,creado_en timestamptz,fecha_requerida date,disenador_nombre text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,p.diseno_estatus,
    p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.diseno_entregado_en,p.drive_folder_id,p.drive_brief_folder_id,
    p.drive_deliverables_folder_id,p.creado_en,p.fecha_requerida,pr.full_name
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
    left join public.profiles pr on pr.user_id=p.disenador_id
  where p.id=p_pendiente_id and p.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO','CANCELADO')
    and (p.estatus<>'CANCELADO' or exists(select 1 from public.pendiente_tienda_historial h where h.pendiente_id=p.id and h.tipo='DISENO'));
end; $$;

create or replace function public.get_design_event_queue()
returns table(id uuid,nombre text,inicio timestamptz,fin timestamptz,sedes jsonb,diseno_formatos text[],instrucciones_diseno text,
 fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,
 drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text,drive_brief_file_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar solicitudes de diseño.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.inicio,e.fin,
    coalesce((select jsonb_agg(jsonb_build_object('sede_id',s.id,'nombre',s.nombre) order by s.nombre) from public.evento_sedes es join public.inventario_sedes s on s.id=es.sede_id where es.evento_id=e.id),'[]'::jsonb),
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,e.diseno_solicitado_en,e.diseno_iniciado_en,
    e.diseno_entregado_en,e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count
  from public.eventos e where e.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') and e.archivado_en is null and e.estatus<>'CANCELADO'
  order by e.fecha_entrega_diseno,e.diseno_solicitado_en;
end; $$;

create or replace function public.get_design_event_request(p_evento_id uuid)
returns table(id uuid,nombre text,inicio timestamptz,fin timestamptz,sedes jsonb,diseno_formatos text[],instrucciones_diseno text,
 fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,disenador_nombre text,diseno_solicitado_en timestamptz,diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,
 drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text,drive_brief_file_count integer,creado_en timestamptz,creado_por uuid,estatus text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar solicitudes de diseño.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.inicio,e.fin,
    coalesce((select jsonb_agg(jsonb_build_object('sede_id',s.id,'nombre',s.nombre) order by s.nombre) from public.evento_sedes es join public.inventario_sedes s on s.id=es.sede_id where es.evento_id=e.id),'[]'::jsonb),
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,pr.full_name,e.diseno_solicitado_en,e.diseno_iniciado_en,
    e.diseno_entregado_en,e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count,e.creado_en,e.creado_por,e.estatus::text
  from public.eventos e left join public.profiles pr on pr.user_id=e.disenador_id
  where e.id=p_evento_id and e.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO','CANCELADO');
end; $$;

create or replace function public.save_event_design_config(
  p_evento_id uuid,p_expected_version integer,p_requiere boolean,p_formatos text[],p_instrucciones text,p_fecha date
) returns integer language plpgsql security definer set search_path='' as $$
declare v_event public.eventos%rowtype; v_actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.update');
  select * into v_event from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'El evento no existe.'; end if;
  if v_event.version is distinct from p_expected_version then raise exception 'CONFLICTO_VERSION'; end if;
  if v_event.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO') and
    (v_event.requiere_diseno is distinct from p_requiere or v_event.diseno_formatos is distinct from coalesce(p_formatos,'{}') or
     v_event.instrucciones_diseno is distinct from nullif(trim(p_instrucciones),'') or v_event.fecha_entrega_diseno is distinct from p_fecha) then
    raise exception 'Retira la solicitud de diseño antes de cambiar estos datos.';
  end if;
  if p_requiere then
    if p_formatos is null or cardinality(p_formatos)<1 or not (p_formatos <@ array['DIGITAL','IMPRESION']::text[]) then raise exception 'Selecciona uno o más formatos.'; end if;
    if nullif(trim(p_instrucciones),'') is null or length(p_instrucciones)>4000 then raise exception 'Las instrucciones son obligatorias y admiten hasta 4000 caracteres.'; end if;
    if v_event.inicio is null then raise exception 'Asigna una fecha al evento antes de solicitar diseño.'; end if;
    if p_fecha is null or p_fecha < (now() at time zone 'America/Caracas')::date or p_fecha > (v_event.inicio at time zone 'America/Caracas')::date then raise exception 'La fecha de entrega debe ser hoy o posterior y no superar el día del evento.'; end if;
  end if;
  update public.eventos set requiere_diseno=p_requiere,diseno_formatos=case when p_requiere then p_formatos else '{}' end,
    instrucciones_diseno=case when p_requiere then nullif(trim(p_instrucciones),'') else null end,
    fecha_entrega_diseno=case when p_requiere then p_fecha else null end,
    version=version+1,modificado_en=now(),modificado_por=v_actor where id=p_evento_id returning version into p_expected_version;
  return p_expected_version;
end; $$;

create or replace function public.guard_event_design_archive()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.archivado_en is null and new.archivado_en is not null and old.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') then
    raise exception 'Retira o cierra la solicitud de diseño antes de archivar el evento.';
  end if;
  if old.estatus is distinct from new.estatus and new.estatus='CANCELADO' and old.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') then
    new.diseno_estatus:='CANCELADO';
    insert into public.evento_historial(evento_id,tipo,anterior,nuevo,motivo,cambiado_por)
    values(old.id,'DISENO',jsonb_build_object('estatus',old.diseno_estatus),'{"estatus":"CANCELADO"}'::jsonb,new.modificado_por);
  end if;
  return new;
end; $$;

revoke all on function public.reserve_evento_brief_upload(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_evento_brief_upload(uuid,uuid,text,text,bigint) to service_role;
revoke all on function public.request_evento_to_design(uuid) from public,anon;
grant execute on function public.request_evento_to_design(uuid) to authenticated;
revoke all on function public.request_pendiente_design_correction(uuid,text) from public,anon;
grant execute on function public.request_pendiente_design_correction(uuid,text) to authenticated;
revoke all on function public.design_reopen_internal_request(uuid) from public,anon;
grant execute on function public.design_reopen_internal_request(uuid) to authenticated;
revoke all on function public.request_event_design_correction(uuid,text) from public,anon;
grant execute on function public.request_event_design_correction(uuid,text) to authenticated;
revoke all on function public.design_reopen_event_request(uuid) from public,anon;
grant execute on function public.design_reopen_event_request(uuid) to authenticated;
revoke all on function public.get_design_internal_queue() from public,anon;
grant execute on function public.get_design_internal_queue() to authenticated;
revoke all on function public.get_design_internal_request(uuid) from public,anon;
grant execute on function public.get_design_internal_request(uuid) to authenticated;
revoke all on function public.get_design_event_queue() from public,anon;
grant execute on function public.get_design_event_queue() to authenticated;
revoke all on function public.get_design_event_request(uuid) from public,anon;
grant execute on function public.get_design_event_request(uuid) to authenticated;
revoke all on function public.save_event_design_config(uuid,integer,boolean,text[],text,date) from public,anon;
grant execute on function public.save_event_design_config(uuid,integer,boolean,text[],text,date) to authenticated;

notify pgrst,'reload schema';
commit;
