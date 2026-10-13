-- Inventario compartido del rol Eventos: catálogos, artículos, movimientos y permisos.
--
-- Diseño: docs/design/plan-inventario-eventos.md y docs/design/prototypes/events-inventory/.
-- No reutiliza public.inventario_premios (premios de sorteos asociados a campañas).
-- Las sedes del inventario son un catálogo propio (inventario_sedes) y no dependen
-- de public.sede_enum, que solo conoce Prebo y Mañongo.
--
-- Escritura: ningún rol de la API recibe INSERT/UPDATE/DELETE directo. Todo cambio
-- pasa por funciones SECURITY DEFINER que comprueban permiso, bloquean la fila,
-- validan la versión y escriben el artículo y su movimiento en una sola transacción.

begin;

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------

create table if not exists public.inventario_sedes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9_]{2,40}$'),
  nombre text not null unique check (length(trim(nombre)) between 1 and 80),
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventario_ubicaciones (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.inventario_sedes(id),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint inventario_ubicaciones_id_sede_key unique (id, sede_id)
);
create unique index if not exists inventario_ubicaciones_sede_nombre_key
  on public.inventario_ubicaciones (sede_id, lower(trim(nombre)));

create table if not exists public.inventario_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) between 1 and 60),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Artículos (estado vigente: una fila por artículo/lote en una ubicación)
-- ---------------------------------------------------------------------------

create table if not exists public.inventario_articulos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.inventario_categorias(id),
  nombre text not null check (length(trim(nombre)) between 1 and 160),
  especificaciones text check (especificaciones is null or length(especificaciones) <= 2000),
  -- Reservado para atributos propios de cada categoría (por definir con el equipo).
  atributos jsonb not null default '{}'::jsonb check (jsonb_typeof(atributos) = 'object'),
  tipo_control text not null check (tipo_control in ('LOTE', 'INDIVIDUAL')),
  codigo text check (codigo is null or length(trim(codigo)) between 1 and 60),
  cantidad numeric(12, 2) not null default 0 check (cantidad >= 0),
  unidad_medida text not null default 'unidades' check (length(trim(unidad_medida)) between 1 and 30),
  sede_id uuid not null,
  ubicacion_id uuid not null,
  condicion text not null default 'DISPONIBLE'
    check (condicion in ('DISPONIBLE', 'DANADO', 'EN_REPARACION', 'DADO_DE_BAJA')),
  -- Se incrementa en cada cambio para avisar si alguien modificó el registro mientras se editaba.
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  modificado_en timestamptz not null default now(),
  modificado_por uuid references auth.users(id) on delete set null,
  constraint inventario_articulos_ubicacion_fkey
    foreign key (ubicacion_id, sede_id) references public.inventario_ubicaciones (id, sede_id),
  -- Unidad individual: 1 en sede o 0 si salió; siempre con código. Lote: sin código.
  constraint inventario_articulos_individual_check
    check (tipo_control = 'LOTE' or (cantidad in (0, 1) and codigo is not null)),
  constraint inventario_articulos_lote_sin_codigo_check
    check (tipo_control = 'INDIVIDUAL' or codigo is null)
);
create unique index if not exists inventario_articulos_codigo_key
  on public.inventario_articulos (lower(trim(codigo))) where codigo is not null;
create index if not exists inventario_articulos_sede_nombre_idx
  on public.inventario_articulos (sede_id, lower(nombre));
create index if not exists inventario_articulos_ubicacion_idx
  on public.inventario_articulos (ubicacion_id);
create index if not exists inventario_articulos_categoria_idx
  on public.inventario_articulos (categoria_id);

-- ---------------------------------------------------------------------------
-- Movimientos (historial: solo se agregan filas)
-- ---------------------------------------------------------------------------

