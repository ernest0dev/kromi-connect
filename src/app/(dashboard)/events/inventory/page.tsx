import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/dal';
import { INVENTARIO_RUTA, buildInventoryQueryString, parseInventoryQuery, sedeSlug } from '@/lib/inventory';
import type { InventarioArticuloRow, InventarioPermisos } from '@/types';
import { InventoryView } from './InventoryView';

export const metadata = { title: 'Inventario de Eventos' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requirePermission('events.inventory.read');
  const query = parseInventoryQuery(await searchParams);

  const [sedesRes, categoriasRes, ubicacionesRes, countsRes, ...perms] = await Promise.all([
    supabase.from('inventario_sedes').select('id, codigo, nombre, orden').eq('activa', true).order('orden'),
    supabase.from('inventario_categorias').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.from('inventario_ubicaciones').select('id, sede_id, nombre').eq('activa', true).order('nombre'),
    supabase.rpc('get_inventory_sede_counts'),
    supabase.rpc('has_permission', { required_permission: 'events.inventory.create' }),
    supabase.rpc('has_permission', { required_permission: 'events.inventory.update' }),
    supabase.rpc('has_permission', { required_permission: 'events.inventory.move' }),
    supabase.rpc('has_permission', { required_permission: 'events.inventory.locations.create' }),
  ]);

  const sedes = sedesRes.data ?? [];
  const sedeActual = sedes.find((s) => sedeSlug(s.codigo) === query.sede) ?? sedes[0];

  if (!sedeActual) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center text-sm text-[#566274]" role="alert">
        No hay sedes de inventario configuradas. Aplica la migración del inventario de Eventos.
      </div>
    );
  }

  const ubicaciones = ubicacionesRes.data ?? [];
  // Un filtro de ubicación de otra sede no aplica a esta pestaña.
  const ubicacion = ubicaciones.some((u) => u.id === query.ubicacion && u.sede_id === sedeActual.id) ? query.ubicacion : '';
  const effective = { ...query, sede: sedeSlug(sedeActual.codigo), ubicacion };

  const itemsRes = await supabase.rpc('list_inventory_items', {
    p_sede_id: sedeActual.id,
    p_search: effective.q || null,
    p_categoria_id: effective.categoria || null,
    p_ubicacion_id: effective.ubicacion || null,
    p_condicion: effective.condicion || null,
    p_tipo_control: effective.control || null,
    p_sort: effective.sort,
    p_dir: effective.dir,
    p_limit: effective.pageSize,
    p_offset: (effective.page - 1) * effective.pageSize,
  });

  const items: InventarioArticuloRow[] = itemsRes.data ?? [];
  const total = items[0]?.total_count ?? 0;

  if (!itemsRes.error && items.length === 0 && effective.page > 1) {
    redirect(`${INVENTARIO_RUTA}?${buildInventoryQueryString(effective, { page: 1 })}`);
  }

  const permissions: InventarioPermisos = {
    create: perms[0].data === true,
    update: perms[1].data === true,
    move: perms[2].data === true,
    createLocation: perms[3].data === true,
  };

  const counts: Record<string, number> = {};
  for (const row of countsRes.data ?? []) counts[row.sede_id] = Number(row.total);

  const loadError =
    itemsRes.error || sedesRes.error || categoriasRes.error || ubicacionesRes.error
      ? 'No se pudo cargar el inventario. Inténtalo de nuevo.'
      : null;

  return (
    <InventoryView
      query={effective}
      sedes={sedes}
      sedeActual={sedeActual}
      counts={counts}
      categorias={categoriasRes.data ?? []}
      ubicaciones={ubicaciones}
      items={items}
      total={total}
      permissions={permissions}
      loadError={loadError}
    />
  );
}
