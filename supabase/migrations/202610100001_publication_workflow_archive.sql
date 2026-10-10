begin;

alter table public.publicaciones
  add column if not exists deleted_at timestamptz,
  add column if not exists hora_publicacion time,
  add column if not exists requiere_rodaje boolean not null default false,
  add column if not exists fecha_rodaje date,
  add column if not exists sedes public.sede_enum[] not null default '{}',
  add column if not exists prioridad smallint not null default 2,
  add column if not exists drive_cleanup_status text not null default 'PENDIENTE',
  add column if not exists drive_cleanup_error text,
  add column if not exists drive_cleanup_attempted_at timestamptz,
  add column if not exists drive_deleted_at timestamptz,
  add column if not exists drive_preserved_at timestamptz;

alter table public.publicaciones
  add constraint publicaciones_drive_cleanup_status_check
  check (drive_cleanup_status in ('PENDIENTE', 'PROCESANDO', 'ERROR', 'ELIMINADO', 'CONSERVADO'));

alter table public.publicaciones
  add constraint publicaciones_prioridad_check check (prioridad in (1, 2, 3));

create index if not exists publicaciones_archive_expiry_idx
  on public.publicaciones (deleted_at)
  where deleted_at is not null;

create table if not exists public.publicacion_estatus_historial (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  estatus_anterior public.estatus_enum,
  estatus_nuevo public.estatus_enum not null,
  motivo text,
  cambiado_por uuid references auth.users(id) on delete set null,
  cambiado_en timestamptz not null default now()
);

create index if not exists publicacion_estatus_historial_publicacion_idx
  on public.publicacion_estatus_historial (publicacion_id, cambiado_en desc);

create or replace function public.record_publicacion_initial_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, cambiado_por)
  values (new.id, null, new.estatus, coalesce((select auth.uid()), new.creador_id));
  return new;
end;
$$;

drop trigger if exists record_publicacion_initial_status on public.publicaciones;
create trigger record_publicacion_initial_status
  after insert on public.publicaciones
  for each row execute function public.record_publicacion_initial_status();
revoke all on function public.record_publicacion_initial_status() from public, anon, authenticated;

create table if not exists public.publicacion_comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  texto text not null check (length(trim(texto)) > 0),
  tipo text not null default 'COMENTARIO'
    check (tipo in ('COMENTARIO', 'CORRECCION', 'MOTIVO_CANCELACION')),
  creado_en timestamptz not null default now()
);

create index if not exists publicacion_comentarios_publicacion_idx
  on public.publicacion_comentarios (publicacion_id, creado_en desc);

create or replace function public.guard_publicacion_workflow_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estatus is distinct from old.estatus
    and coalesce(current_setting('app.publication_transition', true), '') <> 'on' then
    raise exception 'El estado solo puede cambiar mediante una transición autorizada.';
  end if;
  if (
    new.fecha_solicitud_diseno is distinct from old.fecha_solicitud_diseno
    or new.fecha_entrega_diseno_real is distinct from old.fecha_entrega_diseno_real
    or new.fecha_aprobacion_gerencia is distinct from old.fecha_aprobacion_gerencia
  ) and coalesce(current_setting('app.publication_transition', true), '') <> 'on'
    and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Las fechas reales del flujo las fija el sistema al cambiar de estado.';
  end if;
  if new.deleted_at is distinct from old.deleted_at
    and coalesce(current_setting('app.publication_archive', true), '') not in ('archive', 'restore') then
    raise exception 'Usa las acciones autorizadas del Archivo.';
  end if;
  if (
    new.drive_cleanup_status is distinct from old.drive_cleanup_status
    or new.drive_cleanup_error is distinct from old.drive_cleanup_error
    or new.drive_cleanup_attempted_at is distinct from old.drive_cleanup_attempted_at
    or new.drive_deleted_at is distinct from old.drive_deleted_at
    or new.drive_preserved_at is distinct from old.drive_preserved_at
  ) and coalesce((select auth.role()), '') <> 'service_role'
    and coalesce(current_setting('app.publication_archive', true), '') not in ('archive', 'restore') then
    raise exception 'El estado de limpieza de Drive solo puede cambiar en el servidor.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_publication_workflow_columns on public.publicaciones;
create trigger guard_publication_workflow_columns
  before update on public.publicaciones
  for each row execute function public.guard_publicacion_workflow_columns();
