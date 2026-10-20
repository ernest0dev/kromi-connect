'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { createDriveResumableSession, createPublicacionDriveFolder, ensurePublicacionDriveFolders, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getDriveFileRule } from '@/lib/driveFileRules';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const UUID = /^[0-9a-f-]{36}$/i;
async function event(id: string) {
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { error: access.error || 'No tienes permiso.' } as const;
  if (!UUID.test(id)) return { error: 'Identificador inválido.' } as const;
  const { data, error } = await access.context.supabase.rpc('get_design_event_request', { p_evento_id: id });
  if (error || !data?.[0]) return { error: error?.message || 'No se encontró el evento.' } as const;
  return { access, row: data[0] } as const;
}

export async function listEventDesignFilesAction(id: string) {
  const result = await event(id); if ('error' in result) return { success: false as const, error: result.error };
  try {
    let rootId = result.row.drive_folder_id as string | null;
    let rootUrl: string | null = null;
    if (!rootId) {
      if (!['SOLICITADO', 'EN_DISENO'].includes(result.row.diseno_estatus)) return { success: true as const, briefFiles: [], deliverableFiles: [], pendingUploads: [], briefUrl: '', deliverablesUrl: '' };
      const root = await createPublicacionDriveFolder(`Evento - ${result.row.nombre}`);
      if (!root) throw new Error('No se pudo crear la carpeta raíz del evento en Drive.');
      rootId = root.id; rootUrl = root.url;
    }
    const folders = await ensurePublicacionDriveFolders(rootId);
    const [briefFiles, deliverableFiles] = await Promise.all([listDriveFolderFiles(folders.brief.id), listDriveFolderFiles(folders.deliverables.id)]);
    const admin = getSupabaseAdmin();
    const sync = await admin.rpc('sync_evento_drive_brief', { p_evento_id: id, p_drive_folder_id: rootId, p_drive_folder_url: rootUrl, p_brief_folder_id: folders.brief.id, p_deliverables_folder_id: folders.deliverables.id, p_file_count: briefFiles.length });
    if (sync.error) throw new Error('No se pudieron guardar las referencias de Drive del evento.');
    const { data: pendingUploads } = await admin.from('evento_drive_uploads').select('id,file_name,mime_type,file_size,expires_at').eq('evento_id', id).eq('actor_id', result.access.context.user.id).eq('carpeta', 'ENTREGABLES').eq('status', 'UPLOADING').gt('expires_at', new Date().toISOString());
    return { success: true as const, briefFiles, deliverableFiles, pendingUploads: (pendingUploads ?? []).map((item) => ({ id: item.id, name: item.file_name, mimeType: item.mime_type, size: Number(item.file_size), expiresAt: item.expires_at })), briefUrl: folders.brief.url ?? '', deliverablesUrl: folders.deliverables.url ?? '' };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudieron cargar los archivos.' }; }
}

export async function startEventDeliverableUploadAction(input: { id: string; name: string; mimeType: string; size: number }) {
  const access = await authorizeAction('design.requests.upload');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso para cargar.' };
  const files = await listEventDesignFilesAction(input.id);
  if (!files.success) return { success: false as const, error: files.error };
  const result = await event(input.id); if ('error' in result) return { success: false as const, error: result.error };
  if (result.row.diseno_estatus !== 'EN_DISENO' || !result.row.drive_folder_id) return { success: false as const, error: 'El evento debe estar en diseño y tener carpeta de Drive.' };
  const rule = getDriveFileRule('ENTREGABLES', input.name);
  if (!rule || input.mimeType !== rule.mimeType || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'Formato o tamaño no permitido.' };
  try {
    const folders = await ensurePublicacionDriveFolders(result.row.drive_folder_id); const admin = getSupabaseAdmin();
    const { data: uploadId, error } = await admin.rpc('reserve_evento_deliverable_upload', { p_actor_id: access.context.user.id, p_evento_id: input.id, p_file_name: input.name, p_mime_type: input.mimeType, p_file_size: input.size });
    if (error || !uploadId) throw new Error(error?.message || 'No se pudo reservar la carga.');
    const sessionUri = await createDriveResumableSession({ folderId: folders.deliverables.id, uploadId, name: input.name, mimeType: input.mimeType, size: input.size });
    const saved = await admin.from('evento_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
    if (saved.error) { await revokeDriveResumableSession(sessionUri).catch(() => false); throw new Error('No se pudo guardar la sesión segura.'); }
    return { success: true as const, uploadId, sessionUri };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.' }; }
}

export async function resumeEventDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload } = await admin.from('evento_drive_uploads').select('id,actor_id,evento_id,session_uri,status,expires_at,file_name,mime_type,file_size').eq('id', uploadId).maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró la carga.' };
  const access = await authorizeAction('design.requests.upload');
  if (access.error || !access.context || access.context.user.id !== upload.actor_id || !upload.session_uri || upload.status !== 'UPLOADING' || new Date(upload.expires_at).getTime() <= Date.now()) return { success: false as const, error: 'La sesión venció o ya no está disponible.' };
  return { success: true as const, data: { sessionUri: upload.session_uri, name: upload.file_name, mimeType: upload.mime_type, size: Number(upload.file_size) } };
}

export async function finishEventDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload, error } = await admin.from('evento_drive_uploads').select('*').eq('id', uploadId).maybeSingle();
  if (error || !upload || upload.carpeta !== 'ENTREGABLES') return { success: false as const, error: error?.message || 'No se encontró la carga.' };
  const access = await authorizeAction('design.requests.upload');
  if (access.error || !access.context || access.context.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización.' };
  const result = await event(upload.evento_id); if ('error' in result || !result.row.drive_folder_id || result.row.diseno_estatus !== 'EN_DISENO' || result.row.estatus === 'CANCELADO') return { success: false as const, error: 'El evento fue cancelado o ya no admite entregables.' };
  try {
    const folders = await ensurePublicacionDriveFolders(result.row.drive_folder_id);
    const file = await findDriveUploadedFile(folders.deliverables.id, uploadId);
    if (!file || file.size !== Number(upload.file_size) || file.mimeType !== upload.mime_type) return { success: false as const, error: 'Drive todavía no confirma el archivo esperado.' };
    await admin.from('evento_drive_uploads').update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    revalidatePath(`/design/events/${upload.evento_id}`); return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo confirmar el archivo.' }; }
}

export async function cancelEventDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload } = await admin.from('evento_drive_uploads').select('id,actor_id,session_uri').eq('id', uploadId).maybeSingle();
  const access = await authorizeAction('design.requests.upload');
  if (!upload || access.error || !access.context || access.context.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para cancelar esta carga.' };
  const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
  await admin.from('evento_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : {}) }).eq('id', uploadId);
  return { success: true as const };
}
