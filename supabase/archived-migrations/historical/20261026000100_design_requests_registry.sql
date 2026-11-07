-- Design request registry, permissions, and service-role import RPCs.

begin;

create table if not exists public.catalogo_tipos_solicitud (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  orden smallint not null default 0,
  alias text[] not null default '{}',
  creado_en timestamptz not null default now()
);

create table if not exists public.catalogo_departamentos_solicitud (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  orden smallint not null default 0,
  alias text[] not null default '{}',
  creado_en timestamptz not null default now()
);

create table if not exists public.catalogo_areas_solicitud (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  orden smallint not null default 0,
  alias text[] not null default '{}',
  creado_en timestamptz not null default now()
);

create table if not exists public.catalogo_medios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  orden smallint not null default 0,
  alias text[] not null default '{}',
  creado_en timestamptz not null default now()
);

create table if not exists public.catalogo_formatos_entregable (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  categoria text not null check (categoria in ('DIGITAL', 'IMPRESO')),
  activo boolean not null default true,
  orden smallint not null default 0,
  alias text[] not null default '{}',
  creado_en timestamptz not null default now()
);

insert into public.catalogo_departamentos_solicitud (codigo, nombre, orden)
values
  ('MERCADEO', 'Mercadeo', 1),
  ('COMPRAS', 'Compras', 2),
  ('FARMACIA', 'Farmacia', 3),
  ('SELECCION', 'Selección', 4),
  ('CAPITAL_HUMANO', 'Capital Humano', 5),
  ('VENTAS_ONLINE', 'Ventas Online', 6),
  ('OPERACIONES_PERECEDEROS', 'Operaciones Perecederos', 7),
  ('SEGURIDAD_LABORAL', 'Seguridad Laboral', 8)
on conflict (codigo) do update
set nombre = excluded.nombre, orden = excluded.orden;

insert into public.catalogo_areas_solicitud (codigo, nombre, orden)
values
  ('DIGITAL', 'Digital', 1),
  ('EVENTOS', 'Eventos', 2),
  ('INTERNO', 'Interno', 3),
  ('GERENCIA', 'Gerencia', 4)
on conflict (codigo) do update
set nombre = excluded.nombre, orden = excluded.orden;

insert into public.catalogo_medios (codigo, nombre, orden)
values ('DIGITAL', 'Digital', 1), ('IMPRESO', 'Impreso', 2)
on conflict (codigo) do update
set nombre = excluded.nombre, orden = excluded.orden;

create table if not exists public.solicitud_diseno_importaciones (
  id uuid primary key default gen_random_uuid(),
  clave_lote text not null unique,
  intento integer not null check (intento > 0),
  archivo_nombre text not null,
  archivo_sha256 text not null check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  hoja text not null,
  filas_origen integer not null check (filas_origen >= 0),
  modo text not null check (modo in ('SIMULACION', 'REAL')),
  estado text not null check (estado in ('EN_CURSO', 'COMPLETADO', 'FALLIDO', 'REVERTIDO')),
  iniciado_en timestamptz not null default now(),
  iniciado_por uuid references auth.users(id) on delete set null,
  finalizado_en timestamptz,
  resumen jsonb not null default '{}'::jsonb,
  unique (archivo_sha256, hoja, intento)
);

create table if not exists public.solicitud_diseno_importacion_filas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.solicitud_diseno_importaciones(id) on delete restrict,
  hoja text not null,
  fila_origen integer not null check (fila_origen > 0),
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  datos_originales jsonb not null,
  resultado text not null,
  resultado_previo_reversion text,
  advertencias jsonb not null default '[]'::jsonb,
  errores jsonb not null default '[]'::jsonb,
  solicitud_id uuid,
  solicitud_id_revertida uuid,
  creado_en timestamptz not null default now(),
  unique (lote_id, hoja, fila_origen)
);

