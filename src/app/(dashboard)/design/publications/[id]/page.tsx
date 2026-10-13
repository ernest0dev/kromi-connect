import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/dal';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getCaracasToday } from '@/lib/designSla';
import { DesignPublicationDetail } from './detail';

export const revalidate = 0;

export default async function DesignPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requirePermission('design.posts.read');
  const { data: queue, error } = await supabase.rpc('get_design_publication_queue');
  if (error) throw new Error(error.message);
  const publication = queue?.find((item) => item.id === id);
  if (!publication) notFound();
  const [{ data: comments }, { data: names }, { data: cycle }, { data: history }, { data: channels }] = await Promise.all([
    supabase.rpc('get_design_publication_comments', { p_ids: [id] }),
    supabase.rpc('get_publication_designer_names', { p_ids: [id] }),
    getSupabaseAdmin().from('publicacion_estatus_historial').select('cambiado_en').eq('publicacion_id', id).eq('estatus_nuevo', 'EN_DISENO').order('cambiado_en', { ascending: false }).limit(1).maybeSingle(),
    getSupabaseAdmin().from('publicacion_estatus_historial').select('estatus_anterior, estatus_nuevo, motivo, cambiado_en').eq('publicacion_id', id).order('cambiado_en', { ascending: false }).limit(12),
    getSupabaseAdmin().from('publicacion_canales').select('canal').eq('publicacion_id', id),
  ]);
  return <DesignPublicationDetail publication={publication} comments={comments || []} designerName={names?.[0]?.full_name || null} channels={(channels || []).map((item) => item.canal)} actorId={user.id} cycleStart={cycle?.cambiado_en || null} history={[...(history || [])].reverse()} today={getCaracasToday()} />;
}
