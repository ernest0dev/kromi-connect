'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { createPublicacionDriveFolder, createDriveResumableSession, ensurePublicacionDriveFolders, findDriveUploadedFile, listDriveFolderFiles, countDriveFolderFiles } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const UUID = /^[0-9a-f-]{36}$/i;
const allowed: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };
const path = '/internal/pendientes';
type DriveTaskContext = {
  id: string; titulo: string; drive_folder_id: string | null; drive_folder_url: string | null;
  drive_brief_folder_id: string | null; drive_deliverables_folder_id: string | null;
};

async function getTask(id: string) {
  if (!UUID.test(id)) return { error: 'Identificador de pendiente inválido.' } as const;
  const access = await authorizeAction('internal.store-tasks.read');
  if (access.error || !access.context) return { error: access.error || 'Inicia sesión para continuar.' } as const;
  const { data, error } = await access.context.supabase.from('pendientes_tienda')
    .select('id,titulo,sede_id,creado_por,drive_folder_id,drive_folder_url,drive_brief_folder_id,drive_deliverables_folder_id,drive_brief_file_count')
    .eq('id', id).maybeSingle();
  if (error || !data) return { error: error?.message || 'No se encontró el pendiente.' } as const;
  return { access, task: data } as const;
}

async function ensureTaskFolders(task: DriveTaskContext) {
  const admin = getSupabaseAdmin();
  let rootId = task.drive_folder_id as string | null;
  let rootUrl = task.drive_folder_url as string | null;
  if (!rootId) {
    const folder = await createPublicacionDriveFolder(`[PENDIENTE] ${task.titulo}`);
    if (!folder) throw new Error('No se pudo crear la carpeta de Drive. El pendiente está guardado; reintenta más tarde.');
    rootId = folder.id; rootUrl = folder.url;
    const { error } = await admin.from('pendientes_tienda').update({ drive_folder_id: rootId, drive_folder_url: rootUrl }).eq('id', task.id);
    if (error) throw new Error('La carpeta se creó, pero no se pudo vincular al pendiente.');
  }
  const folders = await ensurePublicacionDriveFolders(rootId);
  const { error } = await admin.from('pendientes_tienda').update({
    drive_brief_folder_id: folders.brief.id, drive_deliverables_folder_id: folders.deliverables.id,
  }).eq('id', task.id);
  if (error) throw new Error('No se pudieron guardar las carpetas de Drive.');
  return folders;
}