create table if not exists public.solicitudes_diseno (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  objetivo text,
  alcance_original text,
  origen text not null check (origen in ('KROMI', 'IMPORTACION')),
  importacion_fila_id uuid unique references public.solicitud_diseno_importacion_filas(id) on delete restrict,
  solicitante_usuario_id uuid references auth.users(id) on delete set null,
  solicitante_nombre_original text,
  departamento_id uuid references public.catalogo_departamentos_solicitud(id) on delete restrict,
  departamento_original text,
  area_id uuid references public.catalogo_areas_solicitud(id) on delete restrict,
  area_original text,
  tipo_id uuid references public.catalogo_tipos_solicitud(id) on delete restrict,
  prioridad text check (prioridad in ('URGENTE', 'IMPORTANTE', 'NORMAL')),
  prioridad_original text,
  solicitada_en_original timestamptz,
  fecha_objetivo date,
  fecha_objetivo_original text,
  estado text not null check (estado in ('HISTORICA', 'ABIERTA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA')),
  estado_historico_original text,
  fecha_termino_historica date,
  fecha_termino_original text,
  ejecutor_historico_nombre text,
  ejecutor_historico_usuario_id uuid references auth.users(id) on delete set null,
  responsable_actual_id uuid references auth.users(id) on delete set null,
  referencias_originales text,
  referencias_urls text[] not null default '{}',
  referencia_manual text,
  requiere_revision boolean not null default false,
  motivos_revision text[] not null default '{}',
  motivo_cierre text,
  version integer not null default 1 check (version > 0),
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  modificado_en timestamptz not null default now(),
  modificado_por uuid references auth.users(id) on delete set null,
  check ((origen = 'IMPORTACION') = (importacion_fila_id is not null)),
  check (estado not in ('CANCELADA', 'COMPLETADA') or nullif(btrim(motivo_cierre), '') is not null),
  check (estado <> 'HISTORICA' or responsable_actual_id is null)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'solicitud_diseno_importacion_filas_solicitud_fk'
      and conrelid = 'public.solicitud_diseno_importacion_filas'::regclass
  ) then
    alter table public.solicitud_diseno_importacion_filas
      add constraint solicitud_diseno_importacion_filas_solicitud_fk
      foreign key (solicitud_id) references public.solicitudes_diseno(id) on delete restrict;
  end if;
end;
$$;

create table if not exists public.solicitud_diseno_entregables (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_diseno(id) on delete restrict,
  orden smallint not null check (orden > 0),
  pieza text not null,
  categoria text check (categoria in ('DIGITAL', 'IMPRESO')),
  campo_origen text check (campo_origen in (
    'PUBLICACION_PRINCIPAL', 'PUBLICACION_ADICIONAL',
    'IMPRESION_PRINCIPAL', 'IMPRESION_ADICIONAL'
  )),
  formato_id uuid references public.catalogo_formatos_entregable(id) on delete restrict,
  formato_original text,
  medio_id uuid references public.catalogo_medios(id) on delete restrict,
  medio_original text,
  cantidad_piezas integer check (cantidad_piezas > 0),
  cantidad_formatos integer check (cantidad_formatos > 0),
  alcance_texto text,
  material text,
  medidas text,
  fecha_objetivo date,
  estado text not null check (estado in ('HISTORICO', 'PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO')),
  completado_en timestamptz,
  datos_adicionales jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  modificado_en timestamptz not null default now(),
  modificado_por uuid references auth.users(id) on delete set null,
  unique (solicitud_id, orden),
  check (estado <> 'HISTORICO' or completado_en is null)
);

create table if not exists public.solicitud_diseno_historial (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_diseno(id) on delete cascade,
  entregable_id uuid references public.solicitud_diseno_entregables(id) on delete restrict,
  tipo text not null check (tipo in (
    'CREACION', 'EDICION', 'ESTADO', 'ASIGNACION',
    'ENTREGABLE', 'IMPORTACION'
  )),
  anterior jsonb not null default '{}'::jsonb,
  nuevo jsonb not null default '{}'::jsonb,
  motivo text check (motivo is null or char_length(motivo) <= 300),
  cambiado_por uuid references auth.users(id) on delete set null,
  cambiado_en timestamptz not null default now()
);

create index if not exists idx_solicitudes_diseno_estado_objetivo
  on public.solicitudes_diseno (estado, fecha_objetivo);
create index if not exists idx_solicitudes_diseno_responsable
  on public.solicitudes_diseno (responsable_actual_id)
  where estado in ('ABIERTA', 'EN_CURSO');