create table if not exists public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  -- Fila que cambia de saldo. En un traslado de lote es la fila de origen.
  articulo_id uuid not null references public.inventario_articulos(id),
  tipo text not null check (tipo in ('CONTEO_INICIAL', 'TRASLADO', 'SALIDA', 'RETORNO', 'AJUSTE')),
  -- TRASLADO/SALIDA/RETORNO: cantidad movida (> 0). AJUSTE: diferencia con signo.
  -- CONTEO_INICIAL: cantidad registrada al crear el artículo.
  cantidad numeric(12, 2) not null,
  origen_sede_id uuid references public.inventario_sedes(id),
  origen_ubicacion_id uuid references public.inventario_ubicaciones(id),
  destino_sede_id uuid references public.inventario_sedes(id),
  destino_ubicacion_id uuid references public.inventario_ubicaciones(id),
  -- Fila que recibe la cantidad cuando un traslado de lote la reparte a otra ubicación.
  destino_articulo_id uuid references public.inventario_articulos(id),
  -- Texto libre para salidas y retornos fuera de las sedes (p. ej. "Evento externo").
  origen_externo text check (origen_externo is null or length(origen_externo) <= 120),
  destino_externo text check (destino_externo is null or length(destino_externo) <= 120),
  fecha_hora timestamptz not null default now(),
  registrado_por uuid references auth.users(id) on delete set null,
  registrado_en timestamptz not null default now(),
  -- La primera versión no tiene aprobación: toda operación nace completada.
  -- Si el equipo define autorización previa, se amplía este check en una migración nueva.
  estado text not null default 'COMPLETADO' check (estado in ('COMPLETADO')),
  observacion text check (observacion is null or length(observacion) <= 500),
  saldo_resultante numeric(12, 2) not null check (saldo_resultante >= 0),
  saldo_destino numeric(12, 2) check (saldo_destino is null or saldo_destino >= 0),
  corrige_movimiento_id uuid references public.inventario_movimientos(id),
  constraint inventario_movimientos_cantidad_check check (
    (tipo = 'AJUSTE' and cantidad <> 0)
    or (tipo = 'CONTEO_INICIAL' and cantidad >= 0)
    or (tipo in ('TRASLADO', 'SALIDA', 'RETORNO') and cantidad > 0)
  ),
  constraint inventario_movimientos_ajuste_motivo_check check (
    tipo <> 'AJUSTE' or length(trim(coalesce(observacion, ''))) > 0
  )
);
create index if not exists inventario_movimientos_articulo_idx
  on public.inventario_movimientos (articulo_id, fecha_hora desc, registrado_en desc);
create index if not exists inventario_movimientos_destino_articulo_idx
  on public.inventario_movimientos (destino_articulo_id, fecha_hora desc)
  where destino_articulo_id is not null;

create or replace function public.guard_inventory_movements_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'El historial de movimientos no se puede editar ni eliminar. Registra un ajuste con su motivo.';
end;
$$;

drop trigger if exists guard_inventory_movements_immutable on public.inventario_movimientos;
create trigger guard_inventory_movements_immutable
before update or delete on public.inventario_movimientos
for each row execute function public.guard_inventory_movements_immutable();
revoke all on function public.guard_inventory_movements_immutable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos del rol events (lectura y gestión explícitas)
-- ---------------------------------------------------------------------------

insert into public.app_permissions (code, description)
values
  ('events.inventory.read', 'Consultar el inventario de Eventos'),
  ('events.inventory.create', 'Crear artículos del inventario de Eventos'),
  ('events.inventory.update', 'Editar los datos de artículos del inventario de Eventos'),
  ('events.inventory.move', 'Registrar movimientos y ajustes del inventario de Eventos'),
  ('events.inventory.locations.create', 'Crear ubicaciones internas del inventario de Eventos')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'events', permission.code
