-- Internal store tasks. Manual-apply migration; no remote schema operation is performed here.
begin;

create table if not exists public.pendientes_tienda (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.inventario_sedes(id),
  tipo text not null check (tipo in ('IMPRESION','INSUMO','NECESIDAD')),
  titulo text not null check (length(trim(titulo)) between 1 and 160),
  detalle text check (detalle is null or length(detalle) <= 2000),
  cantidad integer check (cantidad is null or cantidad >= 1),
  enlace_referencia text check (enlace_referencia is null or (length(enlace_referencia) <= 500 and enlace_referencia ~* '^https?://')),
  fecha_requerida date,
  estatus text not null default 'PENDIENTE' check (estatus in ('PENDIENTE','EN_PROCESO','LISTO','ENTREGADO','CANCELADO')),
  entregado_en timestamptz,
  archivado_en timestamptz,
  version integer not null default 1 check (version > 0),
  creado_por uuid not null references auth.users(id),
  creado_en timestamptz not null default now(),
  modificado_por uuid references auth.users(id),
  modificado_en timestamptz not null default now(),
  requiere_diseno boolean not null default false,
  instrucciones_diseno text check (instrucciones_diseno is null or length(instrucciones_diseno) <= 4000),
  fecha_entrega_diseno date,
  diseno_estatus text check (diseno_estatus is null or diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO')),
  diseno_solicitado_en timestamptz,
  diseno_iniciado_en timestamptz,
  diseno_entregado_en timestamptz,
  disenador_id uuid references auth.users(id) on delete set null,
  drive_folder_id text,
  drive_folder_url text,
  drive_brief_folder_id text,
  drive_deliverables_folder_id text,
  drive_brief_file_count integer not null default 0 check (drive_brief_file_count between 0 and 10),
  drive_brief_checked_at timestamptz,
  constraint pendientes_tienda_archivado_check check (archivado_en is null or estatus in ('ENTREGADO','CANCELADO')),
  constraint pendientes_tienda_design_check check (
    diseno_estatus is null or
    (requiere_diseno and nullif(trim(instrucciones_diseno),'') is not null and fecha_entrega_diseno is not null)
  )
);
create index if not exists pendientes_tienda_owner_idx on public.pendientes_tienda(creado_por, estatus, creado_en desc);
create index if not exists pendientes_tienda_store_idx on public.pendientes_tienda(sede_id, estatus);
create index if not exists pendientes_tienda_due_idx on public.pendientes_tienda(estatus, fecha_requerida);
create index if not exists pendientes_tienda_design_idx on public.pendientes_tienda(diseno_estatus, fecha_entrega_diseno)
where diseno_estatus is not null;

create table if not exists public.pendiente_tienda_historial (
  id uuid primary key default gen_random_uuid(),
  pendiente_id uuid not null references public.pendientes_tienda(id) on delete cascade,
  tipo text not null check (tipo in ('ESTATUS','EDICION','DISENO')),
  anterior jsonb not null default '{}'::jsonb,
  nuevo jsonb not null default '{}'::jsonb,
  motivo text check (motivo is null or length(motivo) <= 500),
  cambiado_por uuid references auth.users(id) on delete set null,
  cambiado_en timestamptz not null default now()
);
create index if not exists pendiente_tienda_historial_task_idx on public.pendiente_tienda_historial(pendiente_id, cambiado_en desc);

create or replace function public.guard_pendiente_tienda_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.pendientes_tienda p where p.id = old.pendiente_id) then return old; end if;
  raise exception 'El historial del pendiente no se puede editar ni eliminar.';
end;
$$;
drop trigger if exists guard_pendiente_tienda_history on public.pendiente_tienda_historial;
create trigger guard_pendiente_tienda_history before update or delete on public.pendiente_tienda_historial
for each row execute function public.guard_pendiente_tienda_history();
revoke all on function public.guard_pendiente_tienda_history() from public, anon, authenticated;

create or replace function public.touch_pendiente_tienda()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.modificado_en := now();
  return new;
end;
$$;
drop trigger if exists touch_pendiente_tienda on public.pendientes_tienda;
create trigger touch_pendiente_tienda before update on public.pendientes_tienda
for each row execute function public.touch_pendiente_tienda();
revoke all on function public.touch_pendiente_tienda() from public, anon, authenticated;

