-- Datos locales deterministas. No contienen información ni credenciales de producción.
-- Requiere que el esquema base y las migraciones del proyecto se hayan aplicado antes.

do $$
declare
  demo_user_id constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    'demo.admin@local.test',
    crypt('local-demo-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Administrador local"}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  )
  values (
    demo_user_id,
    demo_user_id,
    jsonb_build_object('sub', demo_user_id::text, 'email', 'demo.admin@local.test'),
    'email',
    demo_user_id::text,
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
  set identity_data = excluded.identity_data,
      updated_at = now();
end
$$;

insert into public.profiles (user_id, full_name, role_code)
values ('11111111-1111-4111-8111-111111111111', 'Administrador local', 'admin')
on conflict (user_id) do update
set full_name = excluded.full_name,
    role_code = excluded.role_code,
    updated_at = now();

insert into public.role_permissions (role_code, permission_code)
select 'admin', code
from public.app_permissions
on conflict do nothing;

insert into public.inventario_ubicaciones (sede_id, nombre)
select id, 'Depósito central'
from public.inventario_sedes
where codigo = 'PREBO'
on conflict (sede_id, lower(trim(nombre))) do nothing;

insert into public.inventario_articulos (
  categoria_id,
  nombre,
  especificaciones,
  tipo_control,
  cantidad,
  unidad_medida,
  sede_id,
  ubicacion_id,
  condicion,
  creado_por,
  modificado_por
)
select
  category.id,
  'Material POP de demostración',
  'Fixture local para validar listados.',
  'LOTE',
  12,
  'unidades',
  venue.id,
  location.id,
  'DISPONIBLE',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111'
from public.inventario_categorias category
join public.inventario_sedes venue on venue.codigo = 'PREBO'
join public.inventario_ubicaciones location
  on location.sede_id = venue.id and lower(location.nombre) = lower('Depósito central')
where category.nombre = 'Insumo'
  and not exists (
    select 1
    from public.inventario_articulos item
    where item.nombre = 'Material POP de demostración'
      and item.ubicacion_id = location.id
  );
