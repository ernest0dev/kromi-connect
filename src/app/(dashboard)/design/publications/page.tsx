import { requirePermission } from '@/lib/auth/dal';
import { getCaracasToday } from '@/lib/designSla';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { QueueView } from './QueueView';
import { DesignWorkspaceNav } from './DesignWorkspaceNav';

export const revalidate = 0;

export default async function DesignPublicationsPage() {
  const { supabase, user } = await requirePermission('design.posts.read');
  const { data } = await supabase.rpc('get_design_publication_queue');
  const ids = (data || []).map((publication) => publication.id);
  const { data: names } = ids.length ? await supabase.rpc('get_publication_designer_names', { p_ids: ids }) : { data: [] };
  const { data: channelRows } = ids.length ? await getSupabaseAdmin().from('publicacion_canales').select('publicacion_id,canal').in('publicacion_id', ids) : { data: [] };
  const nameMap = Object.fromEntries((names || []).map((item) => [item.publicacion_id, item.full_name || 'Diseño']));
  const channels = Object.fromEntries(ids.map((id) => [id, (channelRows || []).filter((item) => item.publicacion_id === id).map((item) => item.canal)]));
  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8">
    <DesignWorkspaceNav active="queue" />
    <header><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0066D2]">Diseño</p><h1 className="mt-1 text-[28px] font-bold leading-tight text-[#10233F]">Solicitudes de publicación</h1><p className="mt-1 max-w-2xl text-sm text-[#5E6680]">Todas las solicitudes activas de Diseño, sin importar quién las trabaje. Toma una para empezar.</p></header>
    <QueueView publications={data || []} userId={user.id} designerNames={nameMap} channels={channels} today={getCaracasToday()} />
  </main>;
}