create index if not exists idx_solicitudes_diseno_departamento
  on public.solicitudes_diseno (departamento_id);
create index if not exists idx_solicitudes_diseno_solicitante
  on public.solicitudes_diseno (solicitante_usuario_id);
create index if not exists idx_solicitud_entregables_solicitud
  on public.solicitud_diseno_entregables (solicitud_id, estado);
create index if not exists idx_solicitud_historial_solicitud
  on public.solicitud_diseno_historial (solicitud_id, cambiado_en desc);
create index if not exists idx_solicitud_import_fingerprint
  on public.solicitud_diseno_importacion_filas (huella);

alter table public.catalogo_tipos_solicitud enable row level security;
alter table public.catalogo_departamentos_solicitud enable row level security;
alter table public.catalogo_areas_solicitud enable row level security;
alter table public.catalogo_medios enable row level security;
alter table public.catalogo_formatos_entregable enable row level security;
alter table public.solicitud_diseno_importaciones enable row level security;
alter table public.solicitud_diseno_importacion_filas enable row level security;
alter table public.solicitudes_diseno enable row level security;
alter table public.solicitud_diseno_entregables enable row level security;
alter table public.solicitud_diseno_historial enable row level security;

revoke all on public.catalogo_tipos_solicitud, public.catalogo_departamentos_solicitud,
  public.catalogo_areas_solicitud, public.catalogo_medios,
  public.catalogo_formatos_entregable, public.solicitud_diseno_importaciones,
  public.solicitud_diseno_importacion_filas, public.solicitudes_diseno,
  public.solicitud_diseno_entregables, public.solicitud_diseno_historial
  from public, anon, authenticated;

grant select on public.catalogo_tipos_solicitud, public.catalogo_departamentos_solicitud,
  public.catalogo_areas_solicitud, public.catalogo_medios,
  public.catalogo_formatos_entregable, public.solicitudes_diseno,
  public.solicitud_diseno_entregables, public.solicitud_diseno_historial to authenticated;

grant select, insert, update, delete on public.solicitud_diseno_importaciones,
  public.solicitud_diseno_importacion_filas, public.solicitudes_diseno,
  public.solicitud_diseno_entregables, public.solicitud_diseno_historial,
  public.catalogo_tipos_solicitud, public.catalogo_departamentos_solicitud,
  public.catalogo_areas_solicitud, public.catalogo_medios,
  public.catalogo_formatos_entregable to service_role;

drop policy if exists design_solicitud_catalog_read on public.catalogo_tipos_solicitud;
create policy design_solicitud_catalog_read on public.catalogo_tipos_solicitud
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));
drop policy if exists design_solicitud_department_read on public.catalogo_departamentos_solicitud;
create policy design_solicitud_department_read on public.catalogo_departamentos_solicitud
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));
drop policy if exists design_solicitud_area_read on public.catalogo_areas_solicitud;
create policy design_solicitud_area_read on public.catalogo_areas_solicitud
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));
drop policy if exists design_solicitud_medium_read on public.catalogo_medios;
create policy design_solicitud_medium_read on public.catalogo_medios
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));
drop policy if exists design_solicitud_format_read on public.catalogo_formatos_entregable;
create policy design_solicitud_format_read on public.catalogo_formatos_entregable
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));

drop policy if exists design_solicitudes_read on public.solicitudes_diseno;
create policy design_solicitudes_read on public.solicitudes_diseno
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));
drop policy if exists design_solicitud_entregables_read on public.solicitud_diseno_entregables;
create policy design_solicitud_entregables_read on public.solicitud_diseno_entregables
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));
drop policy if exists design_solicitud_history_read on public.solicitud_diseno_historial;
create policy design_solicitud_history_read on public.solicitud_diseno_historial
  for select to authenticated using ((select public.has_permission('design.solicitudes.read')));

drop policy if exists design_solicitud_import_batch_read on public.solicitud_diseno_importaciones;
create policy design_solicitud_import_batch_read on public.solicitud_diseno_importaciones
  for select to authenticated using ((select public.has_permission('design.solicitudes.import.read')));
