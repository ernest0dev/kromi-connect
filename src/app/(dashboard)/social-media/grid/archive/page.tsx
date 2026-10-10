import Link from 'next/link';
import { Archive } from 'lucide-react';
import { requirePermission } from '@/lib/auth/dal';
import { ArchiveList } from './ArchiveList';

export const revalidate = 0;

export default async function PublicationArchivePage() {
  const { supabase } = await requirePermission('social-media.posts.read');
  const [{ data: publications, error }, { data: accounts }] = await Promise.all([
    supabase.from('publicaciones').select('id, titulo, formato, fecha_publicacion, deleted_at, drive_cleanup_status, drive_cleanup_error, drive_folder_url').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('social_accounts').select('id, platform, display_name'),
  ]);
  const { data: destinations } = await supabase.from('publicacion_canales').select('publicacion_id, social_account_id');
  const accountsById = new Map((accounts || []).map((account) => [account.id, `${account.platform} · ${account.display_name}`]));
  const labelsByPublication = new Map<string, string[]>();
  for (const row of destinations || []) {
    const label = row.social_account_id ? accountsById.get(row.social_account_id) : null;
    if (label) labelsByPublication.set(row.publicacion_id, [...(labelsByPublication.get(row.publicacion_id) || []), label]);
  }
  return <main className="mx-auto max-w-5xl space-y-5 p-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700"><Archive size={14} /> Social Media</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Archivo de publicaciones</h1><p className="mt-1 text-sm text-slate-600">Las publicaciones se pueden restaurar durante un mes. Después, el sistema intenta eliminar su carpeta de Drive y los registros.</p></div>
      <Link href="/social-media/grid" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Volver al Grid</Link>
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo cargar el Archivo: {error.message}</p>}
    <ArchiveList publications={(publications || []).map((item) => ({ ...item, accountLabels: labelsByPublication.get(item.id) || [] }))} />
  </main>;
}
