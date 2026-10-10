'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { createPublicacionDriveFolder } from '@/lib/googleDrive';

export async function retryPublicacionDriveFolderAction(publicationId: string) {
  const access = await authorizeAction('social-media.posts.edit');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.' };
  const supabase = access.context.supabase;
  const { data: allAccounts } = await supabase.rpc('user_has_all_publication_accounts', { p_publicacion_id: publicationId });
  if (!allAccounts) return { success: false as const, error: 'Necesitas acceso a todas las cuentas destino.' };
  const { data: publication, error } = await supabase.from('publicaciones').select('*').eq('id', publicationId).maybeSingle();
  if (error || !publication) return { success: false as const, error: error?.message || 'No se encontró la publicación.' };
  if (publication.drive_folder_id && publication.drive_folder_url) return { success: true as const, data: publication };
  const folder = await createPublicacionDriveFolder(`[${publication.formato}] ${publication.fecha_publicacion} - ${publication.titulo}`);
  if (!folder) return { success: false as const, error: 'Drive sigue sin responder. La publicación está guardada; puedes volver a intentar desde el detalle.' };
  const { data, error: updateError } = await supabase.from('publicaciones').update({ drive_folder_id: folder.id, drive_folder_url: folder.url }).eq('id', publicationId).select('*').single();
  if (updateError) return { success: false as const, error: `La carpeta se creó, pero no se pudo vincular: ${updateError.message}` };
  revalidatePath('/social-media/grid');
  return { success: true as const, data };
}
