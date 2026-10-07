begin;

-- Users may mutate publication-level fields only if they own every destination.
create or replace function public.user_has_all_publication_accounts(p_publicacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.publicacion_canales pc
      where pc.publicacion_id = p_publicacion_id
        and pc.social_account_id is not null
    )
    and not exists (
      select 1
      from public.publicacion_canales pc
      where pc.publicacion_id = p_publicacion_id
        and pc.social_account_id is not null
        and not exists (
          select 1 from public.user_social_accounts usa
          where usa.social_account_id = pc.social_account_id
            and usa.user_id = (select auth.uid())
        )
    );
$$;

revoke all on function public.user_has_all_publication_accounts(uuid)
  from public, anon, authenticated;
grant execute on function public.user_has_all_publication_accounts(uuid)
  to authenticated;

-- The existing category replacement function was restricted to service_role.
-- Make it an invoker function so authenticated actions remain subject to RLS.
create or replace function public.replace_publicacion_categorias(
  p_publicacion_id uuid,
  p_categoria_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'La publicación no existe o no está asignada a una cuenta accesible.';
  end if;

  if coalesce(array_length(p_categoria_ids, 1), 0) <> (
    select count(distinct selected.category_id)
    from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id)
  ) then
    raise exception 'La selección de categorías contiene duplicados.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id)
    left join public.categorias_contenido category on category.id = selected.category_id
    where category.id is null
  ) then
    raise exception 'La selección contiene una categoría inválida.';
  end if;

  delete from public.publicacion_categorias
  where publicacion_id = p_publicacion_id;

  insert into public.publicacion_categorias (publicacion_id, categoria_id)
  select p_publicacion_id, selected.category_id
  from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id);
end;
$$;

