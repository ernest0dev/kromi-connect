begin;

alter table public.evento_drive_uploads add column if not exists session_uri text
  check (session_uri is null or session_uri like 'https://www.googleapis.com/upload/drive/%');

insert into public.app_permissions(code,description) values ('design.requests.upload','Cargar entregables de solicitudes unificadas de diseño') on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_code,permission_code) values ('design','design.requests.upload') on conflict do nothing;

create or replace function public.get_design_publication_request(p_id uuid)
returns setof public.publicaciones language sql stable security definer set search_path='' as $$
  select p.* from public.publicaciones p where p.id=p_id and public.design_can_see_publication(p.id);
$$;

create or replace function public.get_design_publication_timeline(p_id uuid)
returns table(at timestamptz,label text,note text) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.design_can_see_publication(p_id) then raise exception 'No tienes permiso.' using errcode='42501'; end if;
  return query select h.cambiado_en,h.estatus_nuevo::text,h.motivo from public.publicacion_estatus_historial h where h.publicacion_id=p_id order by h.cambiado_en;
end; $$;

create or replace function public.get_design_publication_channels(p_ids uuid[])
returns table(publicacion_id uuid, canal text) language plpgsql stable security definer set search_path='' as $$
begin
  if cardinality(coalesce(p_ids,'{}'::uuid[]))>100 then raise exception 'Demasiadas publicaciones.'; end if;
  return query select pc.publicacion_id,pc.canal::text from public.publicacion_canales pc
  where pc.publicacion_id=any(coalesce(p_ids,'{}'::uuid[])) and public.design_can_see_publication(pc.publicacion_id);
end; $$;

