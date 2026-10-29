import { requirePermission } from '@/lib/auth/dal';
import { getCaracasToday } from '@/lib/designSla';
import { adaptEvent, adaptGeneralRequest, adaptInternal, adaptPublication, sortDesignRequests } from '@/lib/designRequests';
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
  if (publicationResult.error || internalResult.error || eventResult.error) {
    throw new Error('No se pudo cargar la cola unificada de Diseño.');
  }
  const publications = publicationResult.data ?? [];
  const internal = internalResult.data ?? [];
  const publicationIds = publications.map((row) => row.id);
  const internalIds = internal.map((row) => row.id);
  const [channelResult, publicationNamesResult, internalNamesResult] = await Promise.all([
    publicationIds.length ? supabase.rpc('get_design_publication_channels', { p_ids: publicationIds }) : Promise.resolve({ data: [], error: null }),
    publicationIds.length ? supabase.rpc('get_publication_designer_names', { p_ids: publicationIds }) : Promise.resolve({ data: [], error: null }),
    internalIds.length ? supabase.rpc('get_pendiente_designer_names', { p_ids: internalIds }) : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: generalRequests, error: generalError } = await (supabase as any).from('general_design_requests')
    .select('id,title,design_type,design_type_other,required_date,status,department,created_at,updated_at,requester_id,requester_role,designer_id,started_at,delivered_at,priority,categories,scopes,instructions')
    .in('status', ['SOLICITADA', 'EN_DISENO', 'EN_CORRECCION']).order('required_date', { ascending: true });
  if (generalError) throw new Error('No se pudieron cargar las solicitudes generales de Diseño.');
  if (channelResult.error || publicationNamesResult.error || internalNamesResult.error) {
    throw new Error('No se pudieron cargar los datos complementarios de la cola de Diseño.');
  }
  const channels = Object.fromEntries(publicationIds.map((id) => [id, (channelResult.data ?? []).filter((item) => item.publicacion_id === id).map((item) => item.canal)]));
  const publicationNames = Object.fromEntries((publicationNamesResult.data ?? []).map((row) => [row.publicacion_id, row.full_name]));
  const internalNames = Object.fromEntries((internalNamesResult.data ?? []).map((row) => [row.user_id, row.full_name]));
  const requests = sortDesignRequests([
    ...publications.map((row) => ({ ...adaptPublication(row, channels[row.id] ?? []), designer_name: publicationNames[row.id] ?? null })),
    ...internal.map((row) => ({ ...adaptInternal(row), designer_name: internalNames[row.disenador_id ?? ''] ?? null })),
    ...(eventResult.data ?? []).map((row) => adaptEvent(row)),
    ...(generalRequests ?? []).map((row: Record<string, unknown>) => adaptGeneralRequest(row)),
  ]);
  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8">
    <DesignWorkspaceNav active="queue" />
    <header><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0066D2]">Diseño</p><h1 className="mt-1 text-[28px] font-bold leading-tight text-[#10233F]">Solicitudes</h1><p className="mt-1 max-w-2xl text-sm text-[#5E6680]">Una cola para Social Media, Interno, Eventos y solicitudes generales.</p></header>
    <UnifiedQueueView requests={requests} userId={user.id} today={getCaracasToday()} />
  </main>;
}
