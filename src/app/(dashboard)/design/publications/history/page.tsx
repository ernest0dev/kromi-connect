import { requirePermission } from '@/lib/auth/dal';
import { adaptEvent, adaptInternal, adaptPublication } from '@/lib/designRequests';
import { UnifiedHistoryView } from './UnifiedHistoryView';

export const revalidate = 0;

export default async function DesignHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: requestedPage } = await searchParams;
  const page = Math.max(1, Number.parseInt(requestedPage || '1', 10) || 1);
  const { supabase } = await requirePermission('design.requests.read');
  const [publicationResult, internalResult, eventResult] = await Promise.all([
    supabase.rpc('get_design_publication_history', { p_limit: 100, p_offset: (page - 1) * 100 }),
    supabase.rpc('get_design_internal_history', { p_limit: 100, p_offset: (page - 1) * 100 }),
    supabase.rpc('get_design_event_history', { p_limit: 100, p_offset: (page - 1) * 100 }),
  ]);
  if (publicationResult.error || internalResult.error || eventResult.error) throw new Error('No se pudo cargar el historial unificado de Diseño.');
  const publications = publicationResult.data ?? [];
  const internal = internalResult.data ?? [];
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
  const requests = [
    ...publications.map((row) => {
      const channels = (channelResult.data ?? []).filter((item) => item.publicacion_id === row.id).map((item) => item.canal);
      return { ...adaptPublication(row, channels), designer_name: publicationNames[row.id] ?? null };
    }),
    ...internal.map((row) => {
      const record = row as unknown as Parameters<typeof adaptInternal>[0];
      const request = adaptInternal(record);
      return { ...request, designer_name: request.designer_id ? internalNames[request.designer_id] ?? null : null };
    }),
    ...(eventResult.data ?? []).map((row) => adaptEvent(row)),
  ].map((request) => ({
    ...request,
    design_status: request.design_status === 'CANCELLED' ? 'CANCELLED' as const : 'DELIVERED' as const,
    source_status: request.source === 'SOCIAL_MEDIA' ? request.source_status : null,
  }))
    .sort((a, b) => (b.delivered_at ?? b.requested_at ?? '').localeCompare(a.delivered_at ?? a.requested_at ?? ''));
  const hasNextPage = [publications, internal, eventResult.data ?? []].some((rows) => rows.length === 100);
  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8"><UnifiedHistoryView requests={requests} page={page} hasNextPage={hasNextPage}/></main>;
}
