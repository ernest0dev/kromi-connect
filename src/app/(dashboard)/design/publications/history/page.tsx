import { requirePermission } from '@/lib/auth/dal';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import type { Publicacion } from '@/types';
import { HistoryView } from './HistoryView';

export const revalidate = 0;

export default async function DesignHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: requestedPage } = await searchParams;
  const page = Math.max(1, Number.parseInt(requestedPage || '1', 10) || 1);
  const { supabase } = await requirePermission('design.posts.read');
  const { data, error } = await supabase.rpc('get_design_publication_history', { p_limit: 100, p_offset: (page - 1) * 100 });
  if (error) throw new Error(error.message);

  const publications = (data || []) as Publicacion[];
  const ids = publications.map((item) => item.id);
  const [nameResult, commentResult, channelResult] = ids.length ? await Promise.all([
    supabase.rpc('get_publication_designer_names', { p_ids: ids }),
    supabase.rpc('get_design_publication_comments', { p_ids: ids }),
    getSupabaseAdmin().from('publicacion_canales').select('publicacion_id,canal').in('publicacion_id', ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const designers = Object.fromEntries((nameResult.data || []).map((item) => [item.publicacion_id, item.full_name || '—']));
  const channels = Object.fromEntries(ids.map((id) => [id, (channelResult.data || []).filter((item) => item.publicacion_id === id).map((item) => item.canal)]));
  const cancellationReasons: Record<string, string> = {};
  for (const comment of commentResult.data || []) if (comment.tipo === 'MOTIVO_CANCELACION') cancellationReasons[comment.publicacion_id] = comment.texto;

  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8">
    <HistoryView publications={publications} designers={designers} channels={channels} cancellationReasons={cancellationReasons} page={page}/>
  </main>;
}
