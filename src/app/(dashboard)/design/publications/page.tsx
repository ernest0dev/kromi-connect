import { requirePermission } from '@/lib/auth/dal';
import { DesignPublicationsQueue } from './queue';

export const revalidate = 0;

export default async function DesignPublicationsPage() {
  const { supabase } = await requirePermission('design.posts.read');
  const { data } = await supabase.rpc('get_design_publication_queue');
  const ids = (data || []).map((publication) => publication.id);
  const { data: comments } = ids.length
    ? await supabase.from('publicacion_comentarios').select('id, publicacion_id, texto, tipo, creado_en').in('publicacion_id', ids).order('creado_en', { ascending: true })
    : { data: [] };
  const commentsByPublication = new Map<string, NonNullable<typeof comments>>();
  for (const comment of comments || []) commentsByPublication.set(comment.publicacion_id, [...(commentsByPublication.get(comment.publicacion_id) || []), comment]);
  return <main className="mx-auto max-w-5xl space-y-5 p-5">
    <header><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Diseño</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Solicitudes de publicación</h1><p className="mt-1 text-sm text-slate-600">Al abrir una solicitud empieza el trabajo. Al terminar, entrégala a Social Media para revisión.</p></header>
    <DesignPublicationsQueue publications={(data || []).map((publication) => ({ ...publication, comments: commentsByPublication.get(publication.id) || [] }))} />
  </main>;
}