revoke all on function public.guard_publicacion_workflow_columns() from public, anon, authenticated;

-- Permanent deletion is restricted to the scheduled worker or the authorized
-- Archive resolution action using the service role after its own role checks.
drop policy if exists app_permissions_delete_posts on public.publicaciones;
revoke delete on public.publicaciones from anon, authenticated;

create or replace function public.archive_publication(p_publicacion_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('social-media')) or not (select public.has_permission('social-media.posts.archive')) then
    raise exception 'Solo Social Media puede archivar publicaciones.';
  end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  perform set_config('app.publication_archive', 'archive', true);
  update public.publicaciones set deleted_at = now(), drive_cleanup_status = 'PENDIENTE', drive_cleanup_error = null
  where id = p_publicacion_id and deleted_at is null;
  return found;
end;
$$;

revoke all on function public.archive_publication(uuid) from public, anon;
grant execute on function public.archive_publication(uuid) to authenticated;

alter table public.publicacion_estatus_historial enable row level security;
alter table public.publicacion_comentarios enable row level security;
revoke all on public.publicacion_estatus_historial from anon, authenticated;
revoke all on public.publicacion_comentarios from anon, authenticated;
grant select on public.publicacion_estatus_historial to authenticated;
grant select on public.publicacion_comentarios to authenticated;
grant insert on public.publicacion_comentarios to authenticated;

drop policy if exists publication_status_history_read on public.publicacion_estatus_historial;
create policy publication_status_history_read on public.publicacion_estatus_historial
  for select to authenticated using (
    (select public.has_permission('social-media.posts.read'))
    and exists (
      select 1 from public.publicacion_canales pc
      join public.user_social_accounts usa on usa.social_account_id = pc.social_account_id
      where pc.publicacion_id = publicacion_estatus_historial.publicacion_id
        and usa.user_id = (select auth.uid())
    )
  );

