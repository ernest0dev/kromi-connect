begin;

alter table public.publicaciones
  add column if not exists instrucciones_diseno text,
  add constraint publicaciones_instrucciones_diseno_length
    check (instrucciones_diseno is null or length(instrucciones_diseno) <= 4000);

comment on column public.publicaciones.instrucciones_diseno is
  'Instrucciones de Social Media para el trabajo del rol Design.';

create or replace function public.guard_publication_design_instructions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.instrucciones_diseno is distinct from old.instrucciones_diseno
    and coalesce(current_setting('app.publication_design_instructions', true), '') <> 'on' then
    raise exception 'Las instrucciones de Diseño deben cambiar mediante la acción autorizada.';
  end if;
  if new.estatus = 'SOLICITADO'::public.estatus_enum and new.requiere_diseno
    and nullif(trim(new.instrucciones_diseno), '') is null then
    raise exception 'Escribe las instrucciones para Diseño antes de solicitar la pieza.';
  end if;
  if new.estatus = 'EN_DISENO'::public.estatus_enum and old.estatus is distinct from new.estatus
    and new.disenador_id is null then
    new.disenador_id := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists guard_publication_design_instructions on public.publicaciones;
create trigger guard_publication_design_instructions
before update on public.publicaciones
for each row execute function public.guard_publication_design_instructions();
revoke all on function public.guard_publication_design_instructions() from public, anon, authenticated;