insert into public.app_permissions(code, description) values
('internal.store-tasks.read','Consultar pendientes propios por tienda'),
('internal.store-tasks.create','Crear pendientes por tienda'),
('internal.store-tasks.update','Editar pendientes y gestionar briefs'),
('internal.store-tasks.status.update','Cambiar estado de pendientes'),
('internal.store-tasks.archive','Archivar y restaurar pendientes')
on conflict (code) do update set description = excluded.description;
insert into public.role_permissions(role_code, permission_code)
select 'internal', code from public.app_permissions where code like 'internal.store-tasks.%'
on conflict do nothing;

alter table public.pendientes_tienda enable row level security;
alter table public.pendiente_tienda_historial enable row level security;
revoke all on public.pendientes_tienda from anon, authenticated;
revoke all on public.pendiente_tienda_historial from anon, authenticated;
grant select on public.pendientes_tienda, public.pendiente_tienda_historial to authenticated;
drop policy if exists internal_read_own_store_tasks on public.pendientes_tienda;
create policy internal_read_own_store_tasks on public.pendientes_tienda for select to authenticated
using ((select public.has_permission('internal.store-tasks.read')) and creado_por = (select auth.uid()));
drop policy if exists internal_read_own_store_task_history on public.pendiente_tienda_historial;
create policy internal_read_own_store_task_history on public.pendiente_tienda_historial for select to authenticated
using ((select public.has_permission('internal.store-tasks.read')) and exists (
  select 1 from public.pendientes_tienda p where p.id = pendiente_id and p.creado_por = (select auth.uid())
));

