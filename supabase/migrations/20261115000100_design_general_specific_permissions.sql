begin;

insert into public.app_permissions (code, description)
values
  ('design.general.start', 'Iniciar el diseño de una solicitud general.'),
  ('design.general.deliver', 'Entregar una solicitud general.'),
  ('design.general.deliverable.upload', 'Gestionar cargas de entregables de solicitudes generales.'),
  ('design.general.priority.update', 'Modificar la prioridad de una solicitud general.'),
  ('design.general.cancellation.resolve', 'Resolver una solicitud de cancelación general.')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'design', permission.code
from public.app_permissions as permission
where permission.code in (
  'design.general.start',
  'design.general.deliver',
  'design.general.deliverable.upload',
  'design.general.priority.update',
  'design.general.cancellation.resolve'
)
on conflict do nothing;

commit;
