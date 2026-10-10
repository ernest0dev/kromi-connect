'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { deletePublicacionDriveFolder, getDriveFileIdFromUrl } from '@/lib/googleDrive';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const revalidate = () => {
  revalidatePath('/social-media/grid');
  revalidatePath('/social-media/grid/archive');
  revalidatePath('/social-media/kanban');
};

async function accountScope(supabase: SupabaseClient<Database>, publicationId: string) {
  const { data, error } = await supabase.rpc('user_has_all_publication_accounts', { p_publicacion_id: publicationId });
  return !error && data === true;
}

export async function archivePublicationAction(publicationId: string) {
  const access = await authorizeAction('social-media.posts.archive');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.' };
  if (!UUID_PATTERN.test(publicationId)) return { success: false as const, error: 'La publicación no es válida.' };
  const supabase = access.context.supabase;
  const { data, error } = await supabase.rpc('archive_publication', { p_publicacion_id: publicationId });
  if (error || data !== true) return { success: false as const, error: error?.message || 'La publicación ya está archivada o no se encontró.' };
  revalidate();
  return { success: true as const };
}

export async function restorePublicationAction(publicationId: string) {
  const access = await authorizeAction('social-media.posts.restore');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.' };
  if (!UUID_PATTERN.test(publicationId)) return { success: false as const, error: 'La publicación no es válida.' };
  const supabase = access.context.supabase;
  const { data, error } = await supabase.rpc('restore_archived_publication', { p_publicacion_id: publicationId });
  if (error || data !== true) return { success: false as const, error: error?.message || 'Ya venció el plazo de restauración.' };
  revalidate();
  return { success: true as const };
}

export async function resolveExpiredDrivePurgeAction(publicationId: string, mode: 'retry-drive' | 'keep-drive') {
  const access = await authorizeAction('social-media.posts.purge.resolve');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.' };
  if (access.context.profile?.role_code !== 'social-media') return { success: false as const, error: 'Solo el rol Social Media puede resolver la purga.' };
  if (!UUID_PATTERN.test(publicationId) || !['retry-drive', 'keep-drive'].includes(mode)) return { success: false as const, error: 'La operación no es válida.' };
  const supabase = access.context.supabase;
  if (!(await accountScope(supabase, publicationId))) return { success: false as const, error: 'Necesitas acceso a todas las cuentas destino.' };
  const { data: publication, error: readError } = await supabase.from('publicaciones')
    .select('id, deleted_at, drive_folder_id, drive_folder_url, drive_cleanup_status')
    .eq('id', publicationId).maybeSingle();
  if (readError || !publication) return { success: false as const, error: readError?.message || 'La publicación no existe.' };
  if (!publication.deleted_at || !['ERROR', 'ELIMINADO'].includes(publication.drive_cleanup_status)) {
    return { success: false as const, error: 'La purga todavía no venció o ya está resuelta.' };
  }
  if (mode === 'keep-drive' && publication.drive_cleanup_status === 'ELIMINADO') {
    return { success: false as const, error: 'Drive ya fue eliminado. Finaliza la purga de registros.' };
  }

  if (mode === 'retry-drive' && publication.drive_cleanup_status !== 'ELIMINADO') {
    const admin = getSupabaseAdmin();
    const folderId = publication.drive_folder_id || getDriveFileIdFromUrl(publication.drive_folder_url);
    if (folderId) {
      const result = await deletePublicacionDriveFolder(folderId);
      if (!result.success) {
        await admin.from('publicaciones').update({
          drive_cleanup_status: 'ERROR', drive_cleanup_error: result.error || 'No se pudo eliminar Drive.', drive_cleanup_attempted_at: new Date().toISOString(),
        }).eq('id', publicationId);
        revalidate();
        return { success: false as const, error: result.error || 'No se pudo eliminar Drive.' };
      }
    } else if (publication.drive_folder_url) {
      const message = 'No se pudo obtener el ID de la carpeta de Drive. Elige conservarla para eliminar los registros.';
      await admin.from('publicaciones').update({ drive_cleanup_status: 'ERROR', drive_cleanup_error: message }).eq('id', publicationId);
      revalidate();
      return { success: false as const, error: message };
    }
  }

  const admin = getSupabaseAdmin();
  if (mode === 'keep-drive') {
    const { error } = await admin.from('publicaciones').update({ drive_cleanup_status: 'CONSERVADO', drive_preserved_at: new Date().toISOString() }).eq('id', publicationId);
    if (error) return { success: false as const, error: error.message };
  } else {
    const { error: markError } = await admin.from('publicaciones').update({ drive_cleanup_status: 'ELIMINADO', drive_deleted_at: new Date().toISOString(), drive_cleanup_error: null }).eq('id', publicationId);
    if (markError) return { success: false as const, error: markError.message };
  }
  const { error: deleteError } = await admin.from('publicaciones').delete().eq('id', publicationId);
  if (deleteError) return { success: false as const, error: `Drive quedó resuelto, pero no se pudieron purgar los registros: ${deleteError.message}` };
  revalidate();
  return { success: true as const };
}