create or replace function public.internal_require(p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.internal_require(text) from public, anon, authenticated;

create or replace function public.list_internal_stores()
returns table(id uuid, codigo text, nombre text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.internal_require('internal.store-tasks.read');
  return query select s.id, s.codigo, s.nombre from public.inventario_sedes s where s.activa order by s.orden, s.nombre;
end;
$$;

create or replace function public.list_store_tasks(
  p_archived boolean default false, p_tipo text default null, p_estatus text default null,
  p_sede_id uuid default null, p_search text default null, p_limit integer default 50, p_offset integer default 0
)
returns table(
  id uuid, sede_id uuid, sede_nombre text, tipo text, titulo text, detalle text, cantidad integer,
  enlace_referencia text, fecha_requerida date, estatus text, version integer, creado_en timestamptz,
  archivado_en timestamptz, requiere_diseno boolean, instrucciones_diseno text,
  fecha_entrega_diseno date, diseno_estatus text, drive_brief_file_count integer, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.internal_require('internal.store-tasks.read');
  return query with f as (
    select p.*, s.nombre as sn from public.pendientes_tienda p
    join public.inventario_sedes s on s.id = p.sede_id
    where p.creado_por = (select auth.uid()) and (p.archivado_en is not null) = p_archived
      and (p_tipo is null or p.tipo = p_tipo) and (p_estatus is null or p.estatus = p_estatus)
      and (p_sede_id is null or p.sede_id = p_sede_id)
      and (p_search is null or p.titulo ilike '%'||p_search||'%' or coalesce(p.detalle,'') ilike '%'||p_search||'%')
  )
  select f.id,f.sede_id,f.sn,f.tipo,f.titulo,f.detalle,f.cantidad,f.enlace_referencia,f.fecha_requerida,
    f.estatus,f.version,f.creado_en,f.archivado_en,f.requiere_diseno,f.instrucciones_diseno,
    f.fecha_entrega_diseno,f.diseno_estatus,f.drive_brief_file_count,count(*) over()
  from f order by f.fecha_requerida nulls last,f.creado_en desc
  limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
end;
$$;

create or replace function public.get_store_task(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public.internal_require('internal.store-tasks.read');
  select to_jsonb(p)||jsonb_build_object('sede_nombre',s.nombre,'historial',
    coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('cambiado_por_nombre',coalesce(pr.full_name,'Sistema')) order by h.cambiado_en desc)
      from public.pendiente_tienda_historial h left join public.profiles pr on pr.user_id=h.cambiado_por where h.pendiente_id=p.id),'[]'::jsonb))
  into v from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
  where p.id=p_id and p.creado_por=(select auth.uid());
  if v is null then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  return v;
end;
$$;

create or replace function public.create_store_tasks(p_data jsonb,p_sede_ids uuid[])
returns setof public.pendientes_tienda language plpgsql security definer set search_path = '' as $$
declare sid uuid; r public.pendientes_tienda%rowtype; actor uuid := (select auth.uid());
begin
  perform public.internal_require('internal.store-tasks.create');
  if coalesce(array_length(p_sede_ids,1),0)<1 or array_length(p_sede_ids,1)>20 then raise exception 'Selecciona tiendas válidas.' using errcode='22023'; end if;
  if (select count(distinct x) from unnest(p_sede_ids) x) <> array_length(p_sede_ids,1) then raise exception 'No repitas tiendas.' using errcode='22023'; end if;
  if coalesce((p_data->>'requiere_diseno')::boolean,(p_data->>'tipo'='IMPRESION')) and array_length(p_sede_ids,1)<>1 then raise exception 'Con diseño elige una sola tienda.' using errcode='22023'; end if;
  foreach sid in array p_sede_ids loop
    if not exists(select 1 from public.inventario_sedes where id=sid and activa) then raise exception 'Tienda no disponible.' using errcode='22023'; end if;
    insert into public.pendientes_tienda(sede_id,tipo,titulo,detalle,cantidad,enlace_referencia,fecha_requerida,
      requiere_diseno,instrucciones_diseno,fecha_entrega_diseno,creado_por,modificado_por)
    values(sid,p_data->>'tipo',trim(p_data->>'titulo'),nullif(p_data->>'detalle',''),nullif(p_data->>'cantidad','')::integer,
      nullif(p_data->>'enlace_referencia',''),nullif(p_data->>'fecha_requerida','')::date,
      coalesce((p_data->>'requiere_diseno')::boolean,(p_data->>'tipo'='IMPRESION')),
      nullif(p_data->>'instrucciones_diseno',''),nullif(p_data->>'fecha_entrega_diseno','')::date,
      actor,actor) returning * into r;
    insert into public.pendiente_tienda_historial(pendiente_id,tipo,nuevo,cambiado_por) values(r.id,'EDICION',to_jsonb(r),actor);
    return next r;
  end loop;
end;
$$;

create or replace function public.update_store_task(p_id uuid,p_version integer,p_data jsonb)
returns public.pendientes_tienda language plpgsql security definer set search_path = '' as $$
declare oldrow public.pendientes_tienda%rowtype; newrow public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.update');
  select * into oldrow from public.pendientes_tienda where id=p_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if oldrow.version<>p_version then raise exception 'CONFLICTO_VERSION' using errcode='40001'; end if;
  if oldrow.archivado_en is not null then raise exception 'Restaura el pendiente antes de editarlo.' using errcode='22023'; end if;
  if oldrow.estatus='CANCELADO' then raise exception 'Reabre el pendiente antes de editarlo.' using errcode='22023'; end if;
  if oldrow.estatus='ENTREGADO' and (p_data - 'detalle') <> '{}'::jsonb then raise exception 'Un pendiente entregado solo permite corregir el detalle.' using errcode='22023'; end if;
  update public.pendientes_tienda set tipo=coalesce(p_data->>'tipo',tipo), titulo=coalesce(p_data->>'titulo',titulo),
    detalle=case when p_data?'detalle' then nullif(p_data->>'detalle','') else detalle end,
    cantidad=case when p_data?'cantidad' then nullif(p_data->>'cantidad','')::integer else cantidad end,
    enlace_referencia=case when p_data?'enlace_referencia' then nullif(p_data->>'enlace_referencia','') else enlace_referencia end,
    fecha_requerida=case when p_data?'fecha_requerida' then nullif(p_data->>'fecha_requerida','')::date else fecha_requerida end,
    requiere_diseno=case when p_data?'requiere_diseno' and diseno_estatus is null then (p_data->>'requiere_diseno')::boolean else requiere_diseno end,
    instrucciones_diseno=case when p_data?'instrucciones_diseno' and diseno_estatus is null then nullif(p_data->>'instrucciones_diseno','') else instrucciones_diseno end,
    fecha_entrega_diseno=case when p_data?'fecha_entrega_diseno' and diseno_estatus is null then nullif(p_data->>'fecha_entrega_diseno','')::date else fecha_entrega_diseno end,
    modificado_por=(select auth.uid()) where id=p_id returning * into newrow;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',to_jsonb(oldrow),to_jsonb(newrow),(select auth.uid()));
  return newrow;
end;
$$;

create or replace function public.transition_store_task_status(p_id uuid,p_version integer,p_estatus text,p_motivo text default null)
returns public.pendientes_tienda language plpgsql security definer set search_path = '' as $$
declare oldrow public.pendientes_tienda%rowtype; newrow public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.status.update');
  select * into oldrow from public.pendientes_tienda where id=p_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if oldrow.version<>p_version then raise exception 'CONFLICTO_VERSION' using errcode='40001'; end if;
  if p_estatus not in ('PENDIENTE','EN_PROCESO','LISTO','ENTREGADO','CANCELADO') then raise exception 'Estado inválido.' using errcode='22023'; end if;
  if p_estatus='PENDIENTE' and oldrow.diseno_estatus='SOLICITADO' then raise exception 'Retira la solicitud a Design para devolver este pendiente a Pendiente.' using errcode='22023'; end if;
  if oldrow.estatus='CANCELADO' and p_estatus<>'PENDIENTE' then raise exception 'Reabre a Pendiente primero.' using errcode='22023'; end if;
  if (p_estatus='CANCELADO' or p_estatus='PENDIENTE' or oldrow.estatus='ENTREGADO') and length(trim(coalesce(p_motivo,'')))=0 then raise exception 'MOTIVO_REQUERIDO' using errcode='22023'; end if;
  if oldrow.archivado_en is not null then raise exception 'Restaura antes de cambiar estado.' using errcode='22023'; end if;
  update public.pendientes_tienda set estatus=p_estatus,entregado_en=case when p_estatus='ENTREGADO' then now() when p_estatus='PENDIENTE' then null else entregado_en end,
    diseno_estatus=case when p_estatus='CANCELADO' then null else diseno_estatus end,
    modificado_por=(select auth.uid()) where id=p_id returning * into newrow;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por)
  values(p_id,'ESTATUS',jsonb_build_object('estatus',oldrow.estatus),jsonb_build_object('estatus',newrow.estatus),nullif(trim(p_motivo),''),(select auth.uid()));
  if oldrow.diseno_estatus is not null and p_estatus='CANCELADO' then
    insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por)
    values(p_id,'DISENO',jsonb_build_object('estatus',oldrow.diseno_estatus),jsonb_build_object('estatus',null),nullif(trim(p_motivo),''),(select auth.uid()));
  end if;
  return newrow;
