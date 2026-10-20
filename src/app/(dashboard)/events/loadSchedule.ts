import { requirePermission } from '@/lib/auth/dal';
import { getCalendarRange, parseEventQuery } from '@/lib/events';
import type { EventoPermisos, EventoRow } from '@/types';

export type ScheduleMode = 'month' | 'week' | 'list' | 'archive';
export type EventSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function loadSchedule(searchParams: EventSearchParams, mode: ScheduleMode) {
  const { supabase, user } = await requirePermission('events.schedule.read');
  const raw = await searchParams;
  const filters = parseEventQuery(raw);
  const [sedesResult, peopleResult, campaignsResult, ...permissionResults] = await Promise.all([
    supabase.from('inventario_sedes').select('id, codigo, nombre, orden').eq('activa', true).order('orden'),
    supabase.rpc('list_event_responsables'),
    supabase.rpc('list_event_campaigns'),
    supabase.rpc('has_permission', { required_permission: 'events.schedule.create' }),
    supabase.rpc('has_permission', { required_permission: 'events.schedule.update' }),
    supabase.rpc('has_permission', { required_permission: 'events.schedule.status.update' }),
    supabase.rpc('has_permission', { required_permission: 'events.schedule.archive' }),
    supabase.rpc('has_permission', { required_permission: 'events.schedule.design' }),
  ]);
  const sedes = sedesResult.data ?? [];
  const sede = sedes.find((s) => s.id === filters.sede || s.codigo.toLowerCase() === filters.sede.toLowerCase());
  const normalizedFilters = { ...filters, sede: sede?.id ?? '' };
  const archivados = mode === 'archive';
  const isCalendar = mode === 'month' || mode === 'week';
  const range = isCalendar ? getCalendarRange(filters.fecha, mode === 'week') : null;
  const pDesde = range ? range.from.toISOString() : null;
  const pHasta = range ? range.to.toISOString() : null;
  const { data, error } = await supabase.rpc('list_events', {
    p_desde: pDesde, p_hasta: pHasta, p_sede_id: sede?.id ?? null,
    p_estatus: filters.estatus || null, p_tipo: filters.tipo || null, p_origen: filters.origen || null,
    p_responsable_id: null, p_search: filters.q || null, p_archivados: archivados,
    p_dir: 'asc', p_limit: isCalendar ? 500 : 100, p_offset: isCalendar ? 0 : (filters.page - 1) * 100,
  });
  let errorMessage: string | null = error ? `No se pudo cargar la programación: ${error.message}` : null;
  if (sedesResult.error) errorMessage ??= 'No se pudieron cargar las tiendas. Verifica que la migración del inventario esté aplicada.';
  if (peopleResult.error) errorMessage ??= 'No se pudieron cargar las personas responsables.';
  if (campaignsResult.error) errorMessage ??= 'No se pudieron cargar las campañas.';
  const permissions: EventoPermisos = {
    create: permissionResults[0].data === true, update: permissionResults[1].data === true,
    status: permissionResults[2].data === true, archive: permissionResults[3].data === true, design: permissionResults[4].data === true,
  };
  return {
    initialRows: (data ?? []) as unknown as EventoRow[], initialError: errorMessage, total: data?.[0]?.total_count ?? 0,
    sedes, responsables: peopleResult.data ?? [], campaigns: campaignsResult.data ?? [], permissions, currentUserId: user.id,
    month: filters.fecha, filters: normalizedFilters,
  };
}
