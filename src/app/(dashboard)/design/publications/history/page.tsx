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
  const ids = publications.map((row) => row.id);
  const { data: channelRows } = ids.length ? await supabase.rpc('get_design_publication_channels', { p_ids: ids }) : { data: [] };
  const requests = [
    ...publications.map((row) => adaptPublication(row as unknown as Parameters<typeof adaptPublication>[0], (channelRows ?? []).filter((item) => item.publicacion_id === row.id).map((item) => item.canal))),
    ...(internalResult.data ?? []).map((row) => adaptInternal(row as unknown as Parameters<typeof adaptInternal>[0])),
    ...(eventResult.data ?? []).map((row) => adaptEvent(row)),
  ].map((request) => ({ ...request, design_status: request.design_status === 'CANCELLED' ? 'CANCELLED' as const : 'DELIVERED' as const }))
    .sort((a, b) => (b.delivered_at ?? b.requested_at ?? '').localeCompare(a.delivered_at ?? a.requested_at ?? ''));
  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8"><UnifiedHistoryView requests={requests} page={page}/></main>;
}
