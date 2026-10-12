begin;

alter table public.publicaciones
  add column if not exists drive_brief_folder_id text,
  add column if not exists drive_deliverables_folder_id text,
  add column if not exists drive_brief_file_count integer not null default 0,
  add column if not exists drive_brief_checked_at timestamptz;

create table if not exists public.publicacion_drive_uploads (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  session_uri text,
  status text not null default 'RESERVING' check (status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING','CANCELLED','EXPIRED')),
  drive_file_id text,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint publicacion_drive_uploads_session_uri_safe check (session_uri is null or session_uri like 'https://www.googleapis.com/upload/drive/%')
);

create index if not exists publicacion_drive_uploads_active_idx
  on public.publicacion_drive_uploads(publicacion_id, expires_at)
  where status in ('RESERVING','UPLOADING','CANCEL_PENDING');

alter table public.publicacion_drive_uploads enable row level security;
revoke all on public.publicacion_drive_uploads from anon, authenticated;
grant all on public.publicacion_drive_uploads to service_role;

create or replace function public.guard_publication_drive_brief_sync()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.drive_brief_folder_id is distinct from old.drive_brief_folder_id
    or new.drive_deliverables_folder_id is distinct from old.drive_deliverables_folder_id
    or new.drive_brief_file_count is distinct from old.drive_brief_file_count
    or new.drive_brief_checked_at is distinct from old.drive_brief_checked_at)
    and coalesce((select auth.role()),'') <> 'service_role' then
    raise exception 'El estado sincronizado de Drive solo puede cambiar desde el servidor.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_publication_drive_brief_sync on public.publicaciones;
create trigger guard_publication_drive_brief_sync before update on public.publicaciones
for each row execute function public.guard_publication_drive_brief_sync();
revoke all on function public.guard_publication_drive_brief_sync() from public, anon, authenticated;

