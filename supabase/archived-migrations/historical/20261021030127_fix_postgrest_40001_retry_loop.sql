-- PostgREST 14 retries transactions that return SQLSTATE 40001. These
-- functions use that code for expected optimistic-version conflicts, which
-- can create a retry loop. PT409 maps the conflict to HTTP 409 instead.

create or replace function public.update_store_task(p_id uuid,p_version integer,p_data jsonb)
returns public.pendientes_tienda language plpgsql security definer set search_path = '' as $$
declare oldrow public.pendientes_tienda%rowtype; newrow public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.update');
  select * into oldrow from public.pendientes_tienda where id=p_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if oldrow.version<>p_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
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
  if oldrow.version<>p_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
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
  if not found then raise sqlstate 'PT409' using message='CONFLICTO_VERSION o estado no archivable.'; end if;
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
  if not found then raise sqlstate 'PT409' using message='CONFLICTO_VERSION o pendiente no archivado.'; end if;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',jsonb_build_object('archivado_en',true),jsonb_build_object('archivado_en',null),(select auth.uid()));
  return r;
end;
$$;

create or replace function public.retract_pendiente_design_request(p_pendiente_id uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.status.update');
  select * into r from public.pendientes_tienda where id=p_pendiente_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if r.version<>p_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
  if r.diseno_estatus<>'SOLICITADO' then raise exception 'Solo puedes retirar una solicitud antes de que Design la tome.' using errcode='22023'; end if;
  update public.pendientes_tienda set diseno_estatus=null,diseno_solicitado_en=null,estatus='PENDIENTE',modificado_por=(select auth.uid())
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','SOLICITADO'),jsonb_build_object('estatus',null),(select auth.uid()));
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'ESTATUS',jsonb_build_object('estatus',r.estatus),jsonb_build_object('estatus','PENDIENTE'),(select auth.uid()));
end;
$$;

create or replace function public.retract_evento_design_request(p_evento_id uuid,p_expected_version integer)
returns integer language plpgsql security definer set search_path='' as $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  select * into e from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
  if e.version is distinct from p_expected_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
  if e.diseno_estatus<>'SOLICITADO' then raise exception 'Solo se puede retirar una solicitud antes de que Design la tome.'; end if;
  update public.eventos set diseno_estatus=null,diseno_solicitado_en=null,version=version+1,modificado_en=now(),modificado_por=actor where id=p_evento_id returning version into p_expected_version;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"SOLICITADO"}'::jsonb,'{"estatus":null}'::jsonb,actor);
  return p_expected_version;
end;
$$;
