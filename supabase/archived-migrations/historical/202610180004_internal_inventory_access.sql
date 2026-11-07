-- El rol internal obtiene el mismo acceso al inventario de Eventos que el rol events:
-- consultar, crear, editar, registrar movimientos/traslados y crear ubicaciones.
-- No hay cambios de RLS ni de RPC: el inventario se controla solo por permisos events.inventory.*.
begin;

insert into public.role_permissions (role_code, permission_code)
select 'internal', permission.code
from public.app_permissions permission
where permission.code in (
  'events.inventory.read',
  'events.inventory.create',
  'events.inventory.update',
  'events.inventory.move',
  'events.inventory.locations.create'
)
on conflict do nothing;

commit;
