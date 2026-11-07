-- Corrige la identidad de lotes al recibir traslados y evita duplicados
-- cuando dos traslados concurrentes crean el mismo lote en un destino vacío.
-- Se conserva 202610130001 como migración histórica ya versionada.

begin;

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
  v_identity_key text;
begin
  -- Serializa destinos con la misma identidad. Una colisión del hash solo
  -- serializa operaciones distintas; la consulta siguiente valida los campos.
  v_identity_key := pg_catalog.jsonb_build_array(
    p_ubicacion_id,
    p_source.categoria_id,
    lower(trim(p_source.nombre)),
    coalesce(trim(p_source.especificaciones), ''),
    p_source.unidad_medida,
    p_source.condicion,
    p_source.atributos
  )::text;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_identity_key, 0)
  );

  select t.* into v_target
  from public.inventario_articulos t
  where t.tipo_control = 'LOTE'
    and t.ubicacion_id = p_ubicacion_id
    and t.categoria_id = p_source.categoria_id
    and lower(trim(t.nombre)) = lower(trim(p_source.nombre))
    and coalesce(trim(t.especificaciones), '') = coalesce(trim(p_source.especificaciones), '')
    and t.unidad_medida = p_source.unidad_medida
    and t.condicion = p_source.condicion
    and t.atributos = p_source.atributos
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

revoke all on function public.inventory_add_to_stock_row(
  public.inventario_articulos, uuid, uuid, numeric, uuid
) from public, anon, authenticated;

commit;
