-- Programación y planificación de eventos del rol Eventos.
--
-- Migración del módulo de programación de eventos. Aplicar completa desde SQL Editor de Supabase
-- (o con Supabase CLI) antes de usar las rutas de la aplicación. Después, verificar el esquema.
--
-- Diseño: docs/design/plan-eventos-programacion.md y docs/design/prototypes/events-schedule/.
-- Sigue el patrón del inventario (202610130001): RLS solo de lectura, escritura únicamente por
-- funciones SECURITY DEFINER con search_path vacío, control de versión y historial inmutable.
--
-- Depende de: public.profiles, public.has_permission, public.app_permissions,
-- public.role_permissions, public.inventario_sedes y public.campanas.
--
-- Decisiones fijadas en esta propuesta:
--   * Un evento ocurre en una o varias tiendas (evento_sedes) con un único horario.
--   * inicio y fin son timestamptz; la interfaz los muestra y captura en America/Caracas.
--   * En curso y Terminado se aplican solos por la hora (sync_event_statuses). Toda lectura y
--     toda escritura la ejecutan primero, así que el estado es correcto sin cron.
--   * Cancelado es una propuesta del plan (D11); puede ocurrir sin fechas.
--   * Tipo, origen y estado son texto con CHECK (no ENUM) para ampliarlos con una migración.
--   * Moneda: USD para esta entrega.
--   * Materiales y patrocinadores: texto libre guardado en eventos, sin tablas de listas.
--   * Umbrales aceptados: 7 días (Incompleto) y 3 días (materiales sin declarar).
--   * Fuera de esta migración: evento_tareas, inscritos, reservas de inventario.

begin;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 160),
  descripcion text check (descripcion is null or length(descripcion) <= 2000),
  tipo text not null check (tipo in ('DEGUSTACION', 'IMPULSO', 'OTRO')),
  tipo_otro text check (tipo_otro is null or length(trim(tipo_otro)) between 1 and 60),
  origen text not null check (origen in ('PROPIO', 'PROVEEDOR')),
  proveedor_nombre text check (proveedor_nombre is null or length(trim(proveedor_nombre)) between 1 and 120),
  inicio timestamptz,
  fin timestamptz,
  estatus text not null default 'EN_PLANIFICACION'
    check (estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO', 'TERMINADO', 'CANCELADO')),
  responsable_id uuid references auth.users(id) on delete set null,
  campana_id uuid references public.campanas(id) on delete set null,
  presupuesto_estimado numeric(14, 2) check (presupuesto_estimado is null or presupuesto_estimado >= 0),
  moneda text not null default 'USD' check (moneda = 'USD'),
  patrocinadores text check (patrocinadores is null or length(patrocinadores) <= 2000),
  materiales text check (materiales is null or length(materiales) <= 2000),
  gasto_real numeric(14, 2) check (gasto_real is null or gasto_real >= 0),
  requiere_inscripcion boolean not null default false,
  inscripcion_cupo integer check (inscripcion_cupo is null or inscripcion_cupo >= 1),
  inscripcion_limite timestamptz,
  inscripcion_info text check (inscripcion_info is null or length(inscripcion_info) <= 500),
  asistentes_esperados integer check (asistentes_esperados is null or asistentes_esperados >= 0),
  asistentes_reales integer check (asistentes_reales is null or asistentes_reales >= 0),
  notas_cierre text check (notas_cierre is null or length(notas_cierre) <= 2000),
  archivado_en timestamptz,
  archivado_por uuid references auth.users(id) on delete set null,
  -- Se incrementa en cada cambio (también los automáticos) para detectar ediciones simultáneas.
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  modificado_en timestamptz not null default now(),
  -- Nulo cuando el cambio lo hizo el sistema (estados automáticos).
  modificado_por uuid references auth.users(id) on delete set null,
  constraint eventos_fechas_juntas_check check ((inicio is null) = (fin is null)),
  constraint eventos_fin_despues_inicio_check check (fin is null or fin > inicio),
  -- Un borrador (y un evento cancelado) puede no tener fecha; los demás estados sí.
  constraint eventos_estatus_con_fecha_check
    check (estatus in ('EN_PLANIFICACION', 'CANCELADO') or inicio is not null),
  constraint eventos_tipo_otro_solo_otro_check check (tipo = 'OTRO' or tipo_otro is null),
  constraint eventos_proveedor_check
    check ((origen = 'PROVEEDOR') = (proveedor_nombre is not null)),
  constraint eventos_inscripcion_check
    check (requiere_inscripcion
           or (inscripcion_cupo is null and inscripcion_limite is null and inscripcion_info is null)),
  constraint eventos_archivado_check
    check (archivado_en is null or estatus in ('TERMINADO', 'CANCELADO'))
);
create index if not exists eventos_estatus_inicio_idx on public.eventos (estatus, inicio);
create index if not exists eventos_estatus_fin_idx on public.eventos (estatus, fin);
create index if not exists eventos_inicio_idx on public.eventos (inicio) where inicio is not null;
create index if not exists eventos_responsable_idx on public.eventos (responsable_id);

create table if not exists public.evento_sedes (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  sede_id uuid not null references public.inventario_sedes(id),
  -- Texto libre por tienda (p. ej. "Pasillo central"); no es el catálogo de ubicaciones del inventario.
  zona text check (zona is null or length(trim(zona)) between 1 and 80),
  primary key (evento_id, sede_id)
);
create index if not exists evento_sedes_sede_idx on public.evento_sedes (sede_id, evento_id);

-- Historial: una fila por cambio de estado o reprogramación. Solo se agregan filas.
create table if not exists public.evento_historial (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  tipo text not null check (tipo in ('ESTATUS', 'REPROGRAMACION')),
  -- ESTATUS: {"estatus": "..."}. REPROGRAMACION: {"inicio": "...", "fin": "...", "sedes": ["Prebo", ...]}.
  anterior jsonb not null,
  nuevo jsonb not null,
  motivo text check (motivo is null or length(motivo) <= 300),
  -- Nulo = Sistema (cambio automático por la hora).
  cambiado_por uuid references auth.users(id) on delete set null,
  cambiado_en timestamptz not null default now()
);
create index if not exists evento_historial_evento_idx
  on public.evento_historial (evento_id, cambiado_en desc);

