begin;

alter table public.eventos
  add column if not exists requiere_diseno boolean not null default false,
  add column if not exists diseno_formatos text[] not null default '{}',
  add column if not exists instrucciones_diseno text,
  add column if not exists fecha_entrega_diseno date,
  add column if not exists diseno_estatus text,
  add column if not exists diseno_solicitado_en timestamptz,
  add column if not exists diseno_iniciado_en timestamptz,
  add column if not exists diseno_entregado_en timestamptz,
  add column if not exists disenador_id uuid references auth.users(id) on delete set null,
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text,
  add column if not exists drive_brief_folder_id text,
  add column if not exists drive_deliverables_folder_id text,
  add column if not exists drive_brief_file_count integer not null default 0,
  add column if not exists drive_brief_checked_at timestamptz;

alter table public.eventos drop constraint if exists eventos_diseno_estatus_check;
alter table public.eventos add constraint eventos_diseno_estatus_check
  check (diseno_estatus is null or diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO','CANCELADO'));
alter table public.eventos drop constraint if exists eventos_diseno_formatos_check;
alter table public.eventos add constraint eventos_diseno_formatos_check
  check (diseno_formatos <@ array['DIGITAL','IMPRESION']::text[]);
alter table public.eventos drop constraint if exists eventos_diseno_coherencia_check;
alter table public.eventos add constraint eventos_diseno_coherencia_check check (
  diseno_estatus is null or (requiere_diseno and cardinality(diseno_formatos) > 0
    and fecha_entrega_diseno is not null and nullif(trim(instrucciones_diseno),'') is not null)
);
alter table public.eventos drop constraint if exists eventos_diseno_instrucciones_check;
alter table public.eventos add constraint eventos_diseno_instrucciones_check
  check (instrucciones_diseno is null or length(instrucciones_diseno) <= 4000);

create or replace function public.events_flags(e public.eventos)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'proximo',e.estatus='PROGRAMADO' and e.inicio>now() and e.inicio<=now()+interval '48 hours',
    'fecha_vencida',e.estatus='EN_PLANIFICACION' and e.inicio is not null and e.inicio<=now(),
    'incompleto',e.estatus='EN_PLANIFICACION' and e.inicio is not null and e.inicio>now() and e.inicio<now()+interval '7 days'
      and (e.responsable_id is null or e.presupuesto_estimado is null or nullif(trim(e.materiales),'') is null),
    'materiales_sin_declarar',e.estatus in ('EN_PLANIFICACION','PROGRAMADO') and nullif(trim(e.materiales),'') is null and e.inicio is not null and e.inicio>now() and e.inicio<now()+interval '3 days',
    'cierre_pendiente',e.estatus='TERMINADO' and e.asistentes_reales is null and e.gasto_real is null and e.notas_cierre is null,
    'diseno_sin_solicitar',e.requiere_diseno and e.diseno_estatus is null and e.fecha_entrega_diseno between (now() at time zone 'America/Caracas')::date and (now() at time zone 'America/Caracas')::date+3,
    'diseno_atrasado',e.requiere_diseno and e.diseno_estatus not in ('ENTREGADO','CANCELADO') and e.fecha_entrega_diseno<(now() at time zone 'America/Caracas')::date,
    'diseno_posterior_al_evento',e.requiere_diseno and e.diseno_estatus not in ('ENTREGADO','CANCELADO') and e.inicio is not null and e.fecha_entrega_diseno>(e.inicio at time zone 'America/Caracas')::date
  );
$$;
revoke all on function public.events_flags(public.eventos) from public,anon,authenticated;

alter table public.evento_historial drop constraint if exists evento_historial_tipo_check;
alter table public.evento_historial add constraint evento_historial_tipo_check
  check (tipo in ('ESTATUS','REPROGRAMACION','DISENO'));