end;
$$;

create or replace function public.archive_store_task(p_id uuid,p_version integer)
returns public.pendientes_tienda language plpgsql security definer set search_path = '' as $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.archive');
  update public.pendientes_tienda set archivado_en=now(),modificado_por=(select auth.uid())
  where id=p_id and creado_por=(select auth.uid()) and version=p_version and archivado_en is null and estatus in ('ENTREGADO','CANCELADO') returning * into r;
  if not found then raise exception 'CONFLICTO_VERSION o estado no archivable.' using errcode='40001'; end if;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',jsonb_build_object('archivado_en',null),jsonb_build_object('archivado_en',r.archivado_en),(select auth.uid()));
  return r;
end;
$$;
create or replace function public.restore_store_task(p_id uuid,p_version integer)
returns public.pendientes_tienda language plpgsql security definer set search_path = '' as $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.archive');
  update public.pendientes_tienda set archivado_en=null,modificado_por=(select auth.uid())
  where id=p_id and creado_por=(select auth.uid()) and version=p_version and archivado_en is not null returning * into r;
  if not found then raise exception 'CONFLICTO_VERSION o pendiente no archivado.' using errcode='40001'; end if;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',jsonb_build_object('archivado_en',true),jsonb_build_object('archivado_en',null),(select auth.uid()));
  return r;
end;
$$;

revoke all on function public.list_internal_stores() from public,anon;
revoke all on function public.list_store_tasks(boolean,text,text,uuid,text,integer,integer) from public,anon;
revoke all on function public.get_store_task(uuid) from public,anon;
revoke all on function public.create_store_tasks(jsonb,uuid[]) from public,anon;
revoke all on function public.update_store_task(uuid,integer,jsonb) from public,anon;
revoke all on function public.transition_store_task_status(uuid,integer,text,text) from public,anon;
revoke all on function public.archive_store_task(uuid,integer) from public,anon;
revoke all on function public.restore_store_task(uuid,integer) from public,anon;
grant execute on function public.list_internal_stores() to authenticated;
grant execute on function public.list_store_tasks(boolean,text,text,uuid,text,integer,integer) to authenticated;
grant execute on function public.get_store_task(uuid) to authenticated;
grant execute on function public.create_store_tasks(jsonb,uuid[]) to authenticated;
grant execute on function public.update_store_task(uuid,integer,jsonb) to authenticated;
grant execute on function public.transition_store_task_status(uuid,integer,text,text) to authenticated;
grant execute on function public.archive_store_task(uuid,integer) to authenticated;
grant execute on function public.restore_store_task(uuid,integer) to authenticated;

commit;