from public.app_permissions permission
where permission.code in (
  'events.inventory.read',
  'events.inventory.create',
  'events.inventory.update',
  'events.inventory.move',
  'events.inventory.locations.create'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS: lectura por permiso; sin escritura directa
-- ---------------------------------------------------------------------------

alter table public.inventario_sedes enable row level security;
alter table public.inventario_ubicaciones enable row level security;
alter table public.inventario_categorias enable row level security;
alter table public.inventario_articulos enable row level security;
alter table public.inventario_movimientos enable row level security;

revoke all on public.inventario_sedes from anon, authenticated;
revoke all on public.inventario_ubicaciones from anon, authenticated;
revoke all on public.inventario_categorias from anon, authenticated;
revoke all on public.inventario_articulos from anon, authenticated;
revoke all on public.inventario_movimientos from anon, authenticated;

grant select on public.inventario_sedes to authenticated;
grant select on public.inventario_ubicaciones to authenticated;
grant select on public.inventario_categorias to authenticated;
grant select on public.inventario_articulos to authenticated;
grant select on public.inventario_movimientos to authenticated;

drop policy if exists "app_permissions_read_inventory_sedes" on public.inventario_sedes;
create policy "app_permissions_read_inventory_sedes"
  on public.inventario_sedes for select to authenticated
  using ((select public.has_permission('events.inventory.read')));

drop policy if exists "app_permissions_read_inventory_locations" on public.inventario_ubicaciones;
create policy "app_permissions_read_inventory_locations"
  on public.inventario_ubicaciones for select to authenticated
  using ((select public.has_permission('events.inventory.read')));

drop policy if exists "app_permissions_read_inventory_categories" on public.inventario_categorias;
create policy "app_permissions_read_inventory_categories"
  on public.inventario_categorias for select to authenticated
  using ((select public.has_permission('events.inventory.read')));

drop policy if exists "app_permissions_read_inventory_items" on public.inventario_articulos;
create policy "app_permissions_read_inventory_items"
  on public.inventario_articulos for select to authenticated
  using ((select public.has_permission('events.inventory.read')));

drop policy if exists "app_permissions_read_inventory_movements" on public.inventario_movimientos;
create policy "app_permissions_read_inventory_movements"
  on public.inventario_movimientos for select to authenticated
  using ((select public.has_permission('events.inventory.read')));

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

insert into public.inventario_sedes (codigo, nombre, orden)
values
  ('PREBO', 'Prebo', 1),
  ('MANONGO', 'Mañongo', 2),
  ('TRIGAL_SUR', 'Trigal Sur', 3),
  ('TRIGAL_NORTE', 'Trigal Norte', 4),
  ('GUATAPARO', 'Guataparo', 5),
  ('CASTILLITO', 'Castillito', 6),
  ('SAN_FELIPE', 'San Felipe', 7)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;

-- Solo las categorías que aparecen en el Excel actual. Las demás (p. ej. Equipos)
-- se agregan cuando el equipo confirme el catálogo.
insert into public.inventario_categorias (nombre)
values ('Insumo'), ('Mobiliario'), ('Decoración')
on conflict (nombre) do nothing;

-- Las ubicaciones por sede NO se siembran: el Excel lista nombres, pero no confirma
-- cuáles existen en cada sede. Se crean desde la app (events.inventory.locations.create)
-- o con la importación del Excel.

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

create or replace function public.inventory_require(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.inventory_require(text) from public, anon, authenticated;

-- Suma stock de un lote en otra ubicación: reutiliza la fila equivalente o crea una copia.
create or replace function public.inventory_add_to_stock_row(
  p_source public.inventario_articulos,
  p_sede_id uuid,
  p_ubicacion_id uuid,
  p_cantidad numeric,
  p_actor uuid
)
returns public.inventario_articulos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.inventario_articulos;
begin
  select t.* into v_target
  from public.inventario_articulos t
  where t.tipo_control = 'LOTE'
    and t.ubicacion_id = p_ubicacion_id
    and t.categoria_id = p_source.categoria_id
    and lower(trim(t.nombre)) = lower(trim(p_source.nombre))
    and coalesce(trim(t.especificaciones), '') = coalesce(trim(p_source.especificaciones), '')
    and t.unidad_medida = p_source.unidad_medida
    and t.condicion = p_source.condicion
    and t.id <> p_source.id
  order by t.creado_en
  limit 1
  for update;

  if found then
    update public.inventario_articulos t
    set cantidad = t.cantidad + p_cantidad,
        version = t.version + 1,
        modificado_en = now(),
        modificado_por = p_actor
    where t.id = v_target.id
    returning t.* into v_target;
  else
    insert into public.inventario_articulos (
      categoria_id, nombre, especificaciones, atributos, tipo_control, codigo, cantidad,
      unidad_medida, sede_id, ubicacion_id, condicion, creado_por, modificado_por
    )
    values (
      p_source.categoria_id, p_source.nombre, p_source.especificaciones, p_source.atributos,
      'LOTE', null, p_cantidad, p_source.unidad_medida, p_sede_id, p_ubicacion_id,
      p_source.condicion, p_actor, p_actor
    )
    returning * into v_target;
  end if;

  return v_target;
end;
$$;
revoke all on function public.inventory_add_to_stock_row(public.inventario_articulos, uuid, uuid, numeric, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lectura
-- ---------------------------------------------------------------------------

create or replace function public.list_inventory_items(
  p_sede_id uuid default null,
  p_search text default null,
  p_categoria_id uuid default null,
  p_ubicacion_id uuid default null,
  p_condicion text default null,
  p_tipo_control text default null,
  p_sort text default 'nombre',
  p_dir text default 'asc',
  p_limit integer default 10,
  p_offset integer default 0,
  p_articulo_id uuid default null
)
returns table (
  id uuid,
  categoria_id uuid,
  categoria_nombre text,
  nombre text,
  especificaciones text,
  atributos jsonb,
  tipo_control text,
  codigo text,
  cantidad numeric,
  unidad_medida text,
  sede_id uuid,
  sede_nombre text,
  ubicacion_id uuid,
  ubicacion_nombre text,
  condicion text,
  version integer,
  creado_en timestamptz,
  creado_por uuid,
  creado_por_nombre text,
  modificado_en timestamptz,
  modificado_por uuid,
  modificado_por_nombre text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_pattern text;
  v_sort text := case when p_sort in ('nombre', 'categoria', 'cantidad', 'ubicacion', 'condicion', 'modificado')
                      then p_sort else 'nombre' end;
  v_desc boolean := lower(coalesce(p_dir, 'asc')) = 'desc';
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.inventory_require('events.inventory.read');

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    a.id, a.categoria_id, c.nombre, a.nombre, a.especificaciones, a.atributos,
    a.tipo_control, a.codigo, a.cantidad, a.unidad_medida,
    a.sede_id, s.nombre, a.ubicacion_id, u.nombre, a.condicion, a.version,
    a.creado_en, a.creado_por, pc.full_name,
    a.modificado_en, a.modificado_por, pm.full_name,
    count(*) over ()
  from public.inventario_articulos a
  join public.inventario_categorias c on c.id = a.categoria_id
  join public.inventario_sedes s on s.id = a.sede_id
  join public.inventario_ubicaciones u on u.id = a.ubicacion_id
  left join public.profiles pc on pc.user_id = a.creado_por
  left join public.profiles pm on pm.user_id = a.modificado_por
  where (p_articulo_id is null or a.id = p_articulo_id)
    and (p_sede_id is null or a.sede_id = p_sede_id)
    and (p_categoria_id is null or a.categoria_id = p_categoria_id)
    and (p_ubicacion_id is null or a.ubicacion_id = p_ubicacion_id)
    and (p_condicion is null or a.condicion = p_condicion)
    and (p_tipo_control is null or a.tipo_control = p_tipo_control)
    and (
      v_search is null
      or a.nombre ilike v_pattern
      or coalesce(a.especificaciones, '') ilike v_pattern
      or coalesce(a.codigo, '') ilike v_pattern
    )
  order by
    case when v_sort = 'nombre' and not v_desc then lower(a.nombre) end asc,
    case when v_sort = 'nombre' and v_desc then lower(a.nombre) end desc,
    case when v_sort = 'categoria' and not v_desc then lower(c.nombre) end asc,
    case when v_sort = 'categoria' and v_desc then lower(c.nombre) end desc,
    case when v_sort = 'cantidad' and not v_desc then a.cantidad end asc,
    case when v_sort = 'cantidad' and v_desc then a.cantidad end desc,
    case when v_sort = 'ubicacion' and not v_desc then lower(u.nombre) end asc,
    case when v_sort = 'ubicacion' and v_desc then lower(u.nombre) end desc,
    case when v_sort = 'condicion' and not v_desc then a.condicion end asc,
    case when v_sort = 'condicion' and v_desc then a.condicion end desc,
    case when v_sort = 'modificado' and not v_desc then a.modificado_en end asc,
    case when v_sort = 'modificado' and v_desc then a.modificado_en end desc,
    lower(a.nombre) asc,
    a.id asc
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.list_inventory_items(uuid, text, uuid, uuid, text, text, text, text, integer, integer, uuid)
  from public, anon;
grant execute on function public.list_inventory_items(uuid, text, uuid, uuid, text, text, text, text, integer, integer, uuid)
  to authenticated;

create or replace function public.get_inventory_sede_counts()
returns table (sede_id uuid, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.inventory_require('events.inventory.read');
  return query
  select s.id, count(a.id)
  from public.inventario_sedes s
  left join public.inventario_articulos a on a.sede_id = s.id
  where s.activa
  group by s.id;
end;
$$;
revoke all on function public.get_inventory_sede_counts() from public, anon;
grant execute on function public.get_inventory_sede_counts() to authenticated;

create or replace function public.get_inventory_item_activity(
  p_articulo_id uuid,
  p_tipo text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  tipo text,
  cantidad numeric,
  delta numeric,
  origen_sede_nombre text,
  origen_ubicacion_nombre text,
  destino_sede_nombre text,
  destino_ubicacion_nombre text,
  origen_externo text,
  destino_externo text,
  fecha_hora timestamptz,
  registrado_por uuid,
  registrado_por_nombre text,
  registrado_en timestamptz,
  estado text,
  observacion text,
  saldo numeric,
  corrige_movimiento_id uuid,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.inventory_require('events.inventory.read');

  return query
  select
    m.id, m.tipo, m.cantidad,
    -- Cambio de saldo visto desde este artículo/lote.
    case
      when m.destino_articulo_id = p_articulo_id then m.cantidad
      when m.tipo = 'TRASLADO' and m.destino_articulo_id is null then 0::numeric
      when m.tipo in ('TRASLADO', 'SALIDA') then -m.cantidad
      else m.cantidad
    end,
    os.nombre, ou.nombre, ds.nombre, du.nombre,
    m.origen_externo, m.destino_externo,
    m.fecha_hora, m.registrado_por, pr.full_name, m.registrado_en,
    m.estado, m.observacion,
    case when m.destino_articulo_id = p_articulo_id then m.saldo_destino else m.saldo_resultante end,
    m.corrige_movimiento_id,
    count(*) over ()
  from public.inventario_movimientos m
  left join public.inventario_sedes os on os.id = m.origen_sede_id
  left join public.inventario_ubicaciones ou on ou.id = m.origen_ubicacion_id
  left join public.inventario_sedes ds on ds.id = m.destino_sede_id
  left join public.inventario_ubicaciones du on du.id = m.destino_ubicacion_id
  left join public.profiles pr on pr.user_id = m.registrado_por
  where (m.articulo_id = p_articulo_id or m.destino_articulo_id = p_articulo_id)
    and (
      p_tipo is null
      or (p_tipo = 'AJUSTE' and m.tipo in ('AJUSTE', 'CONTEO_INICIAL'))
      or (p_tipo <> 'AJUSTE' and m.tipo = p_tipo)
    )
  order by m.fecha_hora desc, m.registrado_en desc, m.id desc
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.get_inventory_item_activity(uuid, text, integer, integer) from public, anon;
grant execute on function public.get_inventory_item_activity(uuid, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Escritura
-- ---------------------------------------------------------------------------

create or replace function public.create_inventory_location(p_sede_id uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := nullif(trim(p_nombre), '');
  v_id uuid;
begin
  perform public.inventory_require('events.inventory.locations.create');
  if v_nombre is null or length(v_nombre) > 80 then
    raise exception 'El nombre de la ubicación debe tener entre 1 y 80 caracteres.';
  end if;
  if not exists (select 1 from public.inventario_sedes s where s.id = p_sede_id and s.activa) then
    raise exception 'La sede no existe o está inactiva.';
  end if;

  insert into public.inventario_ubicaciones (sede_id, nombre, created_by)
  values (p_sede_id, v_nombre, (select auth.uid()))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe una ubicación con ese nombre en esta sede.';
end;
$$;
revoke all on function public.create_inventory_location(uuid, text) from public, anon;
grant execute on function public.create_inventory_location(uuid, text) to authenticated;

create or replace function public.create_inventory_item(
  p_categoria_id uuid,
  p_nombre text,
  p_especificaciones text,
  p_tipo_control text,
  p_codigo text,
  p_cantidad numeric,
  p_unidad_medida text,
  p_ubicacion_id uuid,
  p_condicion text,
  p_atributos jsonb default '{}'::jsonb,
  p_observacion text default null,
  p_confirmar_duplicado boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_nombre text := nullif(trim(p_nombre), '');
  v_espec text := nullif(trim(p_especificaciones), '');
  v_codigo text := nullif(trim(p_codigo), '');
  v_unidad text := coalesce(nullif(trim(p_unidad_medida), ''), 'unidades');
  v_obs text := nullif(trim(p_observacion), '');
  v_ubicacion public.inventario_ubicaciones;
  v_cantidad numeric;
  v_id uuid;
begin
  perform public.inventory_require('events.inventory.create');

  if v_nombre is null or length(v_nombre) > 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres.';
  end if;
  if v_espec is not null and length(v_espec) > 2000 then
    raise exception 'Las especificaciones no pueden superar 2000 caracteres.';
  end if;
  if length(v_unidad) > 30 then
    raise exception 'La unidad de medida no puede superar 30 caracteres.';
  end if;
  if v_obs is not null and length(v_obs) > 500 then
    raise exception 'La observación no puede superar 500 caracteres.';
  end if;
  if p_tipo_control not in ('LOTE', 'INDIVIDUAL') then
    raise exception 'El tipo de control no es válido.';
  end if;
  if p_condicion not in ('DISPONIBLE', 'DANADO', 'EN_REPARACION', 'DADO_DE_BAJA') then
    raise exception 'La condición no es válida.';
  end if;
  if jsonb_typeof(coalesce(p_atributos, '{}'::jsonb)) <> 'object' then
    raise exception 'Los atributos deben ser un objeto.';
  end if;
  if not exists (select 1 from public.inventario_categorias c where c.id = p_categoria_id and c.activa) then
    raise exception 'La categoría no existe o está inactiva.';
  end if;

  select u.* into v_ubicacion
  from public.inventario_ubicaciones u
  join public.inventario_sedes s on s.id = u.sede_id
  where u.id = p_ubicacion_id and u.activa and s.activa;
  if not found then
    raise exception 'La ubicación no existe o está inactiva.';
  end if;

  if p_tipo_control = 'INDIVIDUAL' then
    if v_codigo is null then
      raise exception 'Una unidad individual necesita un código o etiqueta.';
    end if;
    v_cantidad := 1;
  else
    if v_codigo is not null then
      raise exception 'Un artículo por cantidad o lote no lleva código individual.';
    end if;
    if p_cantidad is null or p_cantidad < 0 or p_cantidad <> round(p_cantidad, 2) or p_cantidad >= 10000000000 then
      raise exception 'La cantidad debe ser un número igual o mayor que 0, con hasta 2 decimales.';
    end if;
    v_cantidad := p_cantidad;

    if not coalesce(p_confirmar_duplicado, false) and exists (
      select 1 from public.inventario_articulos a
      where a.tipo_control = 'LOTE'
        and a.ubicacion_id = v_ubicacion.id
        and a.categoria_id = p_categoria_id
        and lower(trim(a.nombre)) = lower(v_nombre)
        and coalesce(trim(a.especificaciones), '') = coalesce(v_espec, '')
    ) then
      raise exception 'POSIBLE_DUPLICADO';
    end if;
  end if;

  insert into public.inventario_articulos (
    categoria_id, nombre, especificaciones, atributos, tipo_control, codigo, cantidad,
    unidad_medida, sede_id, ubicacion_id, condicion, creado_por, modificado_por
  )
  values (
    p_categoria_id, v_nombre, v_espec, coalesce(p_atributos, '{}'::jsonb), p_tipo_control, v_codigo, v_cantidad,
    v_unidad, v_ubicacion.sede_id, v_ubicacion.id, p_condicion, v_actor, v_actor
  )
  returning id into v_id;

  insert into public.inventario_movimientos (
    articulo_id, tipo, cantidad, destino_sede_id, destino_ubicacion_id,
    registrado_por, observacion, saldo_resultante
  )
  values (
    v_id, 'CONTEO_INICIAL', v_cantidad, v_ubicacion.sede_id, v_ubicacion.id,
    v_actor, v_obs, v_cantidad
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe otra unidad con ese código o etiqueta.';
end;
$$;
revoke all on function public.create_inventory_item(uuid, text, text, text, text, numeric, text, uuid, text, jsonb, text, boolean)
  from public, anon;
grant execute on function public.create_inventory_item(uuid, text, text, text, text, numeric, text, uuid, text, jsonb, text, boolean)
  to authenticated;

-- Edita datos descriptivos. Cantidad, sede y ubicación solo cambian con movimientos.
create or replace function public.update_inventory_item(
  p_articulo_id uuid,
  p_expected_version integer,
  p_categoria_id uuid,
  p_nombre text,
  p_especificaciones text,
  p_codigo text,
  p_unidad_medida text,
  p_condicion text,
  p_atributos jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.inventario_articulos;
  v_nombre text := nullif(trim(p_nombre), '');
  v_espec text := nullif(trim(p_especificaciones), '');
  v_codigo text := nullif(trim(p_codigo), '');
  v_unidad text := coalesce(nullif(trim(p_unidad_medida), ''), 'unidades');
begin
  perform public.inventory_require('events.inventory.update');

  if v_nombre is null or length(v_nombre) > 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres.';
  end if;
  if v_espec is not null and length(v_espec) > 2000 then
    raise exception 'Las especificaciones no pueden superar 2000 caracteres.';
  end if;
  if length(v_unidad) > 30 then
    raise exception 'La unidad de medida no puede superar 30 caracteres.';
  end if;
  if p_condicion not in ('DISPONIBLE', 'DANADO', 'EN_REPARACION', 'DADO_DE_BAJA') then
    raise exception 'La condición no es válida.';
  end if;
  if jsonb_typeof(coalesce(p_atributos, '{}'::jsonb)) <> 'object' then
    raise exception 'Los atributos deben ser un objeto.';
  end if;
  if not exists (select 1 from public.inventario_categorias c where c.id = p_categoria_id and c.activa) then
    raise exception 'La categoría no existe o está inactiva.';
  end if;

  select a.* into v_item from public.inventario_articulos a where a.id = p_articulo_id for update;
  if not found then
    raise exception 'El artículo no existe.';
  end if;
  if p_expected_version is distinct from v_item.version then
    raise exception 'CONFLICTO_VERSION';
  end if;

  if v_item.tipo_control = 'INDIVIDUAL' then
    if v_codigo is null then
      raise exception 'Una unidad individual necesita un código o etiqueta.';
    end if;
  elsif v_codigo is not null then
    raise exception 'Un artículo por cantidad o lote no lleva código individual.';
  end if;

  update public.inventario_articulos a
  set categoria_id = p_categoria_id,
      nombre = v_nombre,
      especificaciones = v_espec,
      atributos = coalesce(p_atributos, '{}'::jsonb),
      codigo = v_codigo,
      unidad_medida = v_unidad,
      condicion = p_condicion,
      version = a.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where a.id = p_articulo_id
  returning a.version into v_item.version;

  return v_item.version;
exception
  when unique_violation then
    raise exception 'Ya existe otra unidad con ese código o etiqueta.';
end;
$$;
revoke all on function public.update_inventory_item(uuid, integer, uuid, text, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.update_inventory_item(uuid, integer, uuid, text, text, text, text, text, jsonb)
  to authenticated;

-- Registra un movimiento y aplica su efecto sobre el stock en la misma transacción.
--   TRASLADO: p_cantidad = cantidad que se mueve; p_destino_ubicacion_id obligatorio.
--   SALIDA:   p_cantidad = cantidad que sale; p_externo = destino fuera de las sedes (opcional).
--   RETORNO:  p_cantidad = cantidad que vuelve; p_destino_ubicacion_id opcional (por defecto la misma);
--             p_externo = de dónde regresa (opcional). El movimiento queda en la fila que recibe.
--   AJUSTE:   p_cantidad = cantidad contada (nuevo saldo); p_observacion (motivo) obligatoria.
create or replace function public.register_inventory_movement(
  p_articulo_id uuid,
  p_tipo text,
  p_cantidad numeric,
  p_expected_version integer,
  p_destino_ubicacion_id uuid default null,
  p_externo text default null,
  p_fecha_hora timestamptz default null,
  p_observacion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.inventario_articulos;
  v_target public.inventario_articulos;
  v_dest public.inventario_articulos;
  v_dest_loc public.inventario_ubicaciones;
  v_fecha timestamptz := coalesce(p_fecha_hora, now());
  v_obs text := nullif(trim(p_observacion), '');
  v_ext text := nullif(trim(p_externo), '');
  v_origen_sede uuid;
  v_origen_ubic uuid;
  v_mov_id uuid;
  v_delta numeric;
begin
  perform public.inventory_require('events.inventory.move');

  if p_tipo not in ('TRASLADO', 'SALIDA', 'RETORNO', 'AJUSTE') then
    raise exception 'El tipo de movimiento no es válido.';
  end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad <> round(p_cantidad, 2) or p_cantidad >= 10000000000 then
    raise exception 'La cantidad debe ser un número positivo con hasta 2 decimales.';
  end if;
  if p_tipo <> 'AJUSTE' and p_cantidad = 0 then
    raise exception 'La cantidad debe ser mayor que 0.';
  end if;
  if v_fecha > now() + interval '5 minutes' then
    raise exception 'La fecha del movimiento no puede estar en el futuro.';
  end if;
  if v_obs is not null and length(v_obs) > 500 then
    raise exception 'La observación no puede superar 500 caracteres.';
  end if;
  if v_ext is not null and length(v_ext) > 120 then
    raise exception 'El destino u origen externo no puede superar 120 caracteres.';
  end if;

  select a.* into v_item from public.inventario_articulos a where a.id = p_articulo_id for update;
  if not found then
    raise exception 'El artículo no existe.';
  end if;
  if p_expected_version is distinct from v_item.version then
    raise exception 'CONFLICTO_VERSION';
  end if;

  v_origen_sede := v_item.sede_id;
  v_origen_ubic := v_item.ubicacion_id;

  if p_tipo = 'TRASLADO' then
    if p_destino_ubicacion_id is null then
      raise exception 'Elige el destino del traslado.';
    end if;
    select u.* into v_dest_loc
    from public.inventario_ubicaciones u
    join public.inventario_sedes s on s.id = u.sede_id
    where u.id = p_destino_ubicacion_id and u.activa and s.activa;
    if not found then
      raise exception 'El destino no existe o está inactivo.';
    end if;
    if v_dest_loc.id = v_item.ubicacion_id then
      raise exception 'El destino debe ser distinto del origen.';
    end if;

    if v_item.tipo_control = 'INDIVIDUAL' then
      if p_cantidad <> 1 or v_item.cantidad <> 1 then
        raise exception 'Una unidad individual se traslada completa y debe estar en la sede.';
      end if;
      update public.inventario_articulos a
      set sede_id = v_dest_loc.sede_id, ubicacion_id = v_dest_loc.id,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_item;
    else
      if p_cantidad > v_item.cantidad then
        raise exception 'La cantidad supera lo disponible en el origen (% %).', v_item.cantidad, v_item.unidad_medida;
      end if;
      update public.inventario_articulos a
      set cantidad = a.cantidad - p_cantidad,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_item;
      v_dest := public.inventory_add_to_stock_row(v_item, v_dest_loc.sede_id, v_dest_loc.id, p_cantidad, v_actor);
    end if;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_sede_id, origen_ubicacion_id,
      destino_sede_id, destino_ubicacion_id, destino_articulo_id,
      fecha_hora, registrado_por, observacion, saldo_resultante, saldo_destino
    )
    values (
      v_item.id, 'TRASLADO', p_cantidad, v_origen_sede, v_origen_ubic,
      v_dest_loc.sede_id, v_dest_loc.id, v_dest.id,
      v_fecha, v_actor, v_obs, v_item.cantidad, v_dest.cantidad
    )
    returning id into v_mov_id;

  elsif p_tipo = 'SALIDA' then
    if v_item.tipo_control = 'INDIVIDUAL' and p_cantidad <> 1 then
      raise exception 'Una unidad individual sale completa.';
    end if;
    if p_cantidad > v_item.cantidad then
      raise exception 'La cantidad supera lo disponible en el origen (% %).', v_item.cantidad, v_item.unidad_medida;
    end if;
    update public.inventario_articulos a
    set cantidad = a.cantidad - p_cantidad,
        version = a.version + 1, modificado_en = now(), modificado_por = v_actor
    where a.id = v_item.id
    returning a.* into v_item;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_sede_id, origen_ubicacion_id, destino_externo,
      fecha_hora, registrado_por, observacion, saldo_resultante
    )
    values (
      v_item.id, 'SALIDA', p_cantidad, v_origen_sede, v_origen_ubic, v_ext,
      v_fecha, v_actor, v_obs, v_item.cantidad
    )
    returning id into v_mov_id;

  elsif p_tipo = 'RETORNO' then
    if p_destino_ubicacion_id is null or p_destino_ubicacion_id = v_item.ubicacion_id then
      select u.* into v_dest_loc from public.inventario_ubicaciones u where u.id = v_item.ubicacion_id;
    else
      select u.* into v_dest_loc
      from public.inventario_ubicaciones u
      join public.inventario_sedes s on s.id = u.sede_id
      where u.id = p_destino_ubicacion_id and u.activa and s.activa;
      if not found then
        raise exception 'El destino no existe o está inactivo.';
      end if;
    end if;

    if v_item.tipo_control = 'INDIVIDUAL' then
      if p_cantidad <> 1 or v_item.cantidad <> 0 then
        raise exception 'Esta unidad ya está registrada en la sede; no tiene un retorno pendiente.';
      end if;
      update public.inventario_articulos a
      set cantidad = 1, sede_id = v_dest_loc.sede_id, ubicacion_id = v_dest_loc.id,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_target;
    elsif v_dest_loc.id = v_item.ubicacion_id then
      update public.inventario_articulos a
      set cantidad = a.cantidad + p_cantidad,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_target;
    else
      v_target := public.inventory_add_to_stock_row(v_item, v_dest_loc.sede_id, v_dest_loc.id, p_cantidad, v_actor);
    end if;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_externo, destino_sede_id, destino_ubicacion_id,
      fecha_hora, registrado_por, observacion, saldo_resultante
    )
    values (
      v_target.id, 'RETORNO', p_cantidad, v_ext, v_dest_loc.sede_id, v_dest_loc.id,
      v_fecha, v_actor, v_obs, v_target.cantidad
    )
    returning id into v_mov_id;
    v_item := v_target;

  else -- AJUSTE
    if v_obs is null then
      raise exception 'Indica el motivo del ajuste.';
    end if;
    if v_item.tipo_control = 'INDIVIDUAL' and p_cantidad not in (0, 1) then
      raise exception 'Una unidad individual se cuenta como 0 o 1.';
    end if;
    v_delta := p_cantidad - v_item.cantidad;
    if v_delta = 0 then
      raise exception 'El conteo coincide con la cantidad registrada.';
    end if;
    update public.inventario_articulos a
    set cantidad = p_cantidad,
        version = a.version + 1, modificado_en = now(), modificado_por = v_actor
    where a.id = v_item.id
    returning a.* into v_item;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_sede_id, origen_ubicacion_id,
      fecha_hora, registrado_por, observacion, saldo_resultante
    )
    values (
      v_item.id, 'AJUSTE', v_delta, v_origen_sede, v_origen_ubic,
      v_fecha, v_actor, v_obs, v_item.cantidad
    )
    returning id into v_mov_id;
  end if;

  return jsonb_build_object(
    'movimiento_id', v_mov_id,
    'articulo_id', v_item.id,
    'version', v_item.version,
    'destino_articulo_id', v_dest.id
  );
end;
$$;
revoke all on function public.register_inventory_movement(uuid, text, numeric, integer, uuid, text, timestamptz, text)
  from public, anon;
grant execute on function public.register_inventory_movement(uuid, text, numeric, integer, uuid, text, timestamptz, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
