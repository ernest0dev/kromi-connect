begin;

alter table public.publicaciones
  add column if not exists requiere_diseno boolean not null default true;

comment on column public.publicaciones.requiere_diseno is
  'Indica si la publicación requiere trabajo y entrega del rol Design.';

create or replace function public.guard_publication_design_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requiere_diseno is distinct from old.requiere_diseno then
    if coalesce(current_setting('app.publication_design_requirement', true), '') <> 'on' then
      raise exception 'La decisión de requerir Design debe cambiar mediante la acción autorizada.';
    end if;
    if old.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
      raise exception 'La decisión de requerir Design solo se puede cambiar antes de solicitar la pieza.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_publication_design_requirement on public.publicaciones;
create trigger guard_publication_design_requirement
before update on public.publicaciones
for each row execute function public.guard_publication_design_requirement();
revoke all on function public.guard_publication_design_requirement() from public, anon, authenticated;

create or replace function public.set_publication_design_requirement(
  p_publicacion_id uuid,
  p_requiere_diseno boolean
)
returns public.publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_publicacion public.publicaciones%rowtype;
begin
  if v_actor is null
    or not (select public.has_role('social-media'))
    or not (
      (select public.has_permission('social-media.posts.create'))
      or (select public.has_permission('social-media.posts.edit'))
    ) then
    raise exception 'Solo Social Media puede cambiar si una publicación requiere Design.';
  end if;

  select * into v_publicacion
  from public.publicaciones
  where id = p_publicacion_id and deleted_at is null
  for update;

  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
    raise exception 'La decisión de requerir Design solo se puede cambiar en Brief o durante el rodaje.';
  end if;

  perform set_config('app.publication_design_requirement', 'on', true);
  update public.publicaciones
  set requiere_diseno = p_requiere_diseno, updated_at = now()
  where id = p_publicacion_id
  returning * into v_publicacion;

  return v_publicacion;
end;
$$;

revoke all on function public.set_publication_design_requirement(uuid, boolean) from public, anon;
grant execute on function public.set_publication_design_requirement(uuid, boolean) to authenticated;

create or replace function public.request_publication_to_design(p_publication_id uuid, p_actor_id uuid)
returns public.publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_previous public.estatus_enum;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr
    join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'social-media'
      and rp.permission_code = 'social-media.posts.status.update'
  ) then raise exception 'Solo Social Media puede solicitar diseño.'; end if;
  if exists (
    select 1 from public.publicacion_canales pc
    where pc.publicacion_id = p_publication_id
      and not exists (
        select 1 from public.user_social_accounts usa
        where usa.social_account_id = pc.social_account_id and usa.user_id = p_actor_id
      )
  ) then raise exception 'No tienes acceso a todas las cuentas destino.'; end if;

  select * into v_publicacion from public.publicaciones
  where id = p_publication_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if not v_publicacion.requiere_diseno then raise exception 'Esta publicación está configurada para avanzar sin Design.'; end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
    raise exception 'La publicación ya no está pendiente de solicitar.';
  end if;
  if v_publicacion.drive_brief_file_count < 1
    or v_publicacion.drive_brief_checked_at is null
    or v_publicacion.drive_brief_checked_at < now() - interval '5 minutes' then
    raise exception 'El brief debe contener archivos verificados recientemente.';
  end if;

  v_previous := v_publicacion.estatus;
  perform set_config('app.publication_transition', 'on', true);
  update public.publicaciones set
    estatus = 'SOLICITADO'::public.estatus_enum,
    fecha_solicitud_diseno = now(),
    fecha_limite_brief = fecha_publicacion - 5,
    fecha_entrega_diseno_estimada = ((now() at time zone 'America/Caracas')::date + 2),
    updated_at = now()
  where id = p_publication_id returning * into v_publicacion;
  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, cambiado_por)
  values (p_publication_id, v_previous, 'SOLICITADO'::public.estatus_enum, p_actor_id);
  return v_publicacion;
