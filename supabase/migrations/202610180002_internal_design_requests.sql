-- Drive briefs and separate Design queue for Internal tasks. Apply manually after 202610180001.
begin;

create table if not exists public.pendiente_drive_uploads (
  id uuid primary key default gen_random_uuid(),
  pendiente_id uuid not null references public.pendientes_tienda(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  carpeta text not null check (carpeta in ('BRIEF','ENTREGABLES')),
  file_name text not null check (length(file_name) between 1 and 180),
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 524288000),
  session_uri text check (session_uri is null or session_uri ~ '^https://www.googleapis.com/upload/drive/'),
  status text not null default 'RESERVING' check (status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING','CANCELLED','EXPIRED')),
  drive_file_id text,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists pendiente_drive_uploads_active_idx
on public.pendiente_drive_uploads(pendiente_id,carpeta,status,expires_at);
alter table public.pendiente_drive_uploads enable row level security;
revoke all on public.pendiente_drive_uploads from anon,authenticated;
grant all on public.pendiente_drive_uploads to service_role;

insert into public.app_permissions(code,description) values
('design.internal.read','Consultar solicitudes del rol Interno'),
('design.internal.start','Tomar solicitudes del rol Interno'),
('design.internal.upload','Cargar entregables de solicitudes del Interno'),
('design.internal.deliver','Entregar solicitudes del Interno')
on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_code,permission_code)
select 'design',code from public.app_permissions where code like 'design.internal.%'
on conflict do nothing;

create or replace function public.sync_pendiente_drive_brief(
  p_pendiente_id uuid,p_brief_folder_id text,p_deliverables_folder_id text,p_file_count integer
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede sincronizar Drive.' using errcode='42501'; end if;
  update public.pendientes_tienda set drive_brief_folder_id=p_brief_folder_id,
    drive_deliverables_folder_id=coalesce(p_deliverables_folder_id,drive_deliverables_folder_id),
    drive_brief_file_count=greatest(0,least(coalesce(p_file_count,0),10)),drive_brief_checked_at=now()
  where id=p_pendiente_id;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
end;
$$;

create or replace function public.reserve_pendiente_brief_upload(
  p_actor_id uuid,p_pendiente_id uuid,p_file_name text,p_mime_type text,p_file_size bigint
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p join public.role_permissions r on r.role_code=p.role_code
    where p.user_id=p_actor_id and p.role_code='internal' and r.permission_code='internal.store-tasks.update')
    or not exists(select 1 from public.pendientes_tienda where id=p_pendiente_id and creado_por=p_actor_id) then
    raise exception 'No tienes autorización para este brief.' using errcode='42501';
  end if;
  perform 1 from public.pendientes_tienda where id=p_pendiente_id and creado_por=p_actor_id for update;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') or p_file_size>104857600 then
    raise exception 'Tipo o tamaño de archivo no permitido.' using errcode='22023';
  end if;
  if (select drive_brief_file_count from public.pendientes_tienda where id=p_pendiente_id)
    + (select count(*) from public.pendiente_drive_uploads where pendiente_id=p_pendiente_id and carpeta='BRIEF'
       and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at>now()) >= 10 then
    raise exception 'El brief admite hasta 10 archivos.' using errcode='22023';
  end if;
  insert into public.pendiente_drive_uploads(pendiente_id,actor_id,carpeta,file_name,mime_type,file_size)
  values(p_pendiente_id,p_actor_id,'BRIEF',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.reserve_pendiente_deliverable_upload(
  p_actor_id uuid,p_pendiente_id uuid,p_file_name text,p_mime_type text,p_file_size bigint
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p join public.role_permissions r on r.role_code=p.role_code
    where p.user_id=p_actor_id and p.role_code='design' and r.permission_code='design.internal.upload')
    or not exists(select 1 from public.pendientes_tienda where id=p_pendiente_id and diseno_estatus='EN_DISENO') then
    raise exception 'No tienes autorización para cargar entregables.' using errcode='42501';
  end if;
  perform 1 from public.pendientes_tienda where id=p_pendiente_id and diseno_estatus='EN_DISENO' for update;
  if p_file_size>524288000 then raise exception 'Cada entregable admite hasta 500 MB.' using errcode='22023'; end if;
  if (select count(*) from public.pendiente_drive_uploads where pendiente_id=p_pendiente_id and carpeta='ENTREGABLES'
    and status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING') and expires_at>now())>=20 then
    raise exception 'Entregables admite hasta 20 archivos.' using errcode='22023';
  end if;
  insert into public.pendiente_drive_uploads(pendiente_id,actor_id,carpeta,file_name,mime_type,file_size)
  values(p_pendiente_id,p_actor_id,'ENTREGABLES',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.request_pendiente_to_design(p_pendiente_id uuid,p_actor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pendientes_tienda%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede verificar Drive.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p join public.role_permissions rp on rp.role_code=p.role_code
    where p.user_id=p_actor_id and p.role_code='internal' and rp.permission_code='internal.store-tasks.status.update') then
    raise exception 'No tienes permiso para solicitar diseño.' using errcode='42501';
  end if;
  select * into r from public.pendientes_tienda where id=p_pendiente_id and creado_por=p_actor_id for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if r.estatus<>'PENDIENTE' then raise exception 'Para solicitar diseño, el pendiente debe estar en estado PENDIENTE.' using errcode='22023'; end if;
  if r.diseno_estatus is not null then raise exception 'Retira la solicitud anterior antes de volver a solicitar.' using errcode='22023'; end if;
  if not r.requiere_diseno or nullif(trim(r.instrucciones_diseno),'') is null or r.fecha_entrega_diseno is null
    or r.fecha_entrega_diseno < (now() at time zone 'America/Caracas')::date then
    raise exception 'Completa las instrucciones y una fecha de entrega válida.' using errcode='22023';
  end if;
  if r.drive_brief_file_count<1 or r.drive_brief_checked_at is null or r.drive_brief_checked_at<now()-interval '5 minutes' then
    raise exception 'Verifica en Drive al menos un archivo del brief antes de solicitar.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='SOLICITADO',diseno_solicitado_en=now(),estatus='EN_PROCESO',modificado_por=p_actor_id
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'ESTATUS',jsonb_build_object('estatus','PENDIENTE'),jsonb_build_object('estatus','EN_PROCESO'),p_actor_id);
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus',null),jsonb_build_object('estatus','SOLICITADO'),p_actor_id);
end;
$$;

create or replace function public.retract_pendiente_design_request(p_pendiente_id uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.status.update');
  select * into r from public.pendientes_tienda where id=p_pendiente_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if r.version<>p_version then raise exception 'CONFLICTO_VERSION' using errcode='40001'; end if;
  if r.diseno_estatus<>'SOLICITADO' then raise exception 'Solo puedes retirar una solicitud antes de que Design la tome.' using errcode='22023'; end if;
  update public.pendientes_tienda set diseno_estatus=null,diseno_solicitado_en=null,estatus='PENDIENTE',modificado_por=(select auth.uid())
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','SOLICITADO'),jsonb_build_object('estatus',null),(select auth.uid()));
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'ESTATUS',jsonb_build_object('estatus',r.estatus),jsonb_build_object('estatus','PENDIENTE'),(select auth.uid()));
end;
$$;

create or replace function public.get_design_internal_queue()
returns table(id uuid,titulo text,tipo text,sede_nombre text,cantidad integer,instrucciones_diseno text,
  fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,
  diseno_iniciado_en timestamptz,drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,
    p.diseno_estatus,p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.drive_folder_id,
    p.drive_brief_folder_id,p.drive_deliverables_folder_id
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
  where p.diseno_estatus in ('SOLICITADO','EN_DISENO') and p.archivado_en is null and p.estatus<>'CANCELADO'
  order by p.fecha_entrega_diseno,p.diseno_solicitado_en;
end;
$$;

create or replace function public.get_design_internal_request(p_pendiente_id uuid)
returns table(id uuid,titulo text,tipo text,sede_nombre text,cantidad integer,instrucciones_diseno text,
  fecha_entrega_diseno date,diseno_estatus text,disenador_id uuid,diseno_solicitado_en timestamptz,
  diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,drive_folder_id text,
  drive_brief_folder_id text,drive_deliverables_folder_id text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,
    p.diseno_estatus,p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.diseno_entregado_en,
    p.drive_folder_id,p.drive_brief_folder_id,p.drive_deliverables_folder_id
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
  where p.id=p_pendiente_id and p.diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO')
    and p.estatus<>'CANCELADO' and p.archivado_en is null;
end;
$$;

create or replace function public.get_design_internal_history(p_limit integer default 50,p_offset integer default 0)
returns table(id uuid,titulo text,tipo text,sede_nombre text,diseno_estatus text,estatus_pendiente text,
  disenador_id uuid,diseno_solicitado_en timestamptz,diseno_entregado_en timestamptz,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.read');
  return query with f as (
    select p.id,p.titulo,p.tipo,s.nombre as store_name,p.diseno_estatus,p.estatus as task_status,
      p.disenador_id,p.diseno_solicitado_en,p.diseno_entregado_en
    from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
    where p.diseno_estatus='ENTREGADO' or (p.estatus='CANCELADO' and exists (
      select 1 from public.pendiente_tienda_historial h where h.pendiente_id=p.id and h.tipo='DISENO'
    ))
  ) select f.id,f.titulo,f.tipo,f.store_name,f.diseno_estatus,f.task_status,f.disenador_id,
    f.diseno_solicitado_en,f.diseno_entregado_en,count(*) over() from f
  order by f.diseno_entregado_en desc nulls last limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
end;
$$;

create or replace function public.get_pendiente_designer_names(p_ids uuid[])
returns table(user_id uuid,full_name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (select public.has_permission('internal.store-tasks.read'))
    and not (select public.has_permission('design.internal.read')) then
    raise exception 'No tienes permiso para consultar diseñadores.' using errcode='42501';
  end if;
  return query select p.user_id,p.full_name from public.profiles p
    where p.user_id=any(p_ids) and p.user_id in (select distinct t.disenador_id from public.pendientes_tienda t where t.disenador_id=any(p_ids));
end;
$$;

create or replace function public.design_start_internal_request(p_pendiente_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('design.internal.start');
  select * into r from public.pendientes_tienda where id=p_pendiente_id for update;
  if not found or r.diseno_estatus<>'SOLICITADO' or r.estatus='CANCELADO' or r.archivado_en is not null then raise exception 'La solicitud ya no está disponible.' using errcode='22023'; end if;
  update public.pendientes_tienda set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),
    disenador_id=coalesce(disenador_id,(select auth.uid())),modificado_por=(select auth.uid()) where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','SOLICITADO'),jsonb_build_object('estatus','EN_DISENO'),(select auth.uid()));
end;
$$;

create or replace function public.design_deliver_internal_request(p_pendiente_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.internal_require('design.internal.deliver');
  if not exists(select 1 from public.pendientes_tienda where id=p_pendiente_id and diseno_estatus='EN_DISENO' and estatus<>'CANCELADO' and archivado_en is null) then
    raise exception 'La solicitud no está en diseño.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='ENTREGADO',diseno_entregado_en=now(),modificado_por=(select auth.uid())
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','EN_DISENO'),jsonb_build_object('estatus','ENTREGADO'),(select auth.uid()));
end;
$$;

revoke all on function public.sync_pendiente_drive_brief(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.reserve_pendiente_brief_upload(uuid,uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.reserve_pendiente_deliverable_upload(uuid,uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.request_pendiente_to_design(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sync_pendiente_drive_brief(uuid,text,text,integer) to service_role;
grant execute on function public.reserve_pendiente_brief_upload(uuid,uuid,text,text,bigint) to service_role;
grant execute on function public.reserve_pendiente_deliverable_upload(uuid,uuid,text,text,bigint) to service_role;
grant execute on function public.request_pendiente_to_design(uuid,uuid) to service_role;
revoke all on function public.retract_pendiente_design_request(uuid,integer) from public,anon;
revoke all on function public.get_design_internal_queue() from public,anon;
revoke all on function public.design_start_internal_request(uuid) from public,anon;
revoke all on function public.design_deliver_internal_request(uuid) from public,anon;
grant execute on function public.retract_pendiente_design_request(uuid,integer) to authenticated;
grant execute on function public.get_design_internal_queue() to authenticated;
revoke all on function public.get_design_internal_request(uuid) from public,anon;
revoke all on function public.get_design_internal_history(integer,integer) from public,anon;
revoke all on function public.get_pendiente_designer_names(uuid[]) from public,anon;
grant execute on function public.get_design_internal_request(uuid) to authenticated;
grant execute on function public.get_design_internal_history(integer,integer) to authenticated;
grant execute on function public.get_pendiente_designer_names(uuid[]) to authenticated;
grant execute on function public.design_start_internal_request(uuid) to authenticated;
grant execute on function public.design_deliver_internal_request(uuid) to authenticated;

commit;