revoke all on function public.replace_publicacion_categorias(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.replace_publicacion_categorias(uuid, uuid[])
  to authenticated;

alter table public.publicacion_categorias enable row level security;
revoke all on public.publicacion_categorias from anon, authenticated;
grant select, insert, delete on public.publicacion_categorias to authenticated;

drop policy if exists app_permissions_read_content_categories on public.categorias_contenido;
create policy app_permissions_read_content_categories
  on public.categorias_contenido for select to authenticated
  using (
    (select public.has_permission('social-media.posts.read'))
    or (select public.has_permission('social-media.posts.create'))
    or (select public.has_permission('social-media.posts.edit'))
    or (select public.has_permission('social-media.shooting.read'))
  );

drop policy if exists app_permissions_read_post_categories on public.publicacion_categorias;
create policy app_permissions_read_post_categories
  on public.publicacion_categorias for select to authenticated
  using (
    (
      (select public.has_permission('social-media.posts.read'))
      or (select public.has_permission('social-media.shooting.read'))
    )
    and exists (
      select 1
      from public.publicacion_canales pc
      join public.user_social_accounts usa
        on usa.social_account_id = pc.social_account_id
      where pc.publicacion_id = publicacion_categorias.publicacion_id
        and usa.user_id = (select auth.uid())
    )
  );

drop policy if exists app_permissions_create_post_categories on public.publicacion_categorias;
create policy app_permissions_create_post_categories
  on public.publicacion_categorias for insert to authenticated
  with check (
    (
      (select public.has_permission('social-media.posts.create'))
      or (select public.has_permission('social-media.posts.edit'))
    )
    and (select public.user_has_all_publication_accounts(publicacion_categorias.publicacion_id))
  );

drop policy if exists app_permissions_delete_post_categories on public.publicacion_categorias;
create policy app_permissions_delete_post_categories
  on public.publicacion_categorias for delete to authenticated
  using (
    (select public.has_permission('social-media.posts.edit'))
    and (select public.user_has_all_publication_accounts(publicacion_categorias.publicacion_id))
  );

-- Prevent authenticated API writes from creating a new publication without
-- assigning at least one account in the same database transaction.
create or replace function public.assert_publicacion_has_social_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication_ids uuid[];
  v_publication_id uuid;
begin
  if tg_table_name = 'publicaciones' then
    v_publication_ids := array[new.id];
  elsif tg_op = 'INSERT' then
    v_publication_ids := array[new.publicacion_id];
  elsif tg_op = 'DELETE' then
    v_publication_ids := array[old.publicacion_id];
  else
    v_publication_ids := array[old.publicacion_id, new.publicacion_id];
  end if;

  foreach v_publication_id in array v_publication_ids loop
    if exists (select 1 from public.publicaciones p where p.id = v_publication_id)
      and not exists (
        select 1 from public.publicacion_canales pc
        where pc.publicacion_id = v_publication_id
          and pc.social_account_id is not null
      ) then
      raise exception 'Toda publicación debe conservar al menos una cuenta social destino.';
    end if;
  end loop;

  if tg_table_name = 'publicaciones' then
    -- The branch above validates the row inserted into publicaciones.
    return null;
  end if;
  return null;
end;
$$;

drop trigger if exists publicaciones_require_social_account on public.publicaciones;
create constraint trigger publicaciones_require_social_account
  after insert on public.publicaciones
  deferrable initially deferred
  for each row execute function public.assert_publicacion_has_social_account();

drop trigger if exists publicacion_canales_preserve_social_account on public.publicacion_canales;
create constraint trigger publicacion_canales_preserve_social_account
  after insert or update or delete on public.publicacion_canales
  deferrable initially deferred
  for each row execute function public.assert_publicacion_has_social_account();

revoke all on function public.assert_publicacion_has_social_account() from public, anon, authenticated;

-- Atomic create: publication, account destinations, and categories share one
-- authenticated PostgREST transaction and remain subject to each table's RLS.
create or replace function public.create_publicacion_with_relations(
  p_titulo text,
  p_formato public.formato_enum,
  p_fecha_publicacion date,
  p_campana_id uuid,
  p_fecha_limite_brief date,
  p_hook_texto text,
  p_body_texto text,
  p_cta_texto text,
  p_hashtags text[],
  p_drive_folder_id text,
  p_drive_folder_url text,
  p_social_account_ids uuid[],
  p_categoria_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_publicacion_id uuid := gen_random_uuid();
  v_account_count integer;
begin
  if coalesce(cardinality(p_social_account_ids), 0) = 0 then
    raise exception 'Selecciona al menos una cuenta social destino.';
  end if;

  select count(distinct sa.id) into v_account_count
  from public.social_accounts sa
  join public.user_social_accounts usa on usa.social_account_id = sa.id
  where sa.id = any(p_social_account_ids)
    and sa.active
    and usa.user_id = (select auth.uid());

  if v_account_count <> cardinality(p_social_account_ids) then
    raise exception 'Una o más cuentas no están activas o asignadas al usuario.';
  end if;

  insert into public.publicaciones (
    id, titulo, formato, fecha_publicacion, campana_id, fecha_limite_brief,
    hook_texto, body_texto, cta_texto, hashtags, estatus, creador_id,
    drive_folder_id, drive_folder_url
  ) values (
    v_publicacion_id, p_titulo, p_formato, p_fecha_publicacion, p_campana_id, p_fecha_limite_brief,
    case when p_formato = 'STORY'::public.formato_enum then null else p_hook_texto end,
    case when p_formato = 'STORY'::public.formato_enum then null else p_body_texto end,
    case when p_formato = 'STORY'::public.formato_enum then null else p_cta_texto end,
    case when p_formato = 'STORY'::public.formato_enum then null else p_hashtags end,
    'PENDIENTE_BRIEF'::public.estatus_enum, (select auth.uid()),
    p_drive_folder_id, p_drive_folder_url
  );

  insert into public.publicacion_canales (publicacion_id, canal, social_account_id)
  select v_publicacion_id, sa.platform, sa.id
  from public.social_accounts sa
  where sa.id = any(p_social_account_ids);

  perform public.replace_publicacion_categorias(v_publicacion_id, p_categoria_ids);
  select * into v_publicacion
  from public.publicaciones
  where id = v_publicacion_id;
  return to_jsonb(v_publicacion);
end;
$$;

revoke all on function public.create_publicacion_with_relations(
  text, public.formato_enum, date, uuid, date, text, text, text, text[], text, text, uuid[], uuid[]
) from public, anon, authenticated;
grant execute on function public.create_publicacion_with_relations(
  text, public.formato_enum, date, uuid, date, text, text, text, text[], text, text, uuid[], uuid[]
) to authenticated;

-- Atomic edit of the publication and the destinations visible to this user.
create or replace function public.update_publicacion_with_relations(
  p_publicacion_id uuid,
  p_titulo text,
  p_formato public.formato_enum,
  p_fecha_publicacion date,
  p_campana_id uuid,
  p_fecha_solicitud_diseno timestamptz,
  p_fecha_entrega_diseno_real timestamptz,
  p_fecha_aprobacion_gerencia timestamptz,
  p_estatus public.estatus_enum,
  p_hook_texto text,
  p_body_texto text,
  p_cta_texto text,
  p_hashtags text[],
  p_fecha_limite_brief date,
  p_fecha_entrega_diseno_estimada date,
  p_social_account_ids uuid[],
  p_categoria_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_account_count integer;
begin
  if coalesce(cardinality(p_social_account_ids), 0) = 0 then
    raise exception 'Selecciona al menos una cuenta social destino.';
  end if;

  select count(distinct sa.id) into v_account_count
  from public.social_accounts sa
  join public.user_social_accounts usa on usa.social_account_id = sa.id
  where sa.id = any(p_social_account_ids)
    and (
      sa.active
      or exists (
        select 1 from public.publicacion_canales existing
        where existing.publicacion_id = p_publicacion_id
          and existing.social_account_id = sa.id
      )
    )
    and usa.user_id = (select auth.uid());

  if v_account_count <> cardinality(p_social_account_ids) then
    raise exception 'Una o más cuentas no están activas o asignadas al usuario.';
  end if;

  update public.publicaciones
  set titulo = p_titulo,
      formato = p_formato,
      fecha_publicacion = p_fecha_publicacion,
      campana_id = p_campana_id,
      fecha_solicitud_diseno = p_fecha_solicitud_diseno,
      fecha_entrega_diseno_real = p_fecha_entrega_diseno_real,
      fecha_aprobacion_gerencia = p_fecha_aprobacion_gerencia,
      estatus = p_estatus,
      hook_texto = case when p_formato = 'STORY'::public.formato_enum then hook_texto else p_hook_texto end,
      body_texto = case when p_formato = 'STORY'::public.formato_enum then body_texto else p_body_texto end,
      cta_texto = case when p_formato = 'STORY'::public.formato_enum then cta_texto else p_cta_texto end,
      hashtags = case when p_formato = 'STORY'::public.formato_enum then hashtags else p_hashtags end,
      fecha_limite_brief = coalesce(p_fecha_limite_brief, fecha_limite_brief),
      fecha_entrega_diseno_estimada = coalesce(p_fecha_entrega_diseno_estimada, fecha_entrega_diseno_estimada),
      updated_at = now()
  where id = p_publicacion_id
  returning * into v_publicacion;

  if not found then
    raise exception 'La publicación no existe o no está asignada a una cuenta accesible.';
  end if;

  delete from public.publicacion_canales pc
  where pc.publicacion_id = p_publicacion_id
    and not (pc.social_account_id = any(p_social_account_ids))
    and exists (
      select 1 from public.user_social_accounts usa
      where usa.social_account_id = pc.social_account_id
        and usa.user_id = (select auth.uid())
    );

  insert into public.publicacion_canales (publicacion_id, canal, social_account_id)
  select p_publicacion_id, sa.platform, sa.id
  from public.social_accounts sa
  where sa.id = any(p_social_account_ids)
    and not exists (
      select 1 from public.publicacion_canales existing
      where existing.publicacion_id = p_publicacion_id
        and existing.social_account_id = sa.id
    );

  perform public.replace_publicacion_categorias(p_publicacion_id, p_categoria_ids);
  return to_jsonb(v_publicacion);
end;
$$;

revoke all on function public.update_publicacion_with_relations(
  uuid, text, public.formato_enum, date, uuid, timestamptz, timestamptz, timestamptz,
  public.estatus_enum, text, text, text, text[], date, date, uuid[], uuid[]
) from public, anon, authenticated;
grant execute on function public.update_publicacion_with_relations(
  uuid, text, public.formato_enum, date, uuid, timestamptz, timestamptz, timestamptz,
  public.estatus_enum, text, text, text, text[], date, date, uuid[], uuid[]
) to authenticated;

-- Editing destination rows also requires INSERT permission on those rows.
drop policy if exists publicacion_canales_insert_assigned on public.publicacion_canales;
drop policy if exists publicacion_canales_read_assigned on public.publicacion_canales;
create policy publicacion_canales_read_assigned
  on public.publicacion_canales for select to authenticated
  using (
    (
      (select public.has_permission('social-media.posts.read'))
      or (select public.has_permission('social-media.posts.create'))
      or (select public.has_permission('social-media.posts.edit'))
      or (select public.has_permission('social-media.shooting.read'))
    )
    and exists (
      select 1 from public.user_social_accounts usa
      where usa.social_account_id = publicacion_canales.social_account_id
        and usa.user_id = (select auth.uid())
    )
  );

create policy publicacion_canales_insert_assigned
  on public.publicacion_canales for insert to authenticated
  with check (
    (
      (select public.has_permission('social-media.posts.create'))
      or (select public.has_permission('social-media.posts.edit'))
    )
    and exists (
      select 1
      from public.user_social_accounts usa
      join public.social_accounts sa on sa.id = usa.social_account_id
      where usa.social_account_id = publicacion_canales.social_account_id
        and sa.platform = publicacion_canales.canal
        and sa.active
        and usa.user_id = (select auth.uid())
    )
  );

drop policy if exists publicacion_canales_update_assigned on public.publicacion_canales;
create policy publicacion_canales_update_assigned
  on public.publicacion_canales for update to authenticated
  using (
    (select public.has_permission('social-media.posts.edit'))
    and exists (
      select 1
      from public.user_social_accounts usa
      where usa.social_account_id = publicacion_canales.social_account_id
        and usa.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.has_permission('social-media.posts.edit'))
    and exists (
      select 1
      from public.user_social_accounts usa
      join public.social_accounts sa on sa.id = usa.social_account_id
      where usa.social_account_id = publicacion_canales.social_account_id
        and usa.user_id = (select auth.uid())
        and sa.platform = publicacion_canales.canal
    )
  );

-- Shooting staff need account-scoped reads and status updates as well.
drop policy if exists app_permissions_read_posts on public.publicaciones;
create policy app_permissions_read_posts
  on public.publicaciones for select to authenticated
  using (
    (
      (select public.has_permission('social-media.posts.read'))
      or (select public.has_permission('social-media.shooting.read'))
      or (select public.has_permission('social-media.posts.create'))
      or (select public.has_permission('social-media.posts.edit'))
    )
    and exists (
      select 1
      from public.publicacion_canales pc
      join public.user_social_accounts usa
        on usa.social_account_id = pc.social_account_id
      where pc.publicacion_id = publicaciones.id
        and usa.user_id = (select auth.uid())
    )
  );

drop policy if exists app_permissions_update_posts on public.publicaciones;
create policy app_permissions_update_posts
  on public.publicaciones for update to authenticated
  using (
    (
      (select public.has_permission('social-media.posts.edit'))
      or (select public.has_permission('social-media.posts.reschedule'))
      or (select public.has_permission('social-media.posts.status.update'))
      or (select public.has_permission('social-media.shooting.status.update'))
    )
    and (select public.user_has_all_publication_accounts(publicaciones.id))
  )
  with check (
    (
      (select public.has_permission('social-media.posts.edit'))
      or (select public.has_permission('social-media.posts.reschedule'))
      or (select public.has_permission('social-media.posts.status.update'))
      or (select public.has_permission('social-media.shooting.status.update'))
    )
    and (select public.user_has_all_publication_accounts(publicaciones.id))
  );

drop policy if exists app_permissions_delete_posts on public.publicaciones;
create policy app_permissions_delete_posts
  on public.publicaciones for delete to authenticated
  using (
    (select public.has_permission('social-media.posts.delete'))
    and (select public.user_has_all_publication_accounts(publicaciones.id))
  );

commit;

notify pgrst, 'reload schema';
