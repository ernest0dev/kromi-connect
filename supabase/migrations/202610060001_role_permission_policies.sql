-- RLS policies for the views currently assigned in app_permissions.
-- Migration 202610050001 seeds the current role_permissions rows.

begin;

-- Replace any existing API policies on these app tables so an older
-- permissive policy cannot combine with the permission-specific policies below.
do $$
declare
  table_name text;
  policy_record record;
  protected_tables text[] := array[
    'publicaciones', 'campanas', 'efemerides', 'campana_efemerides',
    'campana_evaluaciones', 'atencion_cliente', 'terceros',
    'publicacion_canales', 'checklist_rodaje', 'solicitudes_terceros',
    'inventario_premios', 'reporte_atencion_cliente'
  ];
begin
  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy %I on public.%I', policy_record.policyname, table_name);
      end loop;
    end if;
  end loop;
end;
$$;

alter table public.publicaciones enable row level security;
grant select, insert, update, delete on public.publicaciones to authenticated;

drop policy if exists "app_permissions_read_posts" on public.publicaciones;
create policy "app_permissions_read_posts"
  on public.publicaciones for select to authenticated
  using ((select public.has_permission('social-media.posts.read')));

drop policy if exists "app_permissions_create_posts" on public.publicaciones;
create policy "app_permissions_create_posts"
  on public.publicaciones for insert to authenticated
  with check ((select public.has_permission('social-media.posts.create')));

drop policy if exists "app_permissions_update_posts" on public.publicaciones;
create policy "app_permissions_update_posts"
  on public.publicaciones for update to authenticated
  using (
    (select public.has_permission('social-media.posts.edit'))
    or (select public.has_permission('social-media.posts.reschedule'))
    or (select public.has_permission('social-media.posts.status.update'))
  )
  with check (
    (select public.has_permission('social-media.posts.edit'))
    or (select public.has_permission('social-media.posts.reschedule'))
    or (select public.has_permission('social-media.posts.status.update'))
  );

drop policy if exists "app_permissions_delete_posts" on public.publicaciones;
create policy "app_permissions_delete_posts"
  on public.publicaciones for delete to authenticated
  using ((select public.has_permission('social-media.posts.delete')));


alter table public.campanas enable row level security;
grant select, insert, update on public.campanas to authenticated;

drop policy if exists "app_permissions_read_campaigns" on public.campanas;
create policy "app_permissions_read_campaigns"
  on public.campanas for select to authenticated
  using ((select public.has_permission('social-media.campaigns.read')));

drop policy if exists "app_permissions_create_campaigns" on public.campanas;
create policy "app_permissions_create_campaigns"
  on public.campanas for insert to authenticated
  with check ((select public.has_permission('social-media.campaigns.create')));

drop policy if exists "app_permissions_update_campaigns" on public.campanas;
create policy "app_permissions_update_campaigns"
  on public.campanas for update to authenticated
  using (
    (select public.has_permission('social-media.campaigns.update'))
    or (select public.has_permission('social-media.campaigns.status.update'))
    or (select public.has_permission('social-media.campaigns.archive'))
  )
  with check (
    (select public.has_permission('social-media.campaigns.update'))
    or (select public.has_permission('social-media.campaigns.status.update'))
    or (select public.has_permission('social-media.campaigns.archive'))
  );


alter table public.efemerides enable row level security;
grant select, insert, update, delete on public.efemerides to authenticated;

drop policy if exists "app_permissions_read_efemerides" on public.efemerides;
create policy "app_permissions_read_efemerides"
  on public.efemerides for select to authenticated
  using ((select public.has_permission('social-media.efemerides.read')));

drop policy if exists "app_permissions_create_efemerides" on public.efemerides;
create policy "app_permissions_create_efemerides"
  on public.efemerides for insert to authenticated
  with check ((select public.has_permission('social-media.efemerides.create')));

drop policy if exists "app_permissions_update_efemerides" on public.efemerides;
create policy "app_permissions_update_efemerides"
  on public.efemerides for update to authenticated
  using ((select public.has_permission('social-media.efemerides.update')))
  with check ((select public.has_permission('social-media.efemerides.update')));

drop policy if exists "app_permissions_delete_efemerides" on public.efemerides;
create policy "app_permissions_delete_efemerides"
  on public.efemerides for delete to authenticated
  using ((select public.has_permission('social-media.efemerides.delete')));


alter table public.campana_efemerides enable row level security;
grant select on public.campana_efemerides to authenticated;

-- The prior campaign migration added an allow-all policy for authenticated users.
drop policy if exists "Permitir todo a usuarios autenticados" on public.campana_efemerides;
drop policy if exists "app_permissions_read_campaign_efemerides" on public.campana_efemerides;
create policy "app_permissions_read_campaign_efemerides"
  on public.campana_efemerides for select to authenticated
  using (
    (select public.has_permission('social-media.campaigns.read'))
    or (select public.has_permission('social-media.efemerides.read'))
  );


alter table public.campana_evaluaciones enable row level security;
grant select, insert on public.campana_evaluaciones to authenticated;

drop policy if exists "app_permissions_read_campaign_evaluations" on public.campana_evaluaciones;
create policy "app_permissions_read_campaign_evaluations"
  on public.campana_evaluaciones for select to authenticated
  using ((select public.has_permission('social-media.campaigns.read')));

drop policy if exists "app_permissions_create_campaign_evaluations" on public.campana_evaluaciones;
create policy "app_permissions_create_campaign_evaluations"
  on public.campana_evaluaciones for insert to authenticated
  with check ((select public.has_permission('social-media.campaigns.evaluation.create')));


-- atencion_cliente remains enabled for RLS, its API privileges are revoked,
-- and no authenticated policy is created until a role receives explicit grants.

commit;