create or replace function public.guard_event_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Se permite el borrado en cascada solo si el evento padre ya no existe.
  if tg_op = 'DELETE' and not exists (select 1 from public.eventos e where e.id = old.evento_id) then
    return old;
  end if;
  raise exception 'El historial del evento no se puede editar ni eliminar.';
end;
$$;

drop trigger if exists guard_event_history_immutable on public.evento_historial;
create trigger guard_event_history_immutable
before update or delete on public.evento_historial
for each row execute function public.guard_event_history_immutable();
revoke all on function public.guard_event_history_immutable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos del rol events
-- ---------------------------------------------------------------------------

insert into public.app_permissions (code, description)
values
  ('events.schedule.read', 'Consultar el calendario y los eventos de Eventos'),
  ('events.schedule.create', 'Crear eventos'),
  ('events.schedule.update', 'Editar, reprogramar y registrar el cierre de eventos'),
  ('events.schedule.status.update', 'Programar, cancelar y terminar eventos'),
  ('events.schedule.archive', 'Archivar y restaurar eventos')
on conflict (code) do update set description = excluded.description;

-- Solo el rol events recibe estos permisos (decisión del 2026-10-15).
insert into public.role_permissions (role_code, permission_code)
select 'events', permission.code
from public.app_permissions permission
where permission.code in (
  'events.schedule.read',
  'events.schedule.create',
  'events.schedule.update',
  'events.schedule.status.update',
  'events.schedule.archive'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS: lectura por permiso; sin escritura directa
-- ---------------------------------------------------------------------------

alter table public.eventos enable row level security;
alter table public.evento_sedes enable row level security;
alter table public.evento_historial enable row level security;

revoke all on public.eventos from anon, authenticated;
revoke all on public.evento_sedes from anon, authenticated;
revoke all on public.evento_historial from anon, authenticated;

grant select on public.eventos to authenticated;
grant select on public.evento_sedes to authenticated;
grant select on public.evento_historial to authenticated;

drop policy if exists "app_permissions_read_events" on public.eventos;
create policy "app_permissions_read_events"
  on public.eventos for select to authenticated
  using ((select public.has_permission('events.schedule.read')));

drop policy if exists "app_permissions_read_event_sedes" on public.evento_sedes;
create policy "app_permissions_read_event_sedes"
  on public.evento_sedes for select to authenticated
  using ((select public.has_permission('events.schedule.read')));

drop policy if exists "app_permissions_read_event_history" on public.evento_historial;
create policy "app_permissions_read_event_history"
  on public.evento_historial for select to authenticated
  using ((select public.has_permission('events.schedule.read')));

-- ---------------------------------------------------------------------------
-- Funciones internas (no ejecutables por anon ni authenticated)
-- ---------------------------------------------------------------------------

create or replace function public.events_require(p_permission text)
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
revoke all on function public.events_require(text) from public, anon, authenticated;

-- Aplica los cambios automáticos por la hora. Es idempotente y puede llamarse tantas veces
-- como se quiera: Programado -> En curso al llegar inicio, y En curso -> Terminado al llegar
-- fin (un Programado ya vencido pasa directo a Terminado). Cada cambio sube version y deja
-- una fila de historial sin actor (Sistema). Las filas bloqueadas por otra transacción se
-- omiten y se procesan en la siguiente llamada.
create or replace function public.sync_event_statuses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  with due as (
    select e.id,
           e.estatus as anterior,
           case when e.fin <= now() then 'TERMINADO' else 'EN_CURSO' end as nuevo
    from public.eventos e
    where (e.estatus = 'PROGRAMADO' and e.inicio <= now())
       or (e.estatus = 'EN_CURSO' and e.fin <= now())
    for update skip locked
  ),
  upd as (
    update public.eventos e
    set estatus = due.nuevo,
        version = e.version + 1,
        modificado_en = now(),
        modificado_por = null
    from due
    where e.id = due.id
    returning e.id, due.anterior, due.nuevo
  ),
  logged as (
    insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    select upd.id, 'ESTATUS',
           jsonb_build_object('estatus', upd.anterior),
           jsonb_build_object('estatus', upd.nuevo),
           null, null
    from upd
    returning 1
  )
  select count(*) into v_changed from logged;

  return v_changed;
end;
$$;
revoke all on function public.sync_event_statuses() from public, anon, authenticated;

create or replace function public.events_sede_names(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.nombre order by s.orden, s.nombre), '[]'::jsonb)
  from public.inventario_sedes s
  where s.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;
revoke all on function public.events_sede_names(uuid[]) from public, anon, authenticated;

-- Eventos que se solapan con un horario en al menos una de las tiendas dadas.
-- Cuentan los que están en planificación (con fecha), programados y en curso; no cuentan los
-- terminados, cancelados ni archivados. Los rangos son [inicio, fin): dos eventos seguidos
-- (uno termina cuando empieza el otro) no se cruzan.
create or replace function public.events_find_overlaps(
  p_evento_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_sede_ids uuid[]
)
returns table (
  evento_id uuid,
  nombre text,
  estatus text,
  inicio timestamptz,
  fin timestamptz,
  sede_id uuid,
  sede_nombre text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre, e.estatus, e.inicio, e.fin, s.id, s.nombre
  from public.eventos e
  join public.evento_sedes es on es.evento_id = e.id
  join public.inventario_sedes s on s.id = es.sede_id
  where p_inicio is not null
    and p_fin is not null
    and es.sede_id = any(coalesce(p_sede_ids, '{}'::uuid[]))
    and e.id is distinct from p_evento_id
    and e.archivado_en is null
    and e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO')
    and e.inicio is not null
    and tstzrange(e.inicio, e.fin) && tstzrange(p_inicio, p_fin)
  order by e.inicio, s.orden, e.nombre;
$$;
revoke all on function public.events_find_overlaps(uuid, timestamptz, timestamptz, uuid[])
  from public, anon, authenticated;

-- Lanza POSIBLE_CRUCE (con la lista en detail) si hay cruces y no se confirmó continuar.
create or replace function public.events_raise_if_overlap(
  p_evento_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_sede_ids uuid[],
  p_confirmar boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_detail jsonb;
begin
  if coalesce(p_confirmar, false) then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
           'evento_id', o.evento_id, 'nombre', o.nombre, 'estatus', o.estatus,
           'inicio', o.inicio, 'fin', o.fin, 'sede_id', o.sede_id, 'sede_nombre', o.sede_nombre))
  into v_detail
  from public.events_find_overlaps(p_evento_id, p_inicio, p_fin, p_sede_ids) o;

  if v_detail is not null then
    raise exception 'POSIBLE_CRUCE' using detail = v_detail::text;
  end if;
