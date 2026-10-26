import { requirePermission } from '@/lib/auth/dal';
import { adaptEvent, adaptInternal, adaptPublication } from '@/lib/designRequests';
import { adaptLegacyDesignHistory, sortUnifiedHistoryEntries } from '@/lib/designHistory';
import { UnifiedHistoryView } from './UnifiedHistoryView';

export const revalidate = 0;

export default async function DesignHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: requestedPage } = await searchParams;
  const page = Math.max(1, Number.parseInt(requestedPage || '1', 10) || 1);
  const { supabase } = await requirePermission('design.requests.read');
  const offset = (page - 1) * 100;
  const [publicationResult, internalResult, eventResult, legacyResult] = await Promise.all([
    supabase.rpc('get_design_publication_history', { p_limit: 100, p_offset: offset }),
    supabase.rpc('get_design_internal_history', { p_limit: 100, p_offset: offset }),
    supabase.rpc('get_design_event_history', { p_limit: 100, p_offset: offset }),
    supabase
      .from('design_solicitudes_historicas')
      .select('id,title,source_timestamp,due_date,objective,publication_request,designer_name_raw,requester_name_raw,priority_raw,status_raw,completed_at,department_raw,reference_url,print_request,area_raw,design_quantity_raw,medium_raw,pieces_quantity_raw,publication_details_2,print_details_2,material,dimensions')
      .order('source_timestamp', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + 99),
  ]);
  if (publicationResult.error || internalResult.error || eventResult.error || legacyResult.error) {
    throw new Error('No se pudo cargar el historial unificado de Diseño.');
  }
  const publications = publicationResult.data ?? [];
  const internal = internalResult.data ?? [];
  const legacy = legacyResult.data ?? [];
  const publicationIds = publications.map((row) => row.id);
  const internalIds = internal.map((row) => String((row as Record<string, unknown>).id ?? ''));
  const [channelResult, publicationNamesResult, internalNamesResult] = await Promise.all([
    publicationIds.length ? supabase.rpc('get_design_publication_channels', { p_ids: publicationIds }) : Promise.resolve({ data: [], error: null }),
    publicationIds.length ? supabase.rpc('get_publication_designer_names', { p_ids: publicationIds }) : Promise.resolve({ data: [], error: null }),
    internalIds.some(Boolean) ? supabase.rpc('get_pendiente_designer_names', { p_ids: internalIds.filter(Boolean) }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (channelResult.error || publicationNamesResult.error || internalNamesResult.error) {
    throw new Error('No se pudieron cargar los datos complementarios del historial de Diseño.');
  }
  const publicationNames = Object.fromEntries((publicationNamesResult.data ?? []).map((row) => [row.publicacion_id, row.full_name]));
  const internalNames = Object.fromEntries((internalNamesResult.data ?? []).map((row) => [row.user_id, row.full_name]));
  const entries = sortUnifiedHistoryEntries([
    ...publications.map((row) => {
      const channels = (channelResult.data ?? []).filter((item) => item.publicacion_id === row.id).map((item) => item.canal);
      const request = { ...adaptPublication(row, channels), designer_name: publicationNames[row.id] ?? null };
      return { source: 'OPERATIONAL' as const, request };
    }),
    ...internal.map((row) => {
      const record = row as unknown as Parameters<typeof adaptInternal>[0];
      const request = adaptInternal(record);
      const namedRequest = { ...request, designer_name: request.designer_id ? internalNames[request.designer_id] ?? null : null };
      return { source: 'OPERATIONAL' as const, request: namedRequest };
    }),
    ...(eventResult.data ?? []).map((row) => ({
      source: 'OPERATIONAL' as const,
      request: adaptEvent(row),
    })),
    ...legacy.map(adaptLegacyDesignHistory),
  ].map((entry) => entry.source === 'LEGACY'
    ? entry
    : {
      ...entry,
      request: {
        ...entry.request,
        design_status: entry.request.design_status === 'CANCELLED' ? 'CANCELLED' as const : 'DELIVERED' as const,
        source_status: entry.request.source === 'SOCIAL_MEDIA' ? entry.request.source_status : null,
      },
    }));
  const hasNextPage = [publications, internal, eventResult.data ?? [], legacy].some((rows) => rows.length === 100);
  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8"><UnifiedHistoryView entries={entries} page={page} hasNextPage={hasNextPage}/></main>;
}
