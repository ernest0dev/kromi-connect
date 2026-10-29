begin;

create table public.general_design_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  design_type text not null check (design_type in ('DIGITAL', 'PRINT', 'BOTH', 'OTHER')),
  design_type_other text check (design_type_other is null or char_length(btrim(design_type_other)) between 1 and 120),
  instructions text not null check (char_length(btrim(instructions)) between 1 and 5000),
  categories text[] not null default '{}',
  scopes text[] not null default '{}',
  department text not null default 'Mercadeo' check (char_length(btrim(department)) between 1 and 100),
  required_date date not null,
  additional_specifications text check (additional_specifications is null or char_length(additional_specifications) <= 3000),
  requester_id uuid not null references auth.users(id) on delete restrict,
  requester_role text not null check (requester_role in ('social-media', 'events', 'internal')),
  status text not null default 'SOLICITADA' check (status in ('SOLICITADA', 'EN_DISENO', 'EN_CORRECCION', 'ENTREGADA', 'CANCELADA')),
  designer_id uuid references auth.users(id) on delete set null,
  drive_folder_id text,
  drive_folder_url text,
  drive_status text not null default 'PENDING' check (drive_status in ('PENDING', 'READY', 'ERROR')),
  drive_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((design_type = 'OTHER') = (design_type_other is not null))
);

create index general_design_requests_requester_created_idx on public.general_design_requests (requester_id, created_at desc);
create index general_design_requests_status_date_idx on public.general_design_requests (status, required_date);

alter table public.general_design_requests enable row level security;
create policy general_design_requests_read on public.general_design_requests for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.has_permission('design.requests.read')));
create policy general_design_requests_create on public.general_design_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and requester_role = (select role_code from public.profiles where user_id = (select auth.uid()))
    and requester_role in ('social-media', 'events', 'internal')
    and status = 'SOLICITADA' and designer_id is null and drive_folder_id is null
  );
grant select, insert on public.general_design_requests to authenticated;

insert into public.app_permissions (code, description) values
  ('requests.general.create', 'Crear solicitudes generales de Diseño'),
  ('requests.general.read-own', 'Consultar solicitudes generales propias')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select role_code, permission_code
from (values
  ('social-media', 'requests.general.create'), ('social-media', 'requests.general.read-own'),
  ('events', 'requests.general.create'), ('events', 'requests.general.read-own'),
  ('internal', 'requests.general.create'), ('internal', 'requests.general.read-own')
) as grants(role_code, permission_code)
on conflict do nothing;

commit;