insert into public.app_permissions(code,description) values
 ('events.schedule.design','Solicitar y administrar diseño de eventos'),
 ('design.requests.read','Consultar la cola unificada de solicitudes de diseño'),
 ('design.requests.start','Iniciar solicitudes de la cola unificada de diseño'),
 ('design.requests.deliver','Entregar solicitudes de la cola unificada de diseño')
on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_code,permission_code)
select 'events','events.schedule.design' union all select 'design','design.requests.read'
union all select 'design','design.requests.start' union all select 'design','design.requests.deliver'
on conflict do nothing;

create or replace function public.save_event_design_config(
  p_evento_id uuid,p_expected_version integer,p_requiere boolean,p_formatos text[],p_instrucciones text,p_fecha date
) returns integer language plpgsql security definer set search_path='' as $$
declare v_event public.eventos%rowtype; v_actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.update');
  select * into v_event from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'El evento no existe.'; end if;
  if v_event.version is distinct from p_expected_version then raise exception 'CONFLICTO_VERSION'; end if;
  if v_event.diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO') and
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

create or replace function public.get_event_design_data(p_evento_id uuid)
returns table(requiere_diseno boolean,diseno_formatos text[],instrucciones_diseno text,fecha_entrega_diseno date,
  diseno_estatus text,diseno_solicitado_en timestamptz,diseno_iniciado_en timestamptz,diseno_entregado_en timestamptz,
  disenador_id uuid,disenador_nombre text,drive_folder_id text,drive_brief_folder_id text,drive_deliverables_folder_id text,
  drive_brief_file_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.events_require('events.schedule.read');
  return query select e.requiere_diseno,e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,
    e.diseno_solicitado_en,e.diseno_iniciado_en,e.diseno_entregado_en,e.disenador_id,p.full_name,
    e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count
  from public.eventos e left join public.profiles p on p.user_id=e.disenador_id where e.id=p_evento_id;
end; $$;

create or replace function public.create_event_with_design(p_datos jsonb,p_confirmar_cruce boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_version integer;
begin
  v_id:=public.create_event(p_datos,p_confirmar_cruce);
  select version into v_version from public.eventos where id=v_id;
  perform public.save_event_design_config(v_id,v_version,coalesce((p_datos->>'requiere_diseno')::boolean,false),
    array(select jsonb_array_elements_text(coalesce(p_datos->'diseno_formatos','[]'::jsonb))),p_datos->>'instrucciones_diseno',
    nullif(p_datos->>'fecha_entrega_diseno','')::date);
  return v_id;
end; $$;

create or replace function public.update_event_with_design(p_evento_id uuid,p_expected_version integer,p_datos jsonb,p_motivo text default null,p_confirmar_cruce boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare v_version integer;
begin
  v_version:=public.update_event(p_evento_id,p_expected_version,p_datos,p_motivo,p_confirmar_cruce);
  return public.save_event_design_config(p_evento_id,v_version,coalesce((p_datos->>'requiere_diseno')::boolean,false),
    array(select jsonb_array_elements_text(coalesce(p_datos->'diseno_formatos','[]'::jsonb))),p_datos->>'instrucciones_diseno',
    nullif(p_datos->>'fecha_entrega_diseno','')::date);
end; $$;

revoke all on function public.save_event_design_config(uuid,integer,boolean,text[],text,date) from public,anon;
grant execute on function public.save_event_design_config(uuid,integer,boolean,text[],text,date) to authenticated;
revoke all on function public.get_event_design_data(uuid) from public,anon;
grant execute on function public.get_event_design_data(uuid) to authenticated;
revoke all on function public.create_event_with_design(jsonb,boolean) from public,anon;
grant execute on function public.create_event_with_design(jsonb,boolean) to authenticated;
revoke all on function public.update_event_with_design(uuid,integer,jsonb,text,boolean) from public,anon;
grant execute on function public.update_event_with_design(uuid,integer,jsonb,text,boolean) to authenticated;
commit;