export async function listInternalBriefFilesAction(taskId: string) {
  const result = await getTask(taskId);
  if ('error' in result) return { success: false as const, error: result.error };
  try {
    const folders = await ensureTaskFolders(result.task);
    const [files, deliverables, count] = await Promise.all([
      listDriveFolderFiles(folders.brief.id), listDriveFolderFiles(folders.deliverables.id), countDriveFolderFiles(folders.brief.id),
    ]);
    const { error } = await getSupabaseAdmin().rpc('sync_pendiente_drive_brief', {
      p_pendiente_id: taskId, p_brief_folder_id: folders.brief.id,
      p_deliverables_folder_id: folders.deliverables.id, p_file_count: Math.min(count, 10),
    });
    if (error) throw new Error(error.message);
    revalidatePath(path);
    return { success: true as const, files, deliverables, count, folderUrl: `https://drive.google.com/drive/folders/${folders.brief.id}`, deliverablesUrl: `https://drive.google.com/drive/folders/${folders.deliverables.id}` };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo consultar Drive.' }; }
}

export async function startInternalBriefUploadAction(input: { taskId: string; name: string; mimeType: string; size: number }) {
  const result = await getTask(input.taskId);
  if ('error' in result) return { success: false as const, error: result.error };
  const edit = await authorizeAction('internal.store-tasks.update');
  if (edit.error || !edit.context) return { success: false as const, error: edit.error || 'No tienes permiso para cargar archivos.' };
  const extension = input.name.slice(input.name.lastIndexOf('.')).toLowerCase();
  if (!input.name || input.name.length > 180 || allowed[extension] !== input.mimeType) return { success: false as const, error: 'Usa JPG, PNG, WebP, PDF o MP4.' };
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > 100 * 1024 * 1024) return { success: false as const, error: 'Cada archivo puede pesar hasta 100 MB.' };
  try {
    const folders = await ensureTaskFolders(result.task);
    const count = await countDriveFolderFiles(folders.brief.id);
    const admin = getSupabaseAdmin();
    const sync = await admin.rpc('sync_pendiente_drive_brief', { p_pendiente_id: input.taskId, p_brief_folder_id: folders.brief.id, p_deliverables_folder_id: folders.deliverables.id, p_file_count: Math.min(count, 10) });
    if (sync.error) throw new Error(sync.error.message);
    const { data: uploadId, error } = await admin.rpc('reserve_pendiente_brief_upload', {
      p_actor_id: edit.context.user.id, p_pendiente_id: input.taskId, p_file_name: input.name,
      p_mime_type: input.mimeType, p_file_size: input.size,
    });
    if (error || !uploadId) throw new Error(error?.message || 'No se pudo reservar el cupo de carga.');
    const sessionUri = await createDriveResumableSession({ folderId: folders.brief.id, uploadId, name: input.name, mimeType: input.mimeType, size: input.size });
    const { error: updateError } = await admin.from('pendiente_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
    if (updateError) throw new Error('No se pudo guardar la sesión de carga.');
    return { success: true as const, uploadId, sessionUri };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.' }; }
}

export async function finishInternalBriefUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin();
  const { data: upload, error } = await admin.from('pendiente_drive_uploads').select('*').eq('id', uploadId).maybeSingle();
  if (error || !upload) return { success: false as const, error: error?.message || 'No se encontró la carga.' };
  if (upload.carpeta !== 'BRIEF') return { success: false as const, error: 'La carga no pertenece al brief.' };
  const result = await getTask(upload.pendiente_id);
  if ('error' in result || result.access.context?.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para confirmar esta carga.' };
  try {
    const folders = await ensureTaskFolders(result.task);
    const file = await findDriveUploadedFile(folders.brief.id, uploadId);
    if (!file || file.size !== Number(upload.file_size) || file.mimeType !== upload.mime_type) return { success: false as const, error: 'Drive todavía no confirma el archivo esperado.' };
    const count = await countDriveFolderFiles(folders.brief.id);
    const sync = await admin.rpc('sync_pendiente_drive_brief', { p_pendiente_id: upload.pendiente_id, p_brief_folder_id: folders.brief.id, p_deliverables_folder_id: folders.deliverables.id, p_file_count: Math.min(count, 10) });
    if (sync.error) throw new Error(sync.error.message);
    await admin.from('pendiente_drive_uploads').update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    revalidatePath(path);
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo confirmar el archivo.' }; }
}

export async function requestInternalDesignAction(taskId: string) {
  const result = await getTask(taskId);
  if ('error' in result) return { success: false as const, error: result.error };
  const access = await authorizeAction('internal.store-tasks.status.update');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso para solicitar diseño.' };
  try {
    const folders = await ensureTaskFolders(result.task);
    const count = await countDriveFolderFiles(folders.brief.id);
    const admin = getSupabaseAdmin();
    const { error: syncError } = await admin.rpc('sync_pendiente_drive_brief', { p_pendiente_id: taskId, p_brief_folder_id: folders.brief.id, p_deliverables_folder_id: folders.deliverables.id, p_file_count: Math.min(count, 10) });
    if (syncError) throw new Error(syncError.message);
    const { error } = await admin.rpc('request_pendiente_to_design', { p_pendiente_id: taskId, p_actor_id: access.context.user.id });
    if (error) throw new Error(error.message);
    revalidatePath(path); revalidatePath('/design/internal');
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo solicitar a Design.' }; }
}

export async function retractInternalDesignAction(input: { taskId: string }) {
  const access = await authorizeAction('internal.store-tasks.status.update');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso para retirar la solicitud.' };
  const { data: task } = await access.context.supabase.from('pendientes_tienda').select('version').eq('id', input.taskId).maybeSingle();
  if (!task) return { success: false as const, error: 'No se encontró el pendiente.' };
  const { error } = await access.context.supabase.rpc('retract_pendiente_design_request', {
    p_pendiente_id: input.taskId, p_version: task.version,
  });
  if (error) return { success: false as const, error: error.message.includes('CONFLICTO_VERSION') ? 'El pendiente cambió. Recarga e inténtalo de nuevo.' : error.message };
  revalidatePath(path); revalidatePath('/design/internal');
  return { success: true as const };
}