drop function if exists public.get_design_event_request(uuid);
create function public.get_design_event_request(p_evento_id uuid)
returns table(id uuid,nombre text,inicio timestamptz,fin timestamptz,sedes jsonb,diseno_formatos text[],instrucciones_diseno text,
 fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,disenador_nombre text,diseno_solicitado_en timestamptz,diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,
 drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text,drive_brief_file_count integer,creado_en timestamptz,creado_por uuid,estatus text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar solicitudes de diseño.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.inicio,e.fin,
    coalesce((select jsonb_agg(jsonb_build_object('sede_id',s.id,'nombre',s.nombre) order by s.nombre) from public.evento_sedes es join public.inventario_sedes s on s.id=es.sede_id where es.evento_id=e.id),'[]'::jsonb),
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,pr.full_name,e.diseno_solicitado_en,e.diseno_iniciado_en,e.diseno_entregado_en,
    e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count,e.creado_en,e.creado_por,e.estatus::text
  from public.eventos e left join public.profiles pr on pr.user_id=e.disenador_id
  where e.id=p_evento_id and e.diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO','CANCELADO');
end; $$;

drop function if exists public.get_design_internal_request(uuid);
create function public.get_design_internal_request(p_pendiente_id uuid)
returns table(id uuid,titulo text,tipo text,sede_nombre text,cantidad integer,instrucciones_diseno text,
  fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,
  diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,drive_folder_id text,
  drive_brief_folder_id text,drive_deliverables_folder_id text,creado_en timestamptz,fecha_requerida date,
  disenador_nombre text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,
    p.diseno_estatus,p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.diseno_entregado_en,
    p.drive_folder_id,p.drive_brief_folder_id,p.drive_deliverables_folder_id,p.creado_en,p.fecha_requerida,pr.full_name
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
    left join public.profiles pr on pr.user_id=p.disenador_id
  where p.id=p_pendiente_id and p.diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO','CANCELADO')
    and (p.estatus<>'CANCELADO' or exists(select 1 from public.pendiente_tienda_historial h where h.pendiente_id=p.id and h.tipo='DISENO'));
end; $$;

create or replace function public.get_design_internal_timeline(p_id uuid)
returns table(at timestamptz,label text,note text) language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query select h.cambiado_en, coalesce(h.nuevo->>'estatus','Solicitud actualizada'), h.motivo
  from public.pendiente_tienda_historial h where h.pendiente_id=p_id and h.tipo='DISENO' order by h.cambiado_en;
end; $$;

create or replace function public.get_design_event_timeline(p_id uuid)
returns table(at timestamptz,label text,note text) language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso.' using errcode='42501'; end if;
  return query select h.cambiado_en, coalesce(h.nuevo->>'estatus','Solicitud actualizada'), h.motivo
  from public.evento_historial h where h.evento_id=p_id and h.tipo='DISENO' order by h.cambiado_en;
end; $$;

create or replace function public.reserve_evento_deliverable_upload(p_actor_id uuid,p_evento_id uuid,p_file_name text,p_mime_type text,p_file_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles pr join public.role_permissions rp on rp.role_code=pr.role_code where pr.user_id=p_actor_id and pr.role_code='design' and rp.permission_code='design.requests.upload') then raise exception 'No tienes permiso para cargar.' using errcode='42501'; end if;
  perform 1 from public.eventos where id=p_evento_id and diseno_estatus='EN_DISENO' and estatus<>'CANCELADO' and archivado_en is null for update;
  if not found then raise exception 'La solicitud ya no está disponible.' using errcode='22023'; end if;
  if p_file_size<1 or p_file_size>524288000 then raise exception 'Cada entregable admite hasta 500 MB.' using errcode='22023'; end if;
  if (select count(*) from public.evento_drive_uploads where evento_id=p_evento_id and carpeta='ENTREGABLES' and status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING') and expires_at>now())>=20 then raise exception 'Entregables admite hasta 20 archivos.' using errcode='22023'; end if;
  insert into public.evento_drive_uploads(evento_id,actor_id,carpeta,file_name,mime_type,file_size) values(p_evento_id,p_actor_id,'ENTREGABLES',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.sync_evento_drive_brief(p_evento_id uuid,p_drive_folder_id text,p_drive_folder_url text,p_brief_folder_id text,p_deliverables_folder_id text,p_file_count integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo el servidor puede sincronizar Drive.' using errcode='42501'; end if;
  update public.eventos set drive_folder_id=coalesce(p_drive_folder_id,drive_folder_id),drive_folder_url=coalesce(p_drive_folder_url,drive_folder_url),drive_brief_folder_id=coalesce(p_brief_folder_id,drive_brief_folder_id),drive_deliverables_folder_id=coalesce(p_deliverables_folder_id,drive_deliverables_folder_id),drive_brief_file_count=greatest(0,least(coalesce(p_file_count,0),10)) where id=p_evento_id;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
end; $$;

create or replace function public.design_deliver_event_request(p_evento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.deliver')) then raise exception 'No tienes permiso para entregar solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus='CANCELADO' or e.estatus='CANCELADO' or e.archivado_en is not null then raise exception 'La solicitud de diseño fue cancelada o archivada.' using errcode='22023'; end if;
  if e.diseno_estatus<>'EN_DISENO' or e.diseno_iniciado_en is null then raise exception 'La solicitud no está en diseño.' using errcode='22023'; end if;
  if not exists(select 1 from public.evento_drive_uploads u where u.evento_id=p_evento_id and u.carpeta='ENTREGABLES' and u.status='COMPLETE' and u.completed_at>e.diseno_iniciado_en) then raise exception 'Carga al menos un entregable nuevo después de tomar la solicitud.' using errcode='22023'; end if;
  update public.eventos set diseno_estatus='ENTREGADO',diseno_entregado_en=now() where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"EN_DISENO"}'::jsonb,'{"estatus":"ENTREGADO"}'::jsonb,actor);
end; $$;

revoke all on function public.get_design_publication_request(uuid) from public,anon;
grant execute on function public.get_design_publication_request(uuid) to authenticated;
revoke all on function public.get_design_publication_timeline(uuid) from public,anon;
grant execute on function public.get_design_publication_timeline(uuid) to authenticated;
revoke all on function public.get_design_publication_channels(uuid[]) from public,anon;
grant execute on function public.get_design_publication_channels(uuid[]) to authenticated;
revoke all on function public.get_design_event_request(uuid) from public,anon;
grant execute on function public.get_design_event_request(uuid) to authenticated;
revoke all on function public.get_design_internal_request(uuid) from public,anon;
grant execute on function public.get_design_internal_request(uuid) to authenticated;
revoke all on function public.get_design_internal_timeline(uuid) from public,anon;
grant execute on function public.get_design_internal_timeline(uuid) to authenticated;
revoke all on function public.get_design_event_timeline(uuid) from public,anon;
grant execute on function public.get_design_event_timeline(uuid) to authenticated;
revoke all on function public.reserve_evento_deliverable_upload(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_evento_deliverable_upload(uuid,uuid,text,text,bigint) to service_role;
revoke all on function public.sync_evento_drive_brief(uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.sync_evento_drive_brief(uuid,text,text,text,text,integer) to service_role;
revoke all on function public.design_deliver_event_request(uuid) from public,anon;
grant execute on function public.design_deliver_event_request(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
