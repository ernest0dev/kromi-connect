import { requirePermission } from '@/lib/auth/dal';
import { getCaracasToday } from '@/lib/designSla';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { adaptEvent, adaptInternal, adaptPublication, sortDesignRequests } from '@/lib/designRequests';
import { UnifiedQueueView } from './UnifiedQueueView';
import { DesignWorkspaceNav } from './DesignWorkspaceNav';

export const revalidate = 0;

export default async function DesignPublicationsPage() {
  const { supabase, user } = await requirePermission('design.requests.read');
  const [publicationResult, internalResult, eventResult] = await Promise.all([
    supabase.rpc('get_design_publication_queue'),
    supabase.rpc('get_design_internal_queue'),
    supabase.rpc('get_design_event_queue'),
  ]);
  const publications = publicationResult.data ?? [];
  const ids = publications.map((publication) => publication.id);
  const { data: channelRows } = ids.length
    ? await getSupabaseAdmin().from('publicacion_canales').select('publicacion_id,canal').in('publicacion_id', ids)
    : { data: [] };
  const channels = Object.fromEntries(ids.map((id) => [id, (channelRows ?? []).filter((item) => item.publicacion_id === id).map((item) => item.canal)]));
  const requests = sortDesignRequests([
    ...publications.map((row) => adaptPublication(row, channels[row.id] ?? [])),
    ...(internalResult.data ?? []).map((row) => adaptInternal(row)),
    ...(eventResult.data ?? []).map((row) => adaptEvent(row)),
  ]);
  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8">
    <DesignWorkspaceNav active="queue" />
    <header><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0066D2]">Diseño</p><h1 className="mt-1 text-[28px] font-bold leading-tight text-[#10233F]">Solicitudes</h1><p className="mt-1 max-w-2xl text-sm text-[#5E6680]">Una cola para Social Media, Interno y Eventos, con filtros por origen.</p></header>
    <UnifiedQueueView requests={requests} userId={user.id} today={getCaracasToday()} />
  </main>;
}