end;
$$;
revoke all on function public.events_raise_if_overlap(uuid, timestamptz, timestamptz, uuid[], boolean)
  from public, anon, authenticated;

-- Valida y normaliza los datos que envía el formulario. Devuelve un jsonb con los mismos
-- campos ya recortados y tipados. Reglas que dependen del estado (programar, reprogramar)
-- se comprueban en cada función de escritura.
create or replace function public.events_normalize(p_datos jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_descripcion text;
  v_tipo text;
  v_tipo_otro text;
  v_origen text;
  v_proveedor text;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_responsable uuid;
  v_campana uuid;
  v_presupuesto numeric;
  v_moneda text;
  v_patrocinadores text;
  v_materiales text;
  v_requiere boolean;
  v_cupo integer;
  v_limite timestamptz;
  v_info text;
  v_esperados integer;
  v_sedes jsonb;
  v_total integer;
  v_distintas integer;
  v_con_id integer;
  v_zona_larga boolean;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos del evento no son válidos.';
  end if;

  begin
    v_nombre := nullif(trim(p_datos->>'nombre'), '');
    v_descripcion := nullif(trim(p_datos->>'descripcion'), '');
    v_tipo := nullif(trim(p_datos->>'tipo'), '');
    v_tipo_otro := nullif(trim(p_datos->>'tipo_otro'), '');
    v_origen := nullif(trim(p_datos->>'origen'), '');
    v_proveedor := nullif(trim(p_datos->>'proveedor_nombre'), '');
    v_inicio := nullif(trim(p_datos->>'inicio'), '')::timestamptz;
    v_fin := nullif(trim(p_datos->>'fin'), '')::timestamptz;
    v_responsable := nullif(trim(p_datos->>'responsable_id'), '')::uuid;
    v_campana := nullif(trim(p_datos->>'campana_id'), '')::uuid;
    v_presupuesto := nullif(trim(p_datos->>'presupuesto_estimado'), '')::numeric;
    v_moneda := coalesce(nullif(trim(p_datos->>'moneda'), ''), 'USD');
    v_patrocinadores := nullif(trim(p_datos->>'patrocinadores'), '');
    v_materiales := nullif(trim(p_datos->>'materiales'), '');
    v_requiere := coalesce(nullif(trim(p_datos->>'requiere_inscripcion'), '')::boolean, false);
    v_cupo := nullif(trim(p_datos->>'inscripcion_cupo'), '')::integer;
    v_limite := nullif(trim(p_datos->>'inscripcion_limite'), '')::timestamptz;
    v_info := nullif(trim(p_datos->>'inscripcion_info'), '');
    v_esperados := nullif(trim(p_datos->>'asistentes_esperados'), '')::integer;
  exception
    when invalid_datetime_format or invalid_text_representation
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'Alguno de los datos tiene un formato no válido.';
  end;

  if v_nombre is null or length(v_nombre) > 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres.';
  end if;
  if v_descripcion is not null and length(v_descripcion) > 2000 then
    raise exception 'La descripción no puede superar 2000 caracteres.';
  end if;
  if v_tipo is null or v_tipo not in ('DEGUSTACION', 'IMPULSO', 'OTRO') then
    raise exception 'El tipo de evento no es válido.';
  end if;
  if v_tipo = 'OTRO' then
    if v_tipo_otro is null or length(v_tipo_otro) > 60 then
      raise exception 'Indica el tipo de evento (hasta 60 caracteres).';
    end if;
  else
    v_tipo_otro := null;
  end if;
  if v_origen is null or v_origen not in ('PROPIO', 'PROVEEDOR') then
    raise exception 'El origen del evento no es válido.';
  end if;
  if v_origen = 'PROVEEDOR' then
    if v_proveedor is null or length(v_proveedor) > 120 then
      raise exception 'Indica el proveedor (hasta 120 caracteres).';
    end if;
  else
    v_proveedor := null;
  end if;

  if (v_inicio is null) <> (v_fin is null) then
    raise exception 'Indica la fecha y hora de inicio y de fin, o ninguna de las dos.';
  end if;
  if v_fin is not null and v_fin <= v_inicio then
    raise exception 'El fin debe ser posterior al inicio.';
  end if;

  if v_moneda <> 'USD' then
    raise exception 'La moneda para esta entrega debe ser USD.';
  end if;
  if v_patrocinadores is not null and length(v_patrocinadores) > 2000 then
    raise exception 'El texto de patrocinadores no puede superar 2000 caracteres.';
  end if;
  if v_materiales is not null and length(v_materiales) > 2000 then
    raise exception 'El texto de materiales no puede superar 2000 caracteres.';
  end if;
  if v_presupuesto is not null then
    if v_presupuesto < 0 or v_presupuesto >= 1000000000000 then
      raise exception 'El presupuesto debe ser un monto positivo.';
    end if;
    v_presupuesto := round(v_presupuesto, 2);
  end if;
  if v_esperados is not null and v_esperados < 0 then
    raise exception 'Los asistentes esperados no pueden ser negativos.';
  end if;

  if v_requiere then
    if v_cupo is not null and v_cupo < 1 then
      raise exception 'El cupo debe ser al menos 1.';
    end if;
    if v_info is not null and length(v_info) > 500 then
      raise exception 'Las instrucciones de inscripción no pueden superar 500 caracteres.';
    end if;
    if v_limite is not null and v_inicio is not null and v_limite > v_inicio then
      raise exception 'La fecha límite de inscripción no puede ser posterior al inicio.';
    end if;
  else
    v_cupo := null;
    v_limite := null;
    v_info := null;
  end if;

  if v_responsable is not null
     and not exists (select 1 from public.profiles p where p.user_id = v_responsable) then
    raise exception 'El responsable no existe.';
  end if;
  if v_campana is not null
     and not exists (select 1 from public.campanas c where c.id = v_campana) then
    raise exception 'La campaña no existe.';
  end if;

  if jsonb_typeof(p_datos->'sedes') is distinct from 'array'
     or jsonb_array_length(p_datos->'sedes') not between 1 and 30 then
    raise exception 'Selecciona al menos una tienda.';
  end if;

  begin
    select jsonb_agg(jsonb_build_object('sede_id', s.sede_id, 'zona', s.zona) order by s.sede_id),
           count(*), count(distinct s.sede_id), count(s.sede_id),
           coalesce(bool_or(length(s.zona) > 80), false)
    into v_sedes, v_total, v_distintas, v_con_id, v_zona_larga
    from (
      select (x->>'sede_id')::uuid as sede_id, nullif(trim(x->>'zona'), '') as zona
      from jsonb_array_elements(p_datos->'sedes') x
    ) s;
  exception
    when invalid_text_representation then
      raise exception 'Alguna tienda no es válida.';
  end;

  if v_con_id <> v_total or v_distintas <> v_total then
    raise exception 'Las tiendas no son válidas o están repetidas.';
  end if;
  if v_zona_larga then
    raise exception 'La zona de cada tienda no puede superar 80 caracteres.';
  end if;
  if (select count(*) from public.inventario_sedes si
      where si.activa and si.id in (select (x->>'sede_id')::uuid from jsonb_array_elements(v_sedes) x)
     ) <> v_total then
    raise exception 'Alguna tienda no existe o está inactiva.';
  end if;

  return jsonb_build_object(
    'nombre', v_nombre, 'descripcion', v_descripcion, 'tipo', v_tipo, 'tipo_otro', v_tipo_otro,
    'origen', v_origen, 'proveedor_nombre', v_proveedor, 'inicio', v_inicio, 'fin', v_fin,
    'responsable_id', v_responsable, 'campana_id', v_campana,
    'presupuesto_estimado', v_presupuesto, 'moneda', v_moneda,
    'patrocinadores', v_patrocinadores, 'materiales', v_materiales,
    'requiere_inscripcion', v_requiere, 'inscripcion_cupo', v_cupo,
    'inscripcion_limite', v_limite, 'inscripcion_info', v_info,
    'asistentes_esperados', v_esperados, 'sedes', v_sedes
  );
end;
$$;
revoke all on function public.events_normalize(jsonb) from public, anon, authenticated;

-- Para pasar a Programado (o mantenerlo así al editarlo) el evento debe estar completo.
-- Lanza FALTAN_DATOS con la lista de campos en detail.
create or replace function public.events_assert_ready(
  p_responsable_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_check_future boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_missing text[] := '{}';
begin
  if p_responsable_id is null then v_missing := v_missing || 'responsable'::text; end if;
  if p_inicio is null then v_missing := v_missing || 'inicio'::text; end if;
  if p_fin is null then v_missing := v_missing || 'fin'::text; end if;
  if cardinality(v_missing) > 0 then
    raise exception 'FALTAN_DATOS' using detail = array_to_string(v_missing, ',');
  end if;
  if p_check_future and p_inicio <= now() then
    raise exception 'Un evento programado debe empezar en el futuro.';
  end if;
end;
$$;
revoke all on function public.events_assert_ready(uuid, timestamptz, timestamptz, boolean)
  from public, anon, authenticated;

-- Indicadores derivados. Los umbrales de 7 y 3 días fueron aceptados para esta entrega.
-- Con materiales en texto libre no se puede medir avance; el indicador solo detecta
-- que no se declaró ningún material cuando faltan menos de 3 días.
create or replace function public.events_flags(e public.eventos)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'proximo',
      e.estatus = 'PROGRAMADO' and e.inicio > now() and e.inicio <= now() + interval '48 hours',
    'fecha_vencida',
      e.estatus = 'EN_PLANIFICACION' and e.inicio is not null and e.inicio <= now(),
    'incompleto',
      e.estatus = 'EN_PLANIFICACION' and e.inicio is not null
      and e.inicio > now() and e.inicio < now() + interval '7 days'
      and (e.responsable_id is null or e.presupuesto_estimado is null or nullif(trim(e.materiales), '') is null),
    'materiales_sin_declarar',
      e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO') and nullif(trim(e.materiales), '') is null
      and e.inicio is not null and e.inicio > now() and e.inicio < now() + interval '3 days',
    'cierre_pendiente',
      e.estatus = 'TERMINADO' and e.asistentes_reales is null
      and e.gasto_real is null and e.notas_cierre is null
  );
$$;
revoke all on function public.events_flags(public.eventos) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lectura
-- ---------------------------------------------------------------------------

-- Nombres de responsables disponibles para el formulario. profiles solo es legible
-- por su propio usuario, por eso esta lista se expone detrás del permiso Events.
create or replace function public.list_event_responsables()
returns table (user_id uuid, full_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.events_require('events.schedule.read');
  return query
  select p.user_id, p.full_name
  from public.profiles p
  where p.role_code = 'events'
  order by lower(coalesce(p.full_name, '')), p.user_id;
end;
$$;
revoke all on function public.list_event_responsables() from public, anon;
grant execute on function public.list_event_responsables() to authenticated;

create or replace function public.list_event_campaigns()
returns table (id uuid, nombre text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.events_require('events.schedule.read');
  return query
  select c.id, c.nombre
  from public.campanas c
  where c.activo
  order by lower(c.nombre), c.id;
end;
$$;
revoke all on function public.list_event_campaigns() from public, anon;
grant execute on function public.list_event_campaigns() to authenticated;

-- Calendario (p_desde/p_hasta: eventos que intersectan el rango) o listado paginado.
-- Sin rango también devuelve los borradores sin fecha.
create or replace function public.list_events(
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_sede_id uuid default null,
  p_estatus text default null,
  p_tipo text default null,
  p_origen text default null,
  p_responsable_id uuid default null,
  p_search text default null,
  p_archivados boolean default false,
  p_dir text default 'asc',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  nombre text,
  tipo text,
  tipo_otro text,
  origen text,
  proveedor_nombre text,
  inicio timestamptz,
  fin timestamptz,
  estatus text,
  responsable_id uuid,
  responsable_nombre text,
  presupuesto_estimado numeric,
  moneda text,
  requiere_inscripcion boolean,
  version integer,
  archivado_en timestamptz,
  con_patrocinio boolean,
  tiene_materiales boolean,
  sedes jsonb,
  hay_cruce boolean,
  indicadores jsonb,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_pattern text;
  v_desc boolean := lower(coalesce(p_dir, 'asc')) = 'desc';
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.events_require('events.schedule.read');
  perform public.sync_event_statuses();

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    e.id, e.nombre, e.tipo, e.tipo_otro, e.origen, e.proveedor_nombre, e.inicio, e.fin, e.estatus,
    e.responsable_id, pr.full_name, e.presupuesto_estimado, e.moneda, e.requiere_inscripcion,
    e.version, e.archivado_en,
    nullif(trim(e.patrocinadores), '') is not null,
    nullif(trim(e.materiales), '') is not null,
    coalesce(sd.sedes, '[]'::jsonb),
    (
      e.archivado_en is null
      and e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO')
      and exists (select 1 from public.events_find_overlaps(e.id, e.inicio, e.fin, sd.ids))
    ),
    public.events_flags(e),
    count(*) over ()
  from public.eventos e
  left join public.profiles pr on pr.user_id = e.responsable_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre, 'zona', es.zona)
                     order by s.orden, s.nombre) as sedes,
           array_agg(s.id) as ids
    from public.evento_sedes es
    join public.inventario_sedes s on s.id = es.sede_id
    where es.evento_id = e.id
  ) sd
  where (case when p_archivados then e.archivado_en is not null else e.archivado_en is null end)
    and (p_desde is null or (e.fin is not null and e.fin > p_desde))
    and (p_hasta is null or (e.inicio is not null and e.inicio < p_hasta))
    and (p_sede_id is null or p_sede_id = any(coalesce(sd.ids, '{}'::uuid[])))
    and (p_estatus is null or e.estatus = p_estatus)
    and (p_tipo is null or e.tipo = p_tipo)
    and (p_origen is null or e.origen = p_origen)
    and (p_responsable_id is null or e.responsable_id = p_responsable_id)
    and (
      v_search is null
      or e.nombre ilike v_pattern
      or coalesce(e.proveedor_nombre, '') ilike v_pattern
      or coalesce(e.descripcion, '') ilike v_pattern
      or coalesce(e.patrocinadores, '') ilike v_pattern
      or coalesce(e.materiales, '') ilike v_pattern
    )
  order by
    case when not v_desc then e.inicio end asc nulls last,
    case when v_desc then e.inicio end desc nulls last,
    lower(e.nombre) asc,
    e.id asc
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.list_events(
  timestamptz, timestamptz, uuid, text, text, text, uuid, text, boolean, text, integer, integer
) from public, anon;
grant execute on function public.list_events(
  timestamptz, timestamptz, uuid, text, text, text, uuid, text, boolean, text, integer, integer
) to authenticated;

-- Ficha completa. Devuelve cero filas si el evento no existe.
create or replace function public.get_event(p_evento_id uuid)
returns table (
  id uuid,
  nombre text,
  descripcion text,
  tipo text,
  tipo_otro text,
  origen text,
  proveedor_nombre text,
  inicio timestamptz,
  fin timestamptz,
  estatus text,
  responsable_id uuid,
  responsable_nombre text,
  campana_id uuid,
  presupuesto_estimado numeric,
  moneda text,
  gasto_real numeric,
  requiere_inscripcion boolean,
  inscripcion_cupo integer,
  inscripcion_limite timestamptz,
  inscripcion_info text,
  asistentes_esperados integer,
  asistentes_reales integer,
  notas_cierre text,
  archivado_en timestamptz,
  version integer,
  creado_en timestamptz,
  creado_por uuid,
  creado_por_nombre text,
  modificado_en timestamptz,
  modificado_por uuid,
  modificado_por_nombre text,
  sedes jsonb,
  patrocinadores text,
  materiales text,
  cruces jsonb,
  indicadores jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.events_require('events.schedule.read');
  perform public.sync_event_statuses();

  return query
  select
    e.id, e.nombre, e.descripcion, e.tipo, e.tipo_otro, e.origen, e.proveedor_nombre,
    e.inicio, e.fin, e.estatus, e.responsable_id, pr.full_name, e.campana_id,
    e.presupuesto_estimado, e.moneda, e.gasto_real,
    e.requiere_inscripcion, e.inscripcion_cupo, e.inscripcion_limite, e.inscripcion_info,
    e.asistentes_esperados, e.asistentes_reales, e.notas_cierre, e.archivado_en, e.version,
    e.creado_en, e.creado_por, pc.full_name, e.modificado_en, e.modificado_por, pm.full_name,
    coalesce(sd.sedes, '[]'::jsonb),
    e.patrocinadores,
    e.materiales,
    case
      when e.archivado_en is null and e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO') then
        coalesce((
          select jsonb_agg(jsonb_build_object(
                   'evento_id', o.evento_id, 'nombre', o.nombre, 'estatus', o.estatus,
                   'inicio', o.inicio, 'fin', o.fin, 'sede_id', o.sede_id, 'sede_nombre', o.sede_nombre))
          from public.events_find_overlaps(e.id, e.inicio, e.fin, sd.ids) o
        ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    public.events_flags(e)
  from public.eventos e
  left join public.profiles pr on pr.user_id = e.responsable_id
  left join public.profiles pc on pc.user_id = e.creado_por
  left join public.profiles pm on pm.user_id = e.modificado_por
  cross join lateral (
    select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre, 'zona', es.zona)
                     order by s.orden, s.nombre) as sedes,
           array_agg(s.id) as ids
    from public.evento_sedes es
    join public.inventario_sedes s on s.id = es.sede_id
    where es.evento_id = e.id
  ) sd
  where e.id = p_evento_id;
end;
$$;
revoke all on function public.get_event(uuid) from public, anon;
grant execute on function public.get_event(uuid) to authenticated;

create or replace function public.get_event_history(
  p_evento_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  tipo text,
  anterior jsonb,
  nuevo jsonb,
  motivo text,
  cambiado_por uuid,
  cambiado_por_nombre text,
  cambiado_en timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.events_require('events.schedule.read');
  perform public.sync_event_statuses();

  return query
  select h.id, h.tipo, h.anterior, h.nuevo, h.motivo, h.cambiado_por, p.full_name, h.cambiado_en,
         count(*) over ()
  from public.evento_historial h
  left join public.profiles p on p.user_id = h.cambiado_por
  where h.evento_id = p_evento_id
  order by h.cambiado_en desc, h.id desc
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.get_event_history(uuid, integer, integer) from public, anon;
grant execute on function public.get_event_history(uuid, integer, integer) to authenticated;

-- Para avisar en el formulario antes de guardar. No bloquea nada.
create or replace function public.check_event_overlap(
  p_evento_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_sede_ids uuid[]
)
returns table (
  evento_id uuid,
  nombre text,
  estatus text,
  inicio timestamptz,
  fin timestamptz,
  sede_id uuid,
  sede_nombre text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.events_require('events.schedule.read');
  return query select * from public.events_find_overlaps(p_evento_id, p_inicio, p_fin, p_sede_ids);
end;
$$;
revoke all on function public.check_event_overlap(uuid, timestamptz, timestamptz, uuid[]) from public, anon;
grant execute on function public.check_event_overlap(uuid, timestamptz, timestamptz, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Escritura
-- ---------------------------------------------------------------------------

-- p_datos: {nombre, descripcion, tipo, tipo_otro, origen, proveedor_nombre, inicio, fin,
-- responsable_id, campana_id, presupuesto_estimado, moneda, requiere_inscripcion,
-- inscripcion_cupo, inscripcion_limite, inscripcion_info, asistentes_esperados,
-- sedes: [{sede_id, zona}]}. Crea el evento En planificación. Sin responsable, queda quien crea.
create or replace function public.create_event(
  p_datos jsonb,
  p_confirmar_cruce boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_n jsonb;
  v_id uuid;
  v_sede_ids uuid[];
begin
  perform public.events_require('events.schedule.create');
  v_n := public.events_normalize(p_datos);

  select array_agg((x->>'sede_id')::uuid) into v_sede_ids from jsonb_array_elements(v_n->'sedes') x;

  perform public.events_raise_if_overlap(
    null, (v_n->>'inicio')::timestamptz, (v_n->>'fin')::timestamptz, v_sede_ids, p_confirmar_cruce);

  insert into public.eventos (
    nombre, descripcion, tipo, tipo_otro, origen, proveedor_nombre, inicio, fin, responsable_id,
    campana_id, presupuesto_estimado, moneda, patrocinadores, materiales, requiere_inscripcion, inscripcion_cupo,
    inscripcion_limite, inscripcion_info, asistentes_esperados, creado_por, modificado_por
  )
  values (
    v_n->>'nombre', v_n->>'descripcion', v_n->>'tipo', v_n->>'tipo_otro', v_n->>'origen',
    v_n->>'proveedor_nombre', (v_n->>'inicio')::timestamptz, (v_n->>'fin')::timestamptz,
    coalesce((v_n->>'responsable_id')::uuid, v_actor), (v_n->>'campana_id')::uuid,
    (v_n->>'presupuesto_estimado')::numeric, v_n->>'moneda', v_n->>'patrocinadores', v_n->>'materiales',
    (v_n->>'requiere_inscripcion')::boolean,
    (v_n->>'inscripcion_cupo')::integer, (v_n->>'inscripcion_limite')::timestamptz,
    v_n->>'inscripcion_info', (v_n->>'asistentes_esperados')::integer, v_actor, v_actor
  )
  returning id into v_id;

  insert into public.evento_sedes (evento_id, sede_id, zona)
  select v_id, (x->>'sede_id')::uuid, nullif(x->>'zona', '')
  from jsonb_array_elements(v_n->'sedes') x;

  return v_id;
end;
$$;
revoke all on function public.create_event(jsonb, boolean) from public, anon;
grant execute on function public.create_event(jsonb, boolean) to authenticated;

-- Edita los datos del evento. Si está Programado o En curso y cambian inicio, fin o tiendas,
-- se trata como reprogramación: exige motivo y queda en el historial. Un evento En curso solo
-- puede ampliar su fin. Terminado y Cancelado no se editan aquí. Devuelve la nueva versión.
create or replace function public.update_event(
  p_evento_id uuid,
  p_expected_version integer,
  p_datos jsonb,
  p_motivo text default null,
  p_confirmar_cruce boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_n jsonb;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_responsable uuid;
  v_old_ids uuid[];
  v_new_ids uuid[];
  v_horario_cambia boolean;
  v_motivo text := nullif(trim(p_motivo), '');
  v_version integer;
begin
  perform public.events_require('events.schedule.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento está archivado. Restáuralo para editarlo.';
  end if;
  if v_ev.estatus = 'TERMINADO' then
    raise exception 'Un evento terminado solo permite registrar su cierre.';
  end if;
  if v_ev.estatus = 'CANCELADO' then
    raise exception 'Un evento cancelado no se edita. Vuelve a planificación para modificarlo.';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.';
  end if;

  v_n := public.events_normalize(p_datos);
  v_inicio := (v_n->>'inicio')::timestamptz;
  v_fin := (v_n->>'fin')::timestamptz;
  v_responsable := (v_n->>'responsable_id')::uuid;

  select array_agg(es.sede_id order by es.sede_id) into v_old_ids
  from public.evento_sedes es where es.evento_id = p_evento_id;
  select array_agg((x->>'sede_id')::uuid order by (x->>'sede_id')::uuid) into v_new_ids
  from jsonb_array_elements(v_n->'sedes') x;

  v_horario_cambia := v_inicio is distinct from v_ev.inicio
                      or v_fin is distinct from v_ev.fin
                      or v_new_ids is distinct from v_old_ids;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') then
    if v_inicio is null then
      raise exception 'Un evento programado necesita fecha y hora.';
    end if;
    if v_horario_cambia and v_motivo is null then
      raise exception 'MOTIVO_REQUERIDO';
    end if;
  end if;

  if v_ev.estatus = 'PROGRAMADO' then
    perform public.events_assert_ready(v_responsable, v_inicio, v_fin, v_horario_cambia);
  elsif v_ev.estatus = 'EN_CURSO' then
    if v_inicio is distinct from v_ev.inicio then
      raise exception 'Un evento en curso no puede cambiar su inicio.';
    end if;
    if v_fin < v_ev.fin then
      raise exception 'Un evento en curso solo puede ampliar su fin. Para acortarlo usa "Terminar ahora".';
    end if;
    if v_responsable is null then
      raise exception 'FALTAN_DATOS' using detail = 'responsable';
    end if;
  end if;

  if v_horario_cambia then
    perform public.events_raise_if_overlap(p_evento_id, v_inicio, v_fin, v_new_ids, p_confirmar_cruce);
  end if;

  update public.eventos e
  set nombre = v_n->>'nombre',
      descripcion = v_n->>'descripcion',
      tipo = v_n->>'tipo',
      tipo_otro = v_n->>'tipo_otro',
      origen = v_n->>'origen',
      proveedor_nombre = v_n->>'proveedor_nombre',
      inicio = v_inicio,
      fin = v_fin,
      responsable_id = v_responsable,
      campana_id = (v_n->>'campana_id')::uuid,
      presupuesto_estimado = (v_n->>'presupuesto_estimado')::numeric,
      moneda = v_n->>'moneda',
      patrocinadores = v_n->>'patrocinadores',
      materiales = v_n->>'materiales',
      requiere_inscripcion = (v_n->>'requiere_inscripcion')::boolean,
      inscripcion_cupo = (v_n->>'inscripcion_cupo')::integer,
      inscripcion_limite = (v_n->>'inscripcion_limite')::timestamptz,
      inscripcion_info = v_n->>'inscripcion_info',
      asistentes_esperados = (v_n->>'asistentes_esperados')::integer,
      version = e.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  delete from public.evento_sedes es where es.evento_id = p_evento_id;
  insert into public.evento_sedes (evento_id, sede_id, zona)
  select p_evento_id, (x->>'sede_id')::uuid, nullif(x->>'zona', '')
  from jsonb_array_elements(v_n->'sedes') x;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') and v_horario_cambia then
    insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    values (
      p_evento_id, 'REPROGRAMACION',
      jsonb_build_object('inicio', v_ev.inicio, 'fin', v_ev.fin, 'sedes', public.events_sede_names(v_old_ids)),
      jsonb_build_object('inicio', v_inicio, 'fin', v_fin, 'sedes', public.events_sede_names(v_new_ids)),
      v_motivo, v_actor
    );
  end if;

  return v_version;
end;
$$;
revoke all on function public.update_event(uuid, integer, jsonb, text, boolean) from public, anon;
grant execute on function public.update_event(uuid, integer, jsonb, text, boolean) to authenticated;

-- Mueve el horario (arrastre en el calendario o "Reprogramar" en la ficha) sin tocar el resto.
create or replace function public.reschedule_event(
  p_evento_id uuid,
  p_expected_version integer,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_motivo text default null,
  p_confirmar_cruce boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_ids uuid[];
  v_motivo text := nullif(trim(p_motivo), '');
  v_version integer;
begin
  perform public.events_require('events.schedule.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is not null or v_ev.estatus in ('TERMINADO', 'CANCELADO') then
    raise exception 'Este evento no se puede reprogramar.';
  end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then
    raise exception 'Indica un inicio y un fin válidos (el fin posterior al inicio).';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.';
  end if;
  if v_ev.requiere_inscripcion and v_ev.inscripcion_limite is not null and v_ev.inscripcion_limite > p_inicio then
    raise exception 'La fecha límite de inscripción no puede ser posterior al inicio.';
  end if;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') and v_motivo is null then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  if v_ev.estatus = 'PROGRAMADO' and p_inicio <= now() then
    raise exception 'Un evento programado debe empezar en el futuro.';
  end if;
  if v_ev.estatus = 'EN_CURSO' then
    if p_inicio is distinct from v_ev.inicio then
      raise exception 'Un evento en curso no puede cambiar su inicio.';
    end if;
    if p_fin < v_ev.fin then
      raise exception 'Un evento en curso solo puede ampliar su fin. Para acortarlo usa "Terminar ahora".';
    end if;
  end if;

  select array_agg(es.sede_id order by es.sede_id) into v_ids
  from public.evento_sedes es where es.evento_id = p_evento_id;

  perform public.events_raise_if_overlap(p_evento_id, p_inicio, p_fin, v_ids, p_confirmar_cruce);

  update public.eventos e
  set inicio = p_inicio, fin = p_fin,
      version = e.version + 1, modificado_en = now(), modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') then
    insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    values (
      p_evento_id, 'REPROGRAMACION',
      jsonb_build_object('inicio', v_ev.inicio, 'fin', v_ev.fin, 'sedes', public.events_sede_names(v_ids)),
      jsonb_build_object('inicio', p_inicio, 'fin', p_fin, 'sedes', public.events_sede_names(v_ids)),
      v_motivo, v_actor
    );
  end if;

  return v_version;
end;
$$;
revoke all on function public.reschedule_event(uuid, integer, timestamptz, timestamptz, text, boolean)
  from public, anon;
grant execute on function public.reschedule_event(uuid, integer, timestamptz, timestamptz, text, boolean)
  to authenticated;

-- Transiciones manuales (plan §4.2). Las automáticas las aplica sync_event_statuses.
--   EN_PLANIFICACION -> PROGRAMADO                       (completo y en el futuro)
--   PROGRAMADO -> EN_PLANIFICACION                       (motivo)
--   EN_PLANIFICACION | PROGRAMADO | EN_CURSO -> CANCELADO (motivo)
--   CANCELADO -> EN_PLANIFICACION                        (motivo)
--   EN_CURSO -> TERMINADO                                ("Terminar ahora"; no cambia fin)
create or replace function public.transition_event_status(
  p_evento_id uuid,
  p_expected_version integer,
  p_estatus text,
  p_motivo text default null,
  p_confirmar_cruce boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_motivo text := nullif(trim(p_motivo), '');
  v_ids uuid[];
  v_version integer;
begin
  perform public.events_require('events.schedule.status.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento está archivado. Restáuralo antes de cambiar su estado.';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.';
  end if;

  if not (
       (v_ev.estatus = 'EN_PLANIFICACION' and p_estatus in ('PROGRAMADO', 'CANCELADO'))
    or (v_ev.estatus = 'PROGRAMADO' and p_estatus in ('EN_PLANIFICACION', 'CANCELADO'))
    or (v_ev.estatus = 'EN_CURSO' and p_estatus in ('TERMINADO', 'CANCELADO'))
    or (v_ev.estatus = 'CANCELADO' and p_estatus = 'EN_PLANIFICACION')
  ) then
    raise exception 'No se puede pasar de % a %.', v_ev.estatus, coalesce(p_estatus, 'nulo');
  end if;

  if p_estatus in ('CANCELADO', 'EN_PLANIFICACION') and v_motivo is null then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  if p_estatus = 'PROGRAMADO' then
    select array_agg(es.sede_id order by es.sede_id) into v_ids
    from public.evento_sedes es where es.evento_id = p_evento_id;

    if coalesce(cardinality(v_ids), 0) = 0 then
      raise exception 'FALTAN_DATOS' using detail = 'sedes';
    end if;
    perform public.events_assert_ready(v_ev.responsable_id, v_ev.inicio, v_ev.fin, true);
    perform public.events_raise_if_overlap(p_evento_id, v_ev.inicio, v_ev.fin, v_ids, p_confirmar_cruce);
  end if;

  update public.eventos e
  set estatus = p_estatus,
      version = e.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
  values (
    p_evento_id, 'ESTATUS',
    jsonb_build_object('estatus', v_ev.estatus), jsonb_build_object('estatus', p_estatus),
    v_motivo, v_actor
  );

  return v_version;
end;
$$;
revoke all on function public.transition_event_status(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.transition_event_status(uuid, integer, text, text, boolean) to authenticated;

-- Cierre: lo único editable en un evento Terminado.
create or replace function public.save_event_closure(
  p_evento_id uuid,
  p_expected_version integer,
  p_asistentes_reales integer,
  p_gasto_real numeric,
  p_notas_cierre text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_notas text := nullif(trim(p_notas_cierre), '');
  v_version integer;
begin
  perform public.events_require('events.schedule.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.estatus <> 'TERMINADO' then
    raise exception 'El cierre se registra cuando el evento está terminado.';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento está archivado. Restáuralo para editar su cierre.';
  end if;
  if p_asistentes_reales is not null and p_asistentes_reales < 0 then
    raise exception 'Los asistentes reales no pueden ser negativos.';
  end if;
  if p_gasto_real is not null and (p_gasto_real < 0 or p_gasto_real >= 1000000000000) then
    raise exception 'El gasto real debe ser un monto positivo.';
  end if;
  if v_notas is not null and length(v_notas) > 2000 then
    raise exception 'Las notas de cierre no pueden superar 2000 caracteres.';
  end if;

  update public.eventos e
  set asistentes_reales = p_asistentes_reales,
      gasto_real = round(p_gasto_real, 2),
      notas_cierre = v_notas,
      version = e.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  return v_version;
end;
$$;
revoke all on function public.save_event_closure(uuid, integer, integer, numeric, text) from public, anon;
grant execute on function public.save_event_closure(uuid, integer, integer, numeric, text) to authenticated;

-- Archivo: solo eventos Terminados o Cancelados. No se borra nada.
create or replace function public.archive_event(p_evento_id uuid, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_version integer;
begin
  perform public.events_require('events.schedule.archive');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.estatus not in ('TERMINADO', 'CANCELADO') then
    raise exception 'Solo se pueden archivar eventos terminados o cancelados.';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento ya está archivado.';
  end if;

  update public.eventos e
  set archivado_en = now(), archivado_por = v_actor,
      version = e.version + 1, modificado_en = now(), modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  return v_version;
end;
$$;
revoke all on function public.archive_event(uuid, integer) from public, anon;
grant execute on function public.archive_event(uuid, integer) to authenticated;

create or replace function public.restore_event(p_evento_id uuid, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_version integer;
begin
  perform public.events_require('events.schedule.archive');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is null then
    raise exception 'El evento no está archivado.';
  end if;

  update public.eventos e
  set archivado_en = null, archivado_por = null,
      version = e.version + 1, modificado_en = now(), modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  return v_version;
end;
$$;
revoke all on function public.restore_event(uuid, integer) from public, anon;
grant execute on function public.restore_event(uuid, integer) to authenticated;

commit;