create or replace function public.sync_publication_drive_brief(
  p_publication_id uuid,
  p_brief_folder_id text,
  p_deliverables_folder_id text,
  p_file_count integer
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if p_file_count < 0 or p_file_count > 10 then raise exception 'Conteo de archivos inválido.'; end if;
  update public.publicaciones set
    drive_brief_folder_id = coalesce(p_brief_folder_id, drive_brief_folder_id),
    drive_deliverables_folder_id = coalesce(p_deliverables_folder_id, drive_deliverables_folder_id),
    drive_brief_file_count = p_file_count,
    drive_brief_checked_at = now()
  where id = p_publication_id and deleted_at is null;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
end;
$$;
revoke all on function public.sync_publication_drive_brief(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.sync_publication_drive_brief(uuid,text,text,integer) to service_role;

create or replace function public.reserve_publication_brief_upload(
  p_actor_id uuid, p_publication_id uuid, p_file_name text, p_mime_type text, p_file_size bigint
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_upload_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr
    join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'social-media' and rp.permission_code = 'social-media.posts.edit'
  ) then raise exception 'Solo Social Media puede subir archivos al brief.'; end if;
  if exists (select 1 from public.publicacion_canales pc where pc.publicacion_id=p_publication_id and not exists (select 1 from public.user_social_accounts usa where usa.social_account_id=pc.social_account_id and usa.user_id=p_actor_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;
  if p_file_name !~* '\.(jpg|jpeg|png|webp|pdf|mp4)$' or p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') then
    raise exception 'Tipo de archivo no permitido.';
  end if;
  if p_file_size <= 0 or p_file_size > 104857600 then raise exception 'El archivo debe pesar hasta 100 MB.'; end if;
  perform 1 from public.publicaciones where id = p_publication_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  update public.publicacion_drive_uploads set status = 'EXPIRED', session_uri = null
   where publicacion_id = p_publication_id and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at <= now();
  if (select drive_brief_file_count from public.publicaciones where id = p_publication_id)
     + (select count(*) from public.publicacion_drive_uploads where publicacion_id = p_publication_id and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at > now()) >= 10 then
    raise exception 'El brief ya tiene 10 archivos o cargas reservadas.';
  end if;
  insert into public.publicacion_drive_uploads(publicacion_id,actor_id,file_name,mime_type,file_size)
  values (p_publication_id,p_actor_id,p_file_name,p_mime_type,p_file_size) returning id into v_upload_id;
  return v_upload_id;
end;
$$;
revoke all on function public.reserve_publication_brief_upload(uuid,uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.reserve_publication_brief_upload(uuid,uuid,text,text,bigint) to service_role;

create or replace function public.request_publication_to_design(p_publication_id uuid, p_actor_id uuid)
returns public.publicaciones
language plpgsql security definer set search_path = '' as $$
declare v_publicacion public.publicaciones%rowtype; v_previous public.estatus_enum;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'social-media' and rp.permission_code = 'social-media.posts.status.update'
  ) then raise exception 'Solo Social Media puede solicitar diseño.'; end if;
  if exists (select 1 from public.publicacion_canales pc where pc.publicacion_id=p_publication_id and not exists (select 1 from public.user_social_accounts usa where usa.social_account_id=pc.social_account_id and usa.user_id=p_actor_id)) then raise exception 'No tienes acceso a todas las cuentas destino.'; end if;
  select * into v_publicacion from public.publicaciones where id = p_publication_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum,'EN_RODAJE'::public.estatus_enum) then raise exception 'La publicación ya no está pendiente de solicitar.'; end if;
  if v_publicacion.drive_brief_file_count < 1 or v_publicacion.drive_brief_checked_at is null or v_publicacion.drive_brief_checked_at < now() - interval '5 minutes' then raise exception 'El brief debe contener archivos verificados recientemente.'; end if;
  v_previous := v_publicacion.estatus;
  perform set_config('app.publication_transition', 'on', true);
  update public.publicaciones set estatus = 'SOLICITADO'::public.estatus_enum,
    fecha_solicitud_diseno = now(), fecha_limite_brief = fecha_publicacion - 5,
    fecha_entrega_diseno_estimada = ((now() at time zone 'America/Caracas')::date + 2), updated_at = now()
  where id = p_publicacion_id returning * into v_publicacion;
  insert into public.publicacion_estatus_historial(publicacion_id,estatus_anterior,estatus_nuevo,cambiado_por)
  values (p_publicacion_id,v_previous,'SOLICITADO'::public.estatus_enum,p_actor_id);
  return v_publicacion;
end;
$$;
revoke all on function public.request_publication_to_design(uuid,uuid) from public, anon, authenticated;
grant execute on function public.request_publication_to_design(uuid,uuid) to service_role;

create or replace function public.transition_publicacion_status(p_publicacion_id uuid,p_estatus_nuevo public.estatus_enum,p_motivo text default null)
returns public.publicaciones language plpgsql security definer set search_path = '' as $$
declare
  v_publicacion public.publicaciones%rowtype; v_actor uuid := (select auth.uid());
  v_social boolean := (select public.has_permission('social-media.posts.status.update'));
  v_design boolean := (select public.has_permission('design.posts.read'));
  v_motivo text := nullif(trim(p_motivo),''); v_old public.estatus_enum; v_allowed boolean := false;
begin
  if v_actor is null then raise exception 'Inicia sesión para continuar.'; end if;
  if p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum then raise exception 'Usa la solicitud validada de brief.'; end if;
  select * into v_publicacion from public.publicaciones where id=p_publicacion_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  v_old := v_publicacion.estatus;
  if not v_design and not (select public.user_has_all_publication_accounts(p_publicacion_id)) then raise exception 'No tienes acceso a todas las cuentas destino.'; end if;
  if p_estatus_nuevo='CANCELADO'::public.estatus_enum then
    if not v_social or not (select public.has_role('social-media')) then raise exception 'Solo Social Media puede cancelar publicaciones.'; end if;
    if v_motivo is null then raise exception 'Indica el motivo de cancelación.'; end if;
    v_allowed := v_old <> 'CANCELADO'::public.estatus_enum;
  elsif v_design then
    if p_estatus_nuevo='EN_DISENO'::public.estatus_enum then v_allowed := v_old in ('SOLICITADO'::public.estatus_enum,'EN_CORRECCION'::public.estatus_enum) and (select public.has_permission('design.posts.start'));
    elsif p_estatus_nuevo='EN_REVISION_CM'::public.estatus_enum then v_allowed := v_old='EN_DISENO'::public.estatus_enum and (select public.has_permission('design.posts.deliver')); end if;
  elsif v_social then
    v_allowed := (p_estatus_nuevo='PENDIENTE_BRIEF'::public.estatus_enum and v_old='SOLICITADO'::public.estatus_enum)
      or (p_estatus_nuevo='EN_RODAJE'::public.estatus_enum and v_old='PENDIENTE_BRIEF'::public.estatus_enum)
      or (p_estatus_nuevo='EN_CORRECCION'::public.estatus_enum and v_old='EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo='PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum and v_old='EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo in ('PROGRAMADO'::public.estatus_enum,'PUBLICADO'::public.estatus_enum) and v_old in ('EN_REVISION_CM'::public.estatus_enum,'APROBADO'::public.estatus_enum))
      or (p_estatus_nuevo='APROBADO'::public.estatus_enum and v_old='PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum)
      or (p_estatus_nuevo='PUBLICADO'::public.estatus_enum and v_old='PROGRAMADO'::public.estatus_enum);
    if p_estatus_nuevo='EN_CORRECCION'::public.estatus_enum and v_motivo is null then raise exception 'Indica las correcciones solicitadas.'; end if;
  end if;
  if not v_allowed then raise exception 'La transición de estado no está permitida.'; end if;
  perform set_config('app.publication_transition','on',true);
  update public.publicaciones set estatus=p_estatus_nuevo,
    fecha_solicitud_diseno=case when p_estatus_nuevo='PENDIENTE_BRIEF'::public.estatus_enum then null else fecha_solicitud_diseno end,
    fecha_entrega_diseno_estimada=case when p_estatus_nuevo='PENDIENTE_BRIEF'::public.estatus_enum then null else fecha_entrega_diseno_estimada end,
    fecha_entrega_diseno_real=case when p_estatus_nuevo='EN_REVISION_CM'::public.estatus_enum then now() else fecha_entrega_diseno_real end,
    fecha_aprobacion_gerencia=case when p_estatus_nuevo='APROBADO'::public.estatus_enum then now() else fecha_aprobacion_gerencia end,
    updated_at=now() where id=p_publicacion_id returning * into v_publicacion;
  insert into public.publicacion_estatus_historial(publicacion_id,estatus_anterior,estatus_nuevo,motivo,cambiado_por) values(p_publicacion_id,v_old,p_estatus_nuevo,v_motivo,v_actor);
  if p_estatus_nuevo in ('EN_CORRECCION'::public.estatus_enum,'CANCELADO'::public.estatus_enum) then
    insert into public.publicacion_comentarios(publicacion_id,autor_id,texto,tipo) values(p_publicacion_id,v_actor,v_motivo,case when p_estatus_nuevo='CANCELADO'::public.estatus_enum then 'MOTIVO_CANCELACION' else 'CORRECCION' end);
  end if;
  return v_publicacion;
end;
$$;

notify pgrst, 'reload schema';
commit;