create or replace function public.set_publication_design_instructions(
  p_publicacion_id uuid,
  p_instrucciones text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_instrucciones text := nullif(trim(p_instrucciones), '');
begin
  if (select auth.uid()) is null
    or not (select public.has_role('social-media'))
    or not ((select public.has_permission('social-media.posts.create')) or (select public.has_permission('social-media.posts.edit'))) then
    raise exception 'Solo Social Media puede editar las instrucciones para Diseño.';
  end if;
  if v_instrucciones is not null and length(v_instrucciones) > 4000 then
    raise exception 'Las instrucciones no pueden superar 4000 caracteres.';
  end if;
  select * into v_publicacion from public.publicaciones
  where id = p_publicacion_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
    raise exception 'Las instrucciones solo se pueden editar en Brief o durante el rodaje.';
  end if;
  perform set_config('app.publication_design_instructions', 'on', true);
  update public.publicaciones set instrucciones_diseno = v_instrucciones, updated_at = now()
  where id = p_publicacion_id;
  return true;
end;
$$;
revoke all on function public.set_publication_design_instructions(uuid, text) from public, anon;
grant execute on function public.set_publication_design_instructions(uuid, text) to authenticated;

alter table public.publicacion_drive_uploads
  add column if not exists carpeta text not null default 'BRIEF'
    check (carpeta in ('BRIEF', 'ENTREGABLES'));
alter table public.publicacion_drive_uploads
  drop constraint if exists publicacion_drive_uploads_file_size_check;
alter table public.publicacion_drive_uploads
  add constraint publicacion_drive_uploads_file_size_check
    check (file_size > 0 and file_size <= 524288000);

create or replace function public.reserve_publication_brief_upload(
  p_actor_id uuid, p_publication_id uuid, p_file_name text, p_mime_type text, p_file_size bigint
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_upload_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr join public.role_permissions rp on rp.role_code = pr.role_code
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
   where publicacion_id = p_publication_id and carpeta = 'BRIEF' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at <= now();
  if (select drive_brief_file_count from public.publicaciones where id = p_publication_id)
     + (select count(*) from public.publicacion_drive_uploads where publicacion_id = p_publication_id and carpeta = 'BRIEF' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at > now()) >= 10 then
    raise exception 'El brief ya tiene 10 archivos o cargas reservadas.';
  end if;
  insert into public.publicacion_drive_uploads(publicacion_id,actor_id,file_name,mime_type,file_size,carpeta)
  values (p_publication_id,p_actor_id,p_file_name,p_mime_type,p_file_size,'BRIEF') returning id into v_upload_id;
  return v_upload_id;
end;
$$;
revoke all on function public.reserve_publication_brief_upload(uuid,uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.reserve_publication_brief_upload(uuid,uuid,text,text,bigint) to service_role;

insert into public.app_permissions(code, description)
values ('design.posts.upload', 'Subir entregables a Entregables') on conflict (code) do nothing;
insert into public.role_permissions(role_code, permission_code)
values ('design', 'design.posts.upload') on conflict do nothing;

create or replace function public.reserve_publication_deliverable_upload(
  p_actor_id uuid, p_publication_id uuid, p_file_name text, p_mime_type text, p_file_size bigint, p_drive_file_count integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_upload_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'design' and rp.permission_code = 'design.posts.upload'
  ) then raise exception 'Solo Diseño puede subir entregables.'; end if;
  if p_file_size <= 0 or p_file_size > 524288000 then raise exception 'El archivo debe pesar hasta 500 MB.'; end if;
  if p_drive_file_count < 0 or p_drive_file_count > 20 then raise exception 'Conteo de entregables inválido.'; end if;
  perform 1 from public.publicaciones where id = p_publication_id and deleted_at is null and requiere_diseno and estatus = 'EN_DISENO'::public.estatus_enum for update;
  if not found then raise exception 'La solicitud no está activa en Diseño.'; end if;
  update public.publicacion_drive_uploads set status = 'EXPIRED', session_uri = null
   where publicacion_id = p_publication_id and carpeta = 'ENTREGABLES' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at <= now();
  if p_drive_file_count + (select count(*) from public.publicacion_drive_uploads where publicacion_id = p_publication_id and carpeta = 'ENTREGABLES' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at > now()) >= 20 then
    raise exception 'Entregables ya tiene 20 archivos o cargas reservadas.';
  end if;
  insert into public.publicacion_drive_uploads(publicacion_id,actor_id,file_name,mime_type,file_size,carpeta)
  values (p_publication_id,p_actor_id,p_file_name,p_mime_type,p_file_size,'ENTREGABLES') returning id into v_upload_id;
  return v_upload_id;
end;
$$;
revoke all on function public.reserve_publication_deliverable_upload(uuid,uuid,text,text,bigint,integer) from public, anon, authenticated;
grant execute on function public.reserve_publication_deliverable_upload(uuid,uuid,text,text,bigint,integer) to service_role;

create or replace function public.design_can_see_publication(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select public.has_permission('design.posts.read')) and exists (
    select 1 from public.publicaciones p where p.id = p_id and p.deleted_at is null and p.requiere_diseno and (
      p.estatus in ('SOLICITADO'::public.estatus_enum,'EN_DISENO'::public.estatus_enum,'EN_CORRECCION'::public.estatus_enum)
      or p.estatus in ('EN_REVISION_CM'::public.estatus_enum,'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum,'APROBADO'::public.estatus_enum,'PROGRAMADO'::public.estatus_enum,'PUBLICADO'::public.estatus_enum)
      or (p.estatus = 'CANCELADO'::public.estatus_enum and exists (select 1 from public.publicacion_estatus_historial h where h.publicacion_id=p.id and h.estatus_nuevo='SOLICITADO'::public.estatus_enum))
    )
  );
$$;
revoke all on function public.design_can_see_publication(uuid) from public, anon, authenticated;

create or replace function public.get_design_publication_history(p_limit integer default 50, p_offset integer default 0)
returns setof public.publicaciones language sql stable security definer set search_path = '' as $$
  select p.* from public.publicaciones p
  where (select public.has_permission('design.posts.read')) and p.deleted_at is null and p.requiere_diseno
    and (p.estatus in ('EN_REVISION_CM'::public.estatus_enum,'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum,'APROBADO'::public.estatus_enum,'PROGRAMADO'::public.estatus_enum,'PUBLICADO'::public.estatus_enum)
      or (p.estatus='CANCELADO'::public.estatus_enum and exists (select 1 from public.publicacion_estatus_historial h where h.publicacion_id=p.id and h.estatus_nuevo='SOLICITADO'::public.estatus_enum))
    )
  order by coalesce(p.fecha_entrega_diseno_real,p.updated_at) desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
$$;
revoke all on function public.get_design_publication_history(integer,integer) from public, anon;
grant execute on function public.get_design_publication_history(integer,integer) to authenticated;

create or replace function public.get_design_publication_comments(p_ids uuid[])
returns table(id uuid, publicacion_id uuid, texto text, tipo text, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,c.publicacion_id,c.texto,c.tipo,c.creado_en from public.publicacion_comentarios c
  where cardinality(coalesce(p_ids,'{}'::uuid[])) <= 100 and c.publicacion_id = any(coalesce(p_ids,'{}'::uuid[]))
    and public.design_can_see_publication(c.publicacion_id)
    and (c.tipo in ('CORRECCION','COMENTARIO') or (c.tipo='MOTIVO_CANCELACION' and exists (select 1 from public.publicaciones p where p.id=c.publicacion_id and p.estatus='CANCELADO'::public.estatus_enum)));
$$;
revoke all on function public.get_design_publication_comments(uuid[]) from public, anon;
grant execute on function public.get_design_publication_comments(uuid[]) to authenticated;

create or replace function public.get_publication_designer_names(p_ids uuid[])
returns table(publicacion_id uuid, disenador_id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
declare v_social boolean := (select public.has_permission('social-media.posts.read'));
begin
  if not (select public.has_permission('design.posts.read')) and not v_social then raise exception 'No tienes permiso para consultar diseñadores.'; end if;
  return query select p.id,p.disenador_id,pr.full_name from public.publicaciones p join public.profiles pr on pr.user_id=p.disenador_id
    where p.id=any(coalesce(p_ids,'{}'::uuid[])) and cardinality(coalesce(p_ids,'{}'::uuid[]))<=100
      and ((select public.has_permission('design.posts.read')) and public.design_can_see_publication(p.id)
        or (v_social and (select public.user_has_all_publication_accounts(p.id))));
end;
$$;
revoke all on function public.get_publication_designer_names(uuid[]) from public, anon;
grant execute on function public.get_publication_designer_names(uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
