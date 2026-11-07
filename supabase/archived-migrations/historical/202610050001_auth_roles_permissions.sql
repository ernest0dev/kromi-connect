-- Application profiles and permission catalog for Supabase Auth users.
-- Public signup remains disabled; new profiles default to pending.

begin;

create table if not exists public.app_roles (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.app_roles (code, name)
values
  ('pending', 'Pendiente'),
  ('social-media', 'Social Media'),
  ('events', 'Eventos'),
  ('design', 'Diseño'),
  ('internal', 'Interno'),
  ('customer-support', 'Atención al cliente'),
  ('management', 'Gerencia'),
  ('admin', 'Administrador')
on conflict (code) do update set name = excluded.name;

create table if not exists public.app_permissions (
  code text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_code text not null references public.app_roles(code) on delete cascade,
  permission_code text not null references public.app_permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_code, permission_code)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role_code text not null default 'pending' references public.app_roles(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;

revoke all on public.app_roles from anon, authenticated;
revoke all on public.app_permissions from anon, authenticated;
revoke all on public.role_permissions from anon, authenticated;
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role_code = required_role
  );
$$;

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_code = p.role_code
    where p.user_id = (select auth.uid())
      and rp.permission_code = required_permission
  );
$$;

create or replace function public.can_manage_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

revoke all on function public.has_role(text) from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.can_manage_access() from public;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_manage_access() to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Access admins can read all profiles" on public.profiles;
create policy "Access admins can read all profiles"
  on public.profiles for select to authenticated
  using ((select public.can_manage_access()));

drop policy if exists "Access admins can update profiles" on public.profiles;
create policy "Access admins can update profiles"
  on public.profiles for update to authenticated
  using ((select public.can_manage_access()))
  with check ((select public.can_manage_access()));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, role_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

insert into public.profiles (user_id, full_name, role_code)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), 'pending'
from auth.users
on conflict (user_id) do nothing;

insert into public.app_permissions (code, description)
values
  ('social-media.grid.read', 'Consultar la vista Grid'),
  ('social-media.posts.read', 'Consultar publicaciones de Grid'),
  ('social-media.posts.create', 'Crear publicaciones desde Grid'),
  ('social-media.posts.edit', 'Editar publicaciones desde Grid'),
  ('social-media.posts.reschedule', 'Reprogramar publicaciones desde Grid'),
  ('social-media.posts.status.update', 'Cambiar el estado de publicaciones desde Grid'),
  ('social-media.posts.delete', 'Eliminar publicaciones desde Grid'),
  ('social-media.campaigns.read', 'Consultar campañas'),
  ('social-media.campaigns.create', 'Crear campañas'),
  ('social-media.campaigns.update', 'Editar campañas'),
  ('social-media.campaigns.status.update', 'Cambiar el estado de campañas'),
  ('social-media.campaigns.archive', 'Archivar y restaurar campañas'),
  ('social-media.campaigns.evaluation.create', 'Registrar evaluaciones de campañas'),
  ('social-media.efemerides.read', 'Consultar efemérides'),
  ('social-media.efemerides.create', 'Crear efemérides'),
  ('social-media.efemerides.update', 'Editar efemérides'),
  ('social-media.efemerides.delete', 'Eliminar efemérides')
on conflict (code) do update set description = excluded.description;

-- Only currently approved capabilities are granted. New roles start with none.
delete from public.role_permissions
where role_code in ('social-media', 'customer-support');

insert into public.role_permissions (role_code, permission_code)
select 'social-media', permission.code
from public.app_permissions permission
where permission.code in (
  'social-media.grid.read',
  'social-media.posts.read',
  'social-media.posts.create',
  'social-media.posts.edit',
  'social-media.posts.reschedule',
  'social-media.posts.status.update',
  'social-media.posts.delete',
  'social-media.campaigns.read',
  'social-media.campaigns.create',
  'social-media.campaigns.update',
  'social-media.campaigns.status.update',
  'social-media.campaigns.archive',
  'social-media.campaigns.evaluation.create',
  'social-media.efemerides.read',
  'social-media.efemerides.create',
  'social-media.efemerides.update',
  'social-media.efemerides.delete'
);

commit;