drop policy if exists design_solicitud_import_row_read on public.solicitud_diseno_importacion_filas;
create policy design_solicitud_import_row_read on public.solicitud_diseno_importacion_filas
  for select to authenticated using ((select public.has_permission('design.solicitudes.import.read')));

insert into public.app_permissions (code, description)
values
  ('design.solicitudes.read', 'Consultar el registro de solicitudes de Diseño'),
  ('design.solicitudes.create', 'Crear solicitudes de Diseño'),
  ('design.solicitudes.update', 'Editar solicitudes de Diseño'),
  ('design.solicitudes.status.update', 'Cambiar el estado de solicitudes de Diseño'),
  ('design.solicitudes.assign', 'Asignar responsables de solicitudes de Diseño'),
  ('design.solicitudes.import.read', 'Consultar datos originales restringidos de la importación')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'design', code
from public.app_permissions
where code in (
  'design.solicitudes.read',
  'design.solicitudes.create',
  'design.solicitudes.update',
  'design.solicitudes.status.update',
  'design.solicitudes.assign'
)
on conflict do nothing;

create or replace function public.solicitud_diseno_history_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from public.solicitudes_diseno s where s.id = old.solicitud_id
  ) then
    return old;
  end if;
  raise exception 'El historial de la solicitud no se puede editar ni eliminar.'
    using errcode = '42501';
end;
$$;

drop trigger if exists solicitud_diseno_history_immutable on public.solicitud_diseno_historial;
create trigger solicitud_diseno_history_immutable
before update or delete on public.solicitud_diseno_historial
for each row execute function public.solicitud_diseno_history_immutable();

