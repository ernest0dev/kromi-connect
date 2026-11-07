-- Reconcile schema objects that were previously introduced only by ad hoc
-- import or database-editor scripts, not by a tracked migration.

create table if not exists public.inventory_import_batches (
  batch_key text primary key,
  source_name text not null,
  imported_at timestamptz not null default now(),
  imported_rows integer not null,
  source_rows integer not null
);

alter table public.inventory_import_batches enable row level security;
revoke all on public.inventory_import_batches from anon, authenticated;

create or replace function public.user_has_any_publication_account(
  p_publicacion_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.publicacion_canales pc
    join public.user_social_accounts usa
      on usa.social_account_id = pc.social_account_id
    where pc.publicacion_id = p_publicacion_id
      and usa.user_id = (select auth.uid())
  );
$$;

revoke all on function public.user_has_any_publication_account(uuid)
  from public, anon, authenticated;
grant execute on function public.user_has_any_publication_account(uuid)
  to authenticated;

create or replace function public.publicacion_acceso_cuentas(
  p_id uuid
)
returns table(total integer, asignadas integer, puede_editar boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (
    has_permission('social-media.posts.read')
    and user_has_any_publication_account(p_id)
  ) then
    return;
  end if;

  return query
  select
    count(*)::integer,
    count(*) filter (where usa.user_id is not null)::integer,
    user_has_all_publication_accounts(p_id)
  from publicacion_canales pc
  left join user_social_accounts usa
    on usa.social_account_id = pc.social_account_id
    and usa.user_id = auth.uid()
  where pc.publicacion_id = p_id;
end;
$$;

revoke all on function public.publicacion_acceso_cuentas(uuid)
  from public, anon;
grant execute on function public.publicacion_acceso_cuentas(uuid)
  to authenticated;

drop policy if exists publicacion_canales_delete_assigned
  on public.publicacion_canales;
create policy publicacion_canales_delete_assigned
  on public.publicacion_canales for delete to authenticated
  using (
    (select public.has_permission('social-media.posts.edit'))
    and exists (
      select 1
      from public.user_social_accounts usa
      where usa.social_account_id = publicacion_canales.social_account_id
        and usa.user_id = (select auth.uid())
    )
  );
