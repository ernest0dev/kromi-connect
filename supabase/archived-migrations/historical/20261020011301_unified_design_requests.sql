begin;

create table if not exists public.evento_drive_uploads (
  id uuid primary key default gen_random_uuid(), evento_id uuid not null references public.eventos(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade, carpeta text not null check(carpeta in ('BRIEF','ENTREGABLES')),
  file_name text not null check(length(file_name) between 1 and 180), mime_type text not null,
  file_size bigint not null check(file_size between 1 and 524288000),
  status text not null default 'RESERVING' check(status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING','CANCELLED','EXPIRED')),
  drive_file_id text, expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists evento_drive_uploads_active_idx on public.evento_drive_uploads(evento_id,carpeta,status,expires_at);
alter table public.evento_drive_uploads enable row level security;
revoke all on public.evento_drive_uploads from anon,authenticated;
grant all on public.evento_drive_uploads to service_role;

create or replace function public.request_evento_to_design(p_evento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  select * into e from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
  if e.archivado_en is not null or e.estatus not in ('EN_PLANIFICACION','PROGRAMADO') then raise exception 'Solo se puede solicitar diseño para un evento activo en planificación o programado.'; end if;
  if e.inicio is null or not e.requiere_diseno or cardinality(e.diseno_formatos)=0 or nullif(trim(e.instrucciones_diseno),'') is null or e.fecha_entrega_diseno is null then raise exception 'Completa fecha, formatos, instrucciones y fecha de entrega.'; end if;
  if e.fecha_entrega_diseno < (now() at time zone 'America/Caracas')::date or e.fecha_entrega_diseno > (e.inicio at time zone 'America/Caracas')::date then raise exception 'La fecha de entrega debe ser válida y no superar el día del evento.'; end if;
  if e.diseno_estatus is not null then raise exception 'Este evento ya tiene una solicitud de diseño.'; end if;
  update public.eventos set diseno_estatus='SOLICITADO',diseno_solicitado_en=now(),version=version+1,modificado_en=now(),modificado_por=actor where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":null}'::jsonb,'{"estatus":"SOLICITADO"}'::jsonb,actor);
end; $$;

create or replace function public.retract_evento_design_request(p_evento_id uuid,p_expected_version integer)
returns integer language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  select * into e from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
  if e.version is distinct from p_expected_version then raise exception 'CONFLICTO_VERSION' using errcode='40001'; end if;
  if e.diseno_estatus<>'SOLICITADO' then raise exception 'Solo se puede retirar una solicitud antes de que Design la tome.'; end if;
  update public.eventos set diseno_estatus=null,diseno_solicitado_en=null,version=version+1,modificado_en=now(),modificado_por=actor where id=p_evento_id returning version into p_expected_version;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"SOLICITADO"}'::jsonb,'{"estatus":null}'::jsonb,actor);
  return p_expected_version;
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
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,e.diseno_solicitado_en,e.diseno_iniciado_en,e.diseno_entregado_en,
    e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count
  from public.eventos e where e.diseno_estatus in ('SOLICITADO','EN_DISENO') and e.archivado_en is null and e.estatus<>'CANCELADO'
  order by e.fecha_entrega_diseno,e.diseno_solicitado_en;
end; $$;

create or replace function public.get_design_event_history(p_limit integer default 100,p_offset integer default 0)
returns table(id uuid,nombre text,fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,diseno_entregado_en timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar el historial.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,e.diseno_solicitado_en,e.diseno_entregado_en
  from public.eventos e where e.diseno_estatus in ('ENTREGADO','CANCELADO')
  order by coalesce(e.diseno_entregado_en,e.diseno_solicitado_en) desc nulls last
  limit greatest(1,least(coalesce(p_limit,100),100)) offset greatest(coalesce(p_offset,0),0);
end; $$;

create or replace function public.get_design_event_request(p_evento_id uuid)
returns table(id uuid,nombre text,inicio timestamptz,fin timestamptz,sedes jsonb,diseno_formatos text[],instrucciones_diseno text,
 fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,
 drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text,drive_brief_file_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar solicitudes de diseño.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.inicio,e.fin,
    coalesce((select jsonb_agg(jsonb_build_object('sede_id',s.id,'nombre',s.nombre) order by s.nombre) from public.evento_sedes es join public.inventario_sedes s on s.id=es.sede_id where es.evento_id=e.id),'[]'::jsonb),
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,e.diseno_solicitado_en,e.diseno_iniciado_en,e.diseno_entregado_en,
    e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count
  from public.eventos e where e.id=p_evento_id and e.diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO','CANCELADO');
end; $$;

create or replace function public.design_start_event_request(p_evento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.start')) then raise exception 'No tienes permiso para iniciar solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus<>'SOLICITADO' or e.estatus='CANCELADO' or e.archivado_en is not null then raise exception 'La solicitud fue cancelada o ya no está disponible.'; end if;
  update public.eventos set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),disenador_id=coalesce(disenador_id,actor) where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"SOLICITADO"}'::jsonb,'{"estatus":"EN_DISENO"}'::jsonb,actor);
end; $$;

create or replace function public.design_deliver_event_request(p_evento_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.deliver')) then raise exception 'No tienes permiso para entregar solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus='CANCELADO' or e.estatus='CANCELADO' then raise exception 'La solicitud de diseño fue cancelada.' using errcode='22023'; end if;
  if e.diseno_estatus<>'EN_DISENO' then raise exception 'La solicitud no está en diseño.' using errcode='22023'; end if;
  if not exists(select 1 from public.evento_drive_uploads u where u.evento_id=p_evento_id and u.carpeta='ENTREGABLES' and u.status='COMPLETE') then raise exception 'Carga al menos un entregable en Drive antes de entregar la solicitud.' using errcode='22023'; end if;
  update public.eventos set diseno_estatus='ENTREGADO',diseno_entregado_en=now() where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"EN_DISENO"}'::jsonb,'{"estatus":"ENTREGADO"}'::jsonb,actor);
end; $$;

create or replace function public.guard_event_design_archive()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.archivado_en is null and new.archivado_en is not null and old.diseno_estatus in ('SOLICITADO','EN_DISENO') then raise exception 'Retira o cierra la solicitud de diseño antes de archivar el evento.'; end if;
  if old.estatus is distinct from new.estatus and new.estatus='CANCELADO' and old.diseno_estatus in ('SOLICITADO','EN_DISENO') then
    new.diseno_estatus:='CANCELADO';
    insert into public.evento_historial(evento_id,tipo,anterior,nuevo,motivo,cambiado_por) values(old.id,'DISENO',jsonb_build_object('estatus',old.diseno_estatus),'{"estatus":"CANCELADO"}'::jsonb,new.modificado_por);
  end if;
  return new;
end; $$;
drop trigger if exists guard_event_design_archive on public.eventos;
create trigger guard_event_design_archive before update on public.eventos for each row execute function public.guard_event_design_archive();

revoke all on function public.request_evento_to_design(uuid) from public,anon;
grant execute on function public.request_evento_to_design(uuid) to authenticated;
revoke all on function public.retract_evento_design_request(uuid,integer) from public,anon;
grant execute on function public.retract_evento_design_request(uuid,integer) to authenticated;
revoke all on function public.get_design_event_queue() from public,anon;
grant execute on function public.get_design_event_queue() to authenticated;
revoke all on function public.get_design_event_history(integer,integer) from public,anon;
grant execute on function public.get_design_event_history(integer,integer) to authenticated;
revoke all on function public.get_design_event_request(uuid) from public,anon;
grant execute on function public.get_design_event_request(uuid) to authenticated;
revoke all on function public.design_start_event_request(uuid) from public,anon;
grant execute on function public.design_start_event_request(uuid) to authenticated;
revoke all on function public.design_deliver_event_request(uuid) from public,anon;
grant execute on function public.design_deliver_event_request(uuid) to authenticated;
revoke all on function public.guard_event_design_archive() from public,anon,authenticated;
commit;