create or replace function public.design_solicitudes_require(p_permission text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para continuar.' using errcode = '28000';
  end if;
  if not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_solicitud_diseno(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_titulo text := nullif(btrim(p_data ->> 'titulo'), '');
  v_estado text := coalesce(nullif(p_data ->> 'estado', ''), 'ABIERTA');
begin
  perform public.design_solicitudes_require('design.solicitudes.create');
  if v_titulo is null or char_length(v_titulo) > 200 then
    raise exception 'El título es obligatorio y debe tener máximo 200 caracteres.' using errcode = '22023';
  end if;
  if v_estado <> 'ABIERTA' then
    raise exception 'Una solicitud creada manualmente inicia en ABIERTA.' using errcode = '22023';
  end if;

  insert into public.solicitudes_diseno (
    titulo, objetivo, alcance_original, origen, solicitante_usuario_id,
    solicitante_nombre_original, departamento_id, area_id, tipo_id, prioridad,
    fecha_objetivo, referencia_manual, estado, creado_por, modificado_por
  ) values (
    v_titulo, nullif(btrim(p_data ->> 'objetivo'), ''),
    nullif(btrim(p_data ->> 'alcance_original'), ''), 'KROMI',
    nullif(p_data ->> 'solicitante_usuario_id', '')::uuid,
    nullif(btrim(p_data ->> 'solicitante_nombre_original'), ''),
    nullif(p_data ->> 'departamento_id', '')::uuid,
    nullif(p_data ->> 'area_id', '')::uuid,
    nullif(p_data ->> 'tipo_id', '')::uuid,
    nullif(p_data ->> 'prioridad', ''),
    nullif(p_data ->> 'fecha_objetivo', '')::date,
    nullif(btrim(p_data ->> 'referencia_manual'), ''),
    'ABIERTA', v_actor, v_actor
  )
  returning id into v_id;

  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, nuevo, cambiado_por
  ) values (
    v_id, 'CREACION',
    jsonb_build_object('origen', 'KROMI', 'titulo', v_titulo), v_actor
  );
  return v_id;
end;
$$;

create or replace function public.update_solicitud_diseno(
  p_id uuid,
  p_expected_version integer,
  p_data jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.solicitudes_diseno%rowtype;
  v_new_version integer;
begin
  perform public.design_solicitudes_require('design.solicitudes.update');
  select * into v_old from public.solicitudes_diseno where id = p_id for update;
  if not found then raise exception 'La solicitud no existe.' using errcode = 'P0002'; end if;
  if v_old.version <> p_expected_version then
    raise exception 'La solicitud cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if v_old.origen = 'IMPORTACION' then
    raise exception 'Las solicitudes importadas son históricas y no se editan.' using errcode = '42501';
  end if;

  update public.solicitudes_diseno
  set titulo = coalesce(nullif(btrim(p_data ->> 'titulo'), ''), titulo),
      objetivo = nullif(btrim(p_data ->> 'objetivo'), ''),
      alcance_original = nullif(btrim(p_data ->> 'alcance_original'), ''),
      prioridad = nullif(p_data ->> 'prioridad', ''),
      fecha_objetivo = nullif(p_data ->> 'fecha_objetivo', '')::date,
      referencia_manual = nullif(btrim(p_data ->> 'referencia_manual'), ''),
      version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where id = p_id
  returning version into v_new_version;

  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, anterior, nuevo, cambiado_por
  ) values (
    p_id, 'EDICION',
    jsonb_build_object('titulo', v_old.titulo, 'objetivo', v_old.objetivo,
      'prioridad', v_old.prioridad, 'fecha_objetivo', v_old.fecha_objetivo,
      'referencia_manual', v_old.referencia_manual),
    jsonb_build_object('titulo', p_data ->> 'titulo', 'objetivo', p_data ->> 'objetivo',
      'prioridad', p_data ->> 'prioridad', 'fecha_objetivo', p_data ->> 'fecha_objetivo',
      'referencia_manual', p_data ->> 'referencia_manual'),
    auth.uid()
  );
  return v_new_version;
end;
$$;

create or replace function public.list_solicitud_diseno_responsables()
returns table (user_id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.design_solicitudes_require('design.solicitudes.assign');
  return query
  select p.user_id, nullif(btrim(p.full_name), '')
  from public.profiles p
  where p.role_code = 'design'
  order by lower(coalesce(p.full_name, '')), p.user_id;
end;
$$;

create or replace function public.add_solicitud_diseno_entregable(
  p_solicitud_id uuid,
  p_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.solicitudes_diseno%rowtype;
  v_id uuid;
  v_order smallint;
  v_piece text := nullif(btrim(p_data ->> 'pieza'), '');
begin
  perform public.design_solicitudes_require('design.solicitudes.update');
  select * into v_request
  from public.solicitudes_diseno
  where id = p_solicitud_id
  for update;
  if not found then raise exception 'La solicitud no existe.' using errcode = 'P0002'; end if;
  if v_request.origen <> 'KROMI' or v_request.estado in ('HISTORICA', 'COMPLETADA', 'CANCELADA') then
    raise exception 'No se pueden agregar entregables a esta solicitud.' using errcode = '42501';
  end if;
  if v_piece is null or char_length(v_piece) > 200 then
    raise exception 'El nombre de la pieza es obligatorio y debe tener máximo 200 caracteres.' using errcode = '22023';
  end if;
  if nullif(p_data ->> 'categoria', '') is not null
    and p_data ->> 'categoria' not in ('DIGITAL', 'IMPRESO') then
    raise exception 'La categoría del entregable no es válida.' using errcode = '22023';
  end if;
  select coalesce(max(e.orden), 0) + 1 into v_order
  from public.solicitud_diseno_entregables e
  where e.solicitud_id = p_solicitud_id;

  insert into public.solicitud_diseno_entregables (
    solicitud_id, orden, pieza, categoria, formato_id, formato_original,
    medio_id, medio_original, cantidad_piezas, cantidad_formatos, alcance_texto,
    material, medidas, fecha_objetivo, estado, creado_por, modificado_por
  ) values (
    p_solicitud_id, v_order, v_piece, nullif(p_data ->> 'categoria', ''),
    nullif(p_data ->> 'formato_id', '')::uuid,
    nullif(btrim(p_data ->> 'formato_original'), ''),
    nullif(p_data ->> 'medio_id', '')::uuid,
    nullif(btrim(p_data ->> 'medio_original'), ''),
    nullif(p_data ->> 'cantidad_piezas', '')::integer,
    nullif(p_data ->> 'cantidad_formatos', '')::integer,
    nullif(btrim(p_data ->> 'alcance_texto'), ''),
    nullif(btrim(p_data ->> 'material'), ''),
    nullif(btrim(p_data ->> 'medidas'), ''),
    nullif(p_data ->> 'fecha_objetivo', '')::date,
    'PENDIENTE', v_actor, v_actor
  )
  returning id into v_id;
  update public.solicitudes_diseno
  set version = version + 1, modificado_en = now(), modificado_por = v_actor
  where id = p_solicitud_id;
  insert into public.solicitud_diseno_historial (
    solicitud_id, entregable_id, tipo, nuevo, cambiado_por
  ) values (
    p_solicitud_id, v_id, 'ENTREGABLE',
    jsonb_build_object('pieza', v_piece, 'estado', 'PENDIENTE'), v_actor
  );
  return v_id;
end;
$$;

create or replace function public.set_solicitud_diseno_responsable(
  p_id uuid,
  p_expected_version integer,
  p_responsable_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_version integer;
begin
  perform public.design_solicitudes_require('design.solicitudes.assign');
  select responsable_actual_id into v_old
  from public.solicitudes_diseno where id = p_id and origen = 'KROMI' and estado <> 'HISTORICA'
  for update;
  if not found then raise exception 'La solicitud no existe o no admite asignación.' using errcode = 'P0002'; end if;
  if (select version from public.solicitudes_diseno where id = p_id) <> p_expected_version then
    raise exception 'La solicitud cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if p_responsable_id is not null and not exists (
    select 1 from public.profiles p where p.user_id = p_responsable_id and p.role_code = 'design'
  ) then
    raise exception 'El responsable debe pertenecer al equipo de Diseño.' using errcode = '22023';
  end if;
  update public.solicitudes_diseno
  set responsable_actual_id = p_responsable_id, version = version + 1,
      modificado_en = now(), modificado_por = auth.uid()
  where id = p_id returning version into v_version;
  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, anterior, nuevo, cambiado_por
  ) values (
    p_id, 'ASIGNACION', jsonb_build_object('responsable_id', v_old),
    jsonb_build_object('responsable_id', p_responsable_id), auth.uid()
  );
  return v_version;
end;
$$;

create or replace function public.transition_solicitud_diseno(
  p_id uuid,
  p_expected_version integer,
  p_estado text,
  p_motivo text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.solicitudes_diseno%rowtype;
  v_version integer;
begin
  perform public.design_solicitudes_require('design.solicitudes.status.update');
  select * into v_old from public.solicitudes_diseno where id = p_id for update;
  if not found then raise exception 'La solicitud no existe.' using errcode = 'P0002'; end if;
  if v_old.version <> p_expected_version then
    raise exception 'La solicitud cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if p_estado not in ('ABIERTA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA') then
    raise exception 'El estado solicitado no es válido.' using errcode = '22023';
  end if;
  if v_old.estado = 'HISTORICA' and (
    p_estado <> 'ABIERTA' or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir una solicitud histórica requiere motivo y estado ABIERTA.' using errcode = '22023';
  end if;
  if v_old.estado in ('COMPLETADA', 'CANCELADA') and (
    p_estado <> 'ABIERTA' or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir una solicitud completada o cancelada requiere motivo.' using errcode = '22023';
  end if;
  if v_old.estado = 'ABIERTA' and p_estado not in ('EN_CURSO', 'CANCELADA') then
    raise exception 'La transición solicitada no es válida desde ABIERTA.' using errcode = '22023';
  end if;
  if v_old.estado = 'EN_CURSO' and p_estado not in ('ABIERTA', 'COMPLETADA', 'CANCELADA') then
    raise exception 'La transición solicitada no es válida desde EN_CURSO.' using errcode = '22023';
  end if;
  if p_estado in ('COMPLETADA', 'CANCELADA') and nullif(btrim(p_motivo), '') is null then
    raise exception 'Completar o cancelar requiere un motivo.' using errcode = '22023';
  end if;
  if p_estado = 'COMPLETADA' and (
    not exists (select 1 from public.solicitud_diseno_entregables e where e.solicitud_id = p_id)
    or exists (select 1 from public.solicitud_diseno_entregables e
      where e.solicitud_id = p_id and e.estado not in ('COMPLETADO', 'CANCELADO'))
  ) then
    raise exception 'Completa o cancela todos los entregables antes de cerrar la solicitud.' using errcode = '22023';
  end if;
  update public.solicitudes_diseno
  set estado = p_estado,
      motivo_cierre = case when p_estado in ('COMPLETADA', 'CANCELADA') then btrim(p_motivo) else null end,
      version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where id = p_id returning version into v_version;
  if p_estado = 'CANCELADA' then
    update public.solicitud_diseno_entregables
    set estado = 'CANCELADO', version = version + 1, modificado_en = now(),
        modificado_por = auth.uid()
    where solicitud_id = p_id and estado in ('PENDIENTE', 'EN_CURSO');
  end if;
  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, anterior, nuevo, motivo, cambiado_por
  ) values (
    p_id, 'ESTADO', jsonb_build_object('estado', v_old.estado),
    jsonb_build_object('estado', p_estado), nullif(btrim(p_motivo), ''), auth.uid()
  );
  return v_version;
end;
$$;

create or replace function public.transition_solicitud_diseno_entregable(
  p_id uuid,
  p_expected_version integer,
  p_estado text,
  p_motivo text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.solicitud_diseno_entregables%rowtype;
  v_version integer;
  v_parent public.solicitudes_diseno%rowtype;
begin
  perform public.design_solicitudes_require('design.solicitudes.status.update');
  select * into v_old from public.solicitud_diseno_entregables where id = p_id for update;
  if not found then raise exception 'El entregable no existe.' using errcode = 'P0002'; end if;
  select * into v_parent from public.solicitudes_diseno where id = v_old.solicitud_id for update;
  if v_parent.origen = 'IMPORTACION' or v_old.estado = 'HISTORICO' then
    raise exception 'Los entregables históricos no se pueden modificar.' using errcode = '42501';
  end if;
  if v_old.version <> p_expected_version then
    raise exception 'El entregable cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if p_estado not in ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO') then
    raise exception 'El estado solicitado no es válido.' using errcode = '22023';
  end if;
  if v_old.estado = 'HISTORICO' and (
    p_estado <> 'PENDIENTE' or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir un entregable histórico requiere motivo y estado PENDIENTE.' using errcode = '22023';
  end if;
  if v_old.estado in ('COMPLETADO', 'CANCELADO') and (
    p_estado not in ('PENDIENTE', 'EN_CURSO') or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir un entregable requiere motivo.' using errcode = '22023';
  end if;
  if v_old.estado = 'PENDIENTE' and p_estado not in ('EN_CURSO', 'CANCELADO') then
    raise exception 'La transición solicitada no es válida desde PENDIENTE.' using errcode = '22023';
  end if;
  if v_old.estado = 'EN_CURSO' and p_estado not in ('PENDIENTE', 'COMPLETADO', 'CANCELADO') then
    raise exception 'La transición solicitada no es válida desde EN_CURSO.' using errcode = '22023';
  end if;
  if p_estado = 'CANCELADO' and nullif(btrim(p_motivo), '') is null then
    raise exception 'Cancelar un entregable requiere un motivo.' using errcode = '22023';
  end if;

  update public.solicitud_diseno_entregables
  set estado = p_estado, completado_en = case when p_estado = 'COMPLETADO' then now() else null end,
      version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where id = p_id returning version into v_version;
  update public.solicitudes_diseno s
  set estado = case
      when s.estado in ('ABIERTA', 'EN_CURSO') and exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado in ('EN_CURSO', 'COMPLETADO')
      ) and exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado in ('PENDIENTE', 'EN_CURSO')
      ) then 'EN_CURSO'
      when s.estado in ('ABIERTA', 'EN_CURSO') and exists (
        select 1 from public.solicitud_diseno_entregables e where e.solicitud_id = s.id
      ) and not exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado not in ('COMPLETADO', 'CANCELADO')
      ) and exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado = 'COMPLETADO'
      ) then 'COMPLETADA'
      else s.estado
    end,
    version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where s.id = v_old.solicitud_id and s.estado in ('ABIERTA', 'EN_CURSO');
  insert into public.solicitud_diseno_historial (
    solicitud_id, entregable_id, tipo, anterior, nuevo, motivo, cambiado_por
  ) values (
    v_old.solicitud_id, p_id, 'ENTREGABLE',
    jsonb_build_object('estado', v_old.estado),
    jsonb_build_object('estado', p_estado),
    nullif(btrim(p_motivo), ''), auth.uid()
  );
  return v_version;
end;
$$;

create or replace function public.revert_solicitud_diseno_importacion(p_lote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.solicitud_diseno_importaciones%rowtype;
  v_row record;
  v_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'La reversión solo puede ejecutarse con service_role.' using errcode = '42501';
  end if;
  select * into v_batch from public.solicitud_diseno_importaciones
  where id = p_lote_id for update;
  if not found then raise exception 'El lote no existe.' using errcode = 'P0002'; end if;
  if v_batch.estado <> 'COMPLETADO' or v_batch.modo <> 'REAL' then
    raise exception 'Solo se revierte un lote real completado.' using errcode = '22023';
  end if;

  for v_row in
    select f.id as fila_id, f.solicitud_id, s.estado as solicitud_estado
    from public.solicitud_diseno_importacion_filas f
    join public.solicitudes_diseno s on s.id = f.solicitud_id
    where f.lote_id = p_lote_id and f.solicitud_id is not null
    for update of f, s
  loop
    if v_row.solicitud_estado <> 'HISTORICA' or exists (
      select 1 from public.solicitud_diseno_historial h
      where h.solicitud_id = v_row.solicitud_id and h.tipo <> 'IMPORTACION'
    ) or exists (
      select 1 from public.solicitud_diseno_entregables e
      where e.solicitud_id = v_row.solicitud_id
    ) then
      raise exception 'El lote tiene actividad posterior; no se realizaron cambios.' using errcode = '22023';
    end if;
  end loop;

  for v_row in
    select f.id as fila_id, f.solicitud_id
    from public.solicitud_diseno_importacion_filas f
    where f.lote_id = p_lote_id and f.solicitud_id is not null
    for update
  loop
    update public.solicitud_diseno_importacion_filas
    set resultado_previo_reversion = resultado,
        solicitud_id_revertida = v_row.solicitud_id,
        solicitud_id = null,
        resultado = 'REVERTIDA'
    where id = v_row.fila_id;
    delete from public.solicitudes_diseno where id = v_row.solicitud_id;
    v_count := v_count + 1;
  end loop;
  update public.solicitud_diseno_importaciones
  set estado = 'REVERTIDO', finalizado_en = now(),
      resumen = resumen || jsonb_build_object('revertidas', v_count)
  where id = p_lote_id;
  return jsonb_build_object('revertidas', v_count, 'estado', 'REVERTIDO');
end;
$$;

revoke all on function public.solicitud_diseno_history_immutable() from public, anon, authenticated;
revoke all on function public.design_solicitudes_require(text) from public, anon, authenticated;
revoke all on function public.create_solicitud_diseno(jsonb) from public, anon;
revoke all on function public.update_solicitud_diseno(uuid, integer, jsonb) from public, anon;
revoke all on function public.list_solicitud_diseno_responsables() from public, anon;
revoke all on function public.add_solicitud_diseno_entregable(uuid, jsonb) from public, anon;
revoke all on function public.set_solicitud_diseno_responsable(uuid, integer, uuid) from public, anon;
revoke all on function public.transition_solicitud_diseno(uuid, integer, text, text) from public, anon;
revoke all on function public.transition_solicitud_diseno_entregable(uuid, integer, text, text) from public, anon;
revoke all on function public.revert_solicitud_diseno_importacion(uuid) from public, anon, authenticated;
grant execute on function public.create_solicitud_diseno(jsonb) to authenticated;
grant execute on function public.update_solicitud_diseno(uuid, integer, jsonb) to authenticated;
grant execute on function public.list_solicitud_diseno_responsables() to authenticated;
grant execute on function public.add_solicitud_diseno_entregable(uuid, jsonb) to authenticated;
grant execute on function public.set_solicitud_diseno_responsable(uuid, integer, uuid) to authenticated;
grant execute on function public.transition_solicitud_diseno(uuid, integer, text, text) to authenticated;
grant execute on function public.transition_solicitud_diseno_entregable(uuid, integer, text, text) to authenticated;
grant execute on function public.revert_solicitud_diseno_importacion(uuid) to service_role;

commit;