end;
$$;
revoke all on function public.request_publication_to_design(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_publication_to_design(uuid, uuid) to service_role;

create or replace function public.transition_publicacion_status(
  p_publicacion_id uuid,
  p_estatus_nuevo public.estatus_enum,
  p_motivo text default null
)
returns public.publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_actor uuid := (select auth.uid());
  v_social boolean := (select public.has_permission('social-media.posts.status.update'));
  v_design boolean := (select public.has_permission('design.posts.read'));
  v_motivo text := nullif(trim(p_motivo), '');
  v_old public.estatus_enum;
  v_allowed boolean := false;
begin
  if v_actor is null then raise exception 'Inicia sesión para continuar.'; end if;
  if p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum then raise exception 'Usa la solicitud validada de brief.'; end if;
  select * into v_publicacion from public.publicaciones
  where id = p_publicacion_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  v_old := v_publicacion.estatus;
  if not v_design and not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;

  if p_estatus_nuevo = 'CANCELADO'::public.estatus_enum then
    if not v_social or not (select public.has_role('social-media')) then raise exception 'Solo Social Media puede cancelar publicaciones.'; end if;
    if v_motivo is null then raise exception 'Indica el motivo de cancelación.'; end if;
    v_allowed := v_old <> 'CANCELADO'::public.estatus_enum;
  elsif v_design then
    if not v_publicacion.requiere_diseno then raise exception 'Esta publicación no requiere acciones de Design.'; end if;
    if p_estatus_nuevo = 'EN_DISENO'::public.estatus_enum then
      v_allowed := v_old in ('SOLICITADO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum)
        and (select public.has_permission('design.posts.start'));
    elsif p_estatus_nuevo = 'EN_REVISION_CM'::public.estatus_enum then
      v_allowed := v_old = 'EN_DISENO'::public.estatus_enum
        and (select public.has_permission('design.posts.deliver'));
    end if;
  elsif v_social then
    v_allowed :=
      (p_estatus_nuevo = 'PENDIENTE_BRIEF'::public.estatus_enum and v_old = 'SOLICITADO'::public.estatus_enum)
      or (p_estatus_nuevo = 'EN_RODAJE'::public.estatus_enum and v_old = 'PENDIENTE_BRIEF'::public.estatus_enum)
      or (p_estatus_nuevo = 'EN_CORRECCION'::public.estatus_enum and v_old = 'EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum and v_old = 'EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum and not v_publicacion.requiere_diseno and (
        (v_old = 'PENDIENTE_BRIEF'::public.estatus_enum and not v_publicacion.requiere_rodaje)
        or v_old = 'EN_RODAJE'::public.estatus_enum
      ))
      or (p_estatus_nuevo in ('PROGRAMADO'::public.estatus_enum, 'PUBLICADO'::public.estatus_enum) and v_old in ('EN_REVISION_CM'::public.estatus_enum, 'APROBADO'::public.estatus_enum))
      or (p_estatus_nuevo = 'APROBADO'::public.estatus_enum and v_old = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum)
      or (p_estatus_nuevo = 'PUBLICADO'::public.estatus_enum and v_old = 'PROGRAMADO'::public.estatus_enum);
    if p_estatus_nuevo = 'EN_CORRECCION'::public.estatus_enum and v_motivo is null then
      raise exception 'Indica las correcciones solicitadas.';
    end if;
  end if;

  if not v_allowed then raise exception 'La transición de estado no está permitida.'; end if;
  perform set_config('app.publication_transition', 'on', true);
  update public.publicaciones set
    estatus = p_estatus_nuevo,
    fecha_solicitud_diseno = case when p_estatus_nuevo = 'PENDIENTE_BRIEF'::public.estatus_enum then null else fecha_solicitud_diseno end,
    fecha_entrega_diseno_estimada = case when p_estatus_nuevo = 'PENDIENTE_BRIEF'::public.estatus_enum then null else fecha_entrega_diseno_estimada end,
    fecha_entrega_diseno_real = case when p_estatus_nuevo = 'EN_REVISION_CM'::public.estatus_enum then now() else fecha_entrega_diseno_real end,
    fecha_aprobacion_gerencia = case when p_estatus_nuevo = 'APROBADO'::public.estatus_enum then now() else fecha_aprobacion_gerencia end,
    updated_at = now()
  where id = p_publicacion_id returning * into v_publicacion;

  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, motivo, cambiado_por)
  values (p_publicacion_id, v_old, p_estatus_nuevo, v_motivo, v_actor);
  if p_estatus_nuevo in ('EN_CORRECCION'::public.estatus_enum, 'CANCELADO'::public.estatus_enum) then
    insert into public.publicacion_comentarios (publicacion_id, autor_id, texto, tipo)
    values (p_publicacion_id, v_actor, v_motivo,
      case when p_estatus_nuevo = 'CANCELADO'::public.estatus_enum then 'MOTIVO_CANCELACION' else 'CORRECCION' end);
  end if;
  return v_publicacion;
end;
$$;
revoke all on function public.transition_publicacion_status(uuid, public.estatus_enum, text) from public, anon;
grant execute on function public.transition_publicacion_status(uuid, public.estatus_enum, text) to authenticated;

create or replace function public.get_design_publication_queue()
returns setof public.publicaciones
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.publicaciones p
  where (select public.has_permission('design.posts.read'))
    and p.deleted_at is null
    and p.requiere_diseno
    and p.estatus in ('SOLICITADO'::public.estatus_enum, 'EN_DISENO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum)
  order by p.fecha_publicacion, p.created_at;
$$;
revoke all on function public.get_design_publication_queue() from public, anon;
grant execute on function public.get_design_publication_queue() to authenticated;

notify pgrst, 'reload schema';
commit;