drop policy if exists publication_comments_read on public.publicacion_comentarios;
create policy publication_comments_read on public.publicacion_comentarios
  for select to authenticated using (
    (
      (
        (select public.has_permission('social-media.posts.read'))
        and exists (
          select 1 from public.publicacion_canales pc
          join public.user_social_accounts usa on usa.social_account_id = pc.social_account_id
          where pc.publicacion_id = publicacion_comentarios.publicacion_id
            and usa.user_id = (select auth.uid())
        )
      )
      or (
        (select public.has_permission('design.posts.read'))
        and exists (
          select 1 from public.publicaciones p
          where p.id = publicacion_comentarios.publicacion_id
            and p.deleted_at is null
            and p.estatus in ('SOLICITADO'::public.estatus_enum, 'EN_DISENO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum)
        )
      )
    )
  );

insert into public.app_permissions (code, description) values
  ('social-media.posts.archive', 'Enviar publicaciones al Archivo'),
  ('social-media.posts.restore', 'Restaurar publicaciones desde el Archivo'),
  ('social-media.posts.purge.resolve', 'Resolver purgas fallidas de Drive'),
  ('social-media.shooting.read', 'Consultar solicitudes de rodaje'),
  ('social-media.shooting.status.update', 'Actualizar estados de rodaje'),
  ('design.posts.read', 'Consultar solicitudes asignadas a Diseño'),
  ('design.posts.start', 'Iniciar el trabajo de diseño'),
  ('design.posts.deliver', 'Entregar una pieza a Social Media')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'social-media', code from public.app_permissions
where code in ('social-media.posts.archive', 'social-media.posts.restore', 'social-media.posts.purge.resolve', 'social-media.shooting.read', 'social-media.shooting.status.update')
on conflict do nothing;

-- The design role can read and move only requests in the design queue via the
-- transition RPC. It receives no broad publication table policy.
insert into public.role_permissions (role_code, permission_code)
select 'design', code from public.app_permissions
where code in ('design.posts.read', 'design.posts.start', 'design.posts.deliver')
on conflict do nothing;

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
  v_is_social_media boolean := (select public.has_permission('social-media.posts.status.update'));
  v_is_design boolean := (select public.has_permission('design.posts.read'));
  v_can_start_design boolean := (select public.has_permission('design.posts.start'));
  v_can_deliver_design boolean := (select public.has_permission('design.posts.deliver'));
  v_motivo text := nullif(trim(p_motivo), '');
  v_estatus_anterior public.estatus_enum;
  v_allowed boolean := false;
begin
  if v_actor is null then raise exception 'Inicia sesión para continuar.'; end if;
  select * into v_publicacion from public.publicaciones
  where id = p_publicacion_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  v_estatus_anterior := v_publicacion.estatus;

  if not v_is_design and not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;

  if p_estatus_nuevo = 'CANCELADO'::public.estatus_enum then
    if not v_is_social_media or not (select public.has_role('social-media')) then raise exception 'Solo Social Media puede cancelar publicaciones.'; end if;
    if v_motivo is null then raise exception 'Indica el motivo de cancelación.'; end if;
    v_allowed := v_publicacion.estatus <> 'CANCELADO'::public.estatus_enum;
  elsif v_is_design then
    if p_estatus_nuevo = 'EN_DISENO'::public.estatus_enum then
      v_allowed := v_can_start_design and v_publicacion.estatus in ('SOLICITADO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum);
    elsif p_estatus_nuevo = 'EN_REVISION_CM'::public.estatus_enum then
      v_allowed := v_can_deliver_design and v_publicacion.estatus = 'EN_DISENO'::public.estatus_enum;
    end if;
    if not v_allowed then raise exception 'Diseño solo puede iniciar una solicitud o entregar una pieza.'; end if;
  elsif v_is_social_media then
    v_allowed :=
      (p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum and v_publicacion.estatus in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum))
      or (p_estatus_nuevo = 'EN_RODAJE'::public.estatus_enum and v_publicacion.estatus = 'PENDIENTE_BRIEF'::public.estatus_enum)
      or (p_estatus_nuevo = 'EN_CORRECCION'::public.estatus_enum and v_publicacion.estatus = 'EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum and v_publicacion.estatus = 'EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo in ('PROGRAMADO'::public.estatus_enum, 'PUBLICADO'::public.estatus_enum) and v_publicacion.estatus in ('EN_REVISION_CM'::public.estatus_enum, 'APROBADO'::public.estatus_enum))
      or (p_estatus_nuevo = 'APROBADO'::public.estatus_enum and v_publicacion.estatus = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum)
      or (p_estatus_nuevo = 'PUBLICADO'::public.estatus_enum and v_publicacion.estatus = 'PROGRAMADO'::public.estatus_enum);
    if p_estatus_nuevo = 'EN_CORRECCION'::public.estatus_enum and v_motivo is null then
      raise exception 'Indica las correcciones solicitadas.';
    end if;
    if not v_allowed then raise exception 'La transición de estado no está permitida.'; end if;
  else
    raise exception 'No tienes permiso para cambiar el estado.';
  end if;

  perform set_config('app.publication_transition', 'on', true);
  update public.publicaciones set
    estatus = p_estatus_nuevo,
    fecha_solicitud_diseno = case when p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum and fecha_solicitud_diseno is null then now() else fecha_solicitud_diseno end,
    fecha_limite_brief = case when p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum then fecha_publicacion - 5 else fecha_limite_brief end,
    fecha_entrega_diseno_estimada = case when p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum and fecha_solicitud_diseno is null then ((now() at time zone 'America/Caracas')::date + 2) else fecha_entrega_diseno_estimada end,
    fecha_entrega_diseno_real = case when p_estatus_nuevo = 'EN_REVISION_CM'::public.estatus_enum then now() else fecha_entrega_diseno_real end,
    fecha_aprobacion_gerencia = case when p_estatus_nuevo = 'APROBADO'::public.estatus_enum then now() else fecha_aprobacion_gerencia end,
    updated_at = now()
  where id = p_publicacion_id returning * into v_publicacion;

  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, motivo, cambiado_por)
  values (p_publicacion_id, v_estatus_anterior, p_estatus_nuevo, v_motivo, v_actor);

  if p_estatus_nuevo in ('EN_CORRECCION'::public.estatus_enum, 'CANCELADO'::public.estatus_enum) then
    insert into public.publicacion_comentarios (publicacion_id, autor_id, texto, tipo)
    values (p_publicacion_id, v_actor, v_motivo, case when p_estatus_nuevo = 'CANCELADO'::public.estatus_enum then 'MOTIVO_CANCELACION' else 'CORRECCION' end);
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
    and p.estatus in ('SOLICITADO'::public.estatus_enum, 'EN_DISENO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum)
  order by p.fecha_publicacion, p.created_at;
$$;

revoke all on function public.get_design_publication_queue() from public, anon;
grant execute on function public.get_design_publication_queue() to authenticated;

create or replace function public.claim_expired_publication_purges()
returns table (id uuid, drive_folder_id text, drive_folder_url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Solo el proceso interno puede reclamar purgas.';
  end if;
  update public.publicaciones p
    set drive_cleanup_status = 'ERROR',
        drive_cleanup_error = 'La ejecución programada se interrumpió; requiere resolución manual.',
        drive_cleanup_attempted_at = now()
  where p.drive_cleanup_status = 'PROCESANDO'
    and p.drive_cleanup_attempted_at < now() - interval '2 hours';
  return query
  with candidates as (
    select p.id from public.publicaciones p
    where p.deleted_at is not null
      and p.deleted_at <= now() - interval '1 month'
      and p.drive_cleanup_status = 'PENDIENTE'
    order by p.deleted_at
    limit 20
    for update skip locked
  )
  update public.publicaciones p
    set drive_cleanup_status = 'PROCESANDO',
        drive_cleanup_attempted_at = now(),
        drive_cleanup_error = null
  from candidates c
  where p.id = c.id
  returning p.id, p.drive_folder_id, p.drive_folder_url;
end;
$$;

revoke all on function public.claim_expired_publication_purges() from public, anon, authenticated;
grant execute on function public.claim_expired_publication_purges() to service_role;

create or replace function public.restore_archived_publication(p_publicacion_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('social-media')) or not (select public.has_permission('social-media.posts.restore')) then
    raise exception 'Solo Social Media puede restaurar publicaciones.';
  end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  perform set_config('app.publication_archive', 'restore', true);
  update public.publicaciones set deleted_at = null, drive_cleanup_status = 'PENDIENTE', drive_cleanup_error = null
  where id = p_publicacion_id and deleted_at > now() - interval '1 month'
    and drive_cleanup_status in ('PENDIENTE', 'ERROR');
  return found;
end;
$$;

revoke all on function public.restore_archived_publication(uuid) from public, anon;
grant execute on function public.restore_archived_publication(uuid) to authenticated;

create or replace function public.set_publication_hour(p_publicacion_id uuid, p_hora_publicacion time)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    (select public.has_permission('social-media.posts.create'))
    or (select public.has_permission('social-media.posts.edit'))
  ) then raise exception 'No tienes permiso para editar la hora de publicación.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  update public.publicaciones set hora_publicacion = p_hora_publicacion
  where id = p_publicacion_id and deleted_at is null;
  return found;
end;
$$;

revoke all on function public.set_publication_hour(uuid, time) from public, anon;
grant execute on function public.set_publication_hour(uuid, time) to authenticated;

create or replace function public.set_publication_production(
  p_publicacion_id uuid,
  p_requiere_rodaje boolean,
  p_fecha_rodaje date,
  p_sedes public.sede_enum[],
  p_prioridad smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fecha date;
begin
  if not (
    (select public.has_permission('social-media.posts.create'))
    or (select public.has_permission('social-media.posts.edit'))
  ) then raise exception 'No tienes permiso para editar los datos de producción.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  if p_prioridad not in (1, 2, 3) then raise exception 'La prioridad debe ser alta, normal o baja.'; end if;
  select case when p_requiere_rodaje then coalesce(p_fecha_rodaje, fecha_publicacion - 3) else null end
    into v_fecha from public.publicaciones where id = p_publicacion_id and deleted_at is null;
  if not found then return false; end if;
  update public.publicaciones set
    requiere_rodaje = p_requiere_rodaje,
    fecha_rodaje = v_fecha,
    sedes = coalesce(p_sedes, '{}'::public.sede_enum[]),
    prioridad = p_prioridad
  where id = p_publicacion_id and deleted_at is null;
  return found;
end;
$$;

revoke all on function public.set_publication_production(uuid, boolean, date, public.sede_enum[], smallint) from public, anon;
grant execute on function public.set_publication_production(uuid, boolean, date, public.sede_enum[], smallint) to authenticated;

commit;

notify pgrst, 'reload schema';
