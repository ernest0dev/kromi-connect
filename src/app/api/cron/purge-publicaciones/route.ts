import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { deletePublicacionDriveFolder, getDriveFileIdFromUrl } from '@/lib/googleDrive';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: claimed, error: claimError } = await supabase.rpc('claim_expired_publication_purges');
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const results: { id: string; status: 'purged' | 'drive_error' | 'database_error'; message?: string }[] = [];
  for (const publication of claimed || []) {
    const folderId = publication.drive_folder_id || getDriveFileIdFromUrl(publication.drive_folder_url);
    if (!folderId && publication.drive_folder_url) {
      const message = 'No se pudo identificar la carpeta de Drive a partir de la URL guardada.';
      await supabase.from('publicaciones').update({ drive_cleanup_status: 'ERROR', drive_cleanup_error: message }).eq('id', publication.id);
      results.push({ id: publication.id, status: 'drive_error', message });
      continue;
    }

    if (folderId) {
      const drive = await deletePublicacionDriveFolder(folderId);
      if (!drive.success) {
        const message = drive.error || 'No se pudo eliminar la carpeta de Drive.';
        await supabase.from('publicaciones').update({ drive_cleanup_status: 'ERROR', drive_cleanup_error: message }).eq('id', publication.id);
        results.push({ id: publication.id, status: 'drive_error', message });
        continue;
      }
    }

    const { error: markError } = await supabase.from('publicaciones').update({
      drive_cleanup_status: 'ELIMINADO', drive_cleanup_error: null, drive_deleted_at: new Date().toISOString(),
    }).eq('id', publication.id);
    if (markError) {
      results.push({ id: publication.id, status: 'database_error', message: markError.message });
      continue;
    }

    const { error: deleteError } = await supabase.from('publicaciones').delete().eq('id', publication.id);
    if (deleteError) {
      results.push({ id: publication.id, status: 'database_error', message: deleteError.message });
      continue;
    }
    results.push({ id: publication.id, status: 'purged' });
  }

  return NextResponse.json({ processed: results.length, results });
}
