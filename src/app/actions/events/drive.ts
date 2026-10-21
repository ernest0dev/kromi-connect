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

async function eventForRequester(id: string) {
  if (!UUID.test(id)) return { error: 'Identificador inválido.' } as const;
  const access = await authorizeAction('events.schedule.design');
  if (access.error || !access.context) return { error: access.error || 'No tienes permiso para gestionar el brief.' } as const;
  const [eventResult, designResult] = await Promise.all([
    access.context.supabase.rpc('get_event', { p_evento_id: id }),
    access.context.supabase.rpc('get_event_design_data', { p_evento_id: id }),
  ]);
  const eventRow = eventResult.data?.[0]; const designRow = designResult.data?.[0];
  if (eventResult.error || designResult.error || !eventRow || !designRow) return { error: eventResult.error?.message || designResult.error?.message || 'No se encontró el evento.' } as const;
  return { access, row: { ...eventRow, ...designRow } } as const;
}

function briefUploadAllowed(row: Record<string, unknown>) {
  return row.requiere_diseno === true && row.estatus !== 'CANCELADO' && row.estatus !== 'TERMINADO' && !row.archivado_en && row.diseno_estatus !== 'CANCELADO';
}

export async function listEventBriefFilesForRequesterAction(id: string) {
  const result = await eventForRequester(id);
  if ('error' in result) return { success: false as const, error: result.error };
  try {
    const rootId = result.row.drive_folder_id as string | null;
    if (!rootId) return { success: true as const, files: [], pendingUploads: [], folderUrl: '' };
    const folders = await ensurePublicacionDriveFolders(rootId);
    const [files, pending] = await Promise.all([
      listDriveFolderFiles(folders.brief.id),
      getSupabaseAdmin().from('evento_drive_uploads').select('id,file_name,mime_type,file_size,expires_at').eq('evento_id', id).eq('actor_id', result.access.context!.user.id).eq('carpeta', 'BRIEF').eq('status', 'UPLOADING').gt('expires_at', new Date().toISOString()),
    ]);
    return { success: true as const, files, pendingUploads: (pending.data ?? []).map((item) => ({ id: item.id, name: item.file_name, mimeType: item.mime_type, size: Number(item.file_size), expiresAt: item.expires_at })), folderUrl: folders.brief.url ?? '' };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo consultar el brief.' }; }
}

export async function startEventBriefUploadAction(input: { id: string; name: string; size: number }) {
  if (!input || typeof input.id !== 'string' || typeof input.name !== 'string' || !Number.isSafeInteger(input.size)) return { success: false as const, error: 'Datos del archivo no válidos.' };
  const result = await eventForRequester(input.id);
  if ('error' in result) return { success: false as const, error: result.error };
  if (!briefUploadAllowed(result.row)) return { success: false as const, error: 'El evento ya no admite archivos de brief.' };
  const rule = getDriveFileRule('BRIEF', input.name);
  if (!rule || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'Usa JPG, PNG, WebP, PDF o MP4 de hasta 100 MB.' };
  try {
    const admin = getSupabaseAdmin();
    let rootId = result.row.drive_folder_id as string | null;
    let rootUrl: string | null = rootId ? `https://drive.google.com/drive/folders/${rootId}` : null;
    if (!rootId) {
      const root = await createPublicacionDriveFolder(`Evento - ${String(result.row.nombre)}`);
      if (!root) throw new Error('No se pudo crear la carpeta del evento en Drive.');
      rootId = root.id; rootUrl = root.url;
    }
    const folders = await ensurePublicacionDriveFolders(rootId);
    const sync = await admin.rpc('sync_evento_drive_brief', { p_evento_id: input.id, p_drive_folder_id: rootId, p_drive_folder_url: rootUrl, p_brief_folder_id: folders.brief.id, p_deliverables_folder_id: folders.deliverables.id, p_file_count: Number(result.row.drive_brief_file_count ?? 0) });
    if (sync.error) throw new Error('No se pudieron guardar las carpetas del evento.');
    const { data: uploadId, error } = await admin.rpc('reserve_evento_brief_upload', { p_actor_id: result.access.context!.user.id, p_evento_id: input.id, p_file_name: input.name, p_mime_type: rule.mimeType, p_file_size: input.size });
    if (error || !uploadId) throw new Error(error?.message || 'No se pudo reservar la carga del brief.');
    const sessionUri = await createDriveResumableSession({ folderId: folders.brief.id, uploadId, name: input.name, mimeType: rule.mimeType, size: input.size });
    const saved = await admin.from('evento_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
    if (saved.error) { await revokeDriveResumableSession(sessionUri).catch(() => false); throw new Error('No se pudo guardar la sesión segura.'); }
    return { success: true as const, uploadId, sessionUri, mimeType: rule.mimeType };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga del brief.' }; }
}

export async function resumeEventBriefUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload } = await admin.from('evento_drive_uploads').select('id,actor_id,evento_id,session_uri,status,expires_at,file_name,mime_type,file_size').eq('id', uploadId).eq('carpeta', 'BRIEF').maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró la carga.' };
  const result = await eventForRequester(upload.evento_id);
  if ('error' in result || result.access.context!.user.id !== upload.actor_id || !briefUploadAllowed(result.row) || !upload.session_uri || upload.status !== 'UPLOADING' || new Date(upload.expires_at).getTime() <= Date.now()) return { success: false as const, error: 'La sesión venció o ya no está disponible.' };
  return { success: true as const, data: { sessionUri: upload.session_uri, name: upload.file_name, mimeType: upload.mime_type, size: Number(upload.file_size) } };
}

export async function finishEventBriefUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload, error } = await admin.from('evento_drive_uploads').select('*').eq('id', uploadId).eq('carpeta', 'BRIEF').maybeSingle();
  if (error || !upload) return { success: false as const, error: error?.message || 'No se encontró la carga.' };
  if (upload.status !== 'UPLOADING') return { success: false as const, error: 'La carga ya no está pendiente de confirmación.' };
  const result = await eventForRequester(upload.evento_id);
  if ('error' in result || result.access.context!.user.id !== upload.actor_id || !briefUploadAllowed(result.row) || !result.row.drive_folder_id) return { success: false as const, error: 'El evento ya no admite archivos de brief.' };
  try {
    const folders = await ensurePublicacionDriveFolders(String(result.row.drive_folder_id));
    const file = await findDriveUploadedFile(folders.brief.id, uploadId);
    if (!file || file.size !== Number(upload.file_size) || file.mimeType !== upload.mime_type) return { success: false as const, error: 'Drive todavía no confirma el archivo esperado.' };
    await admin.from('evento_drive_uploads').update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    const files = await listDriveFolderFiles(folders.brief.id);
    const synced = await admin.rpc('sync_evento_drive_brief', { p_evento_id: upload.evento_id, p_drive_folder_id: null, p_drive_folder_url: null, p_brief_folder_id: folders.brief.id, p_deliverables_folder_id: folders.deliverables.id, p_file_count: Math.min(files.length, 10) });
    if (synced.error) throw new Error('El archivo se subió, pero no se actualizó el contador del brief.');
    revalidatePath('/events/calendar');
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo confirmar el archivo.' }; }
}

export async function cancelEventBriefUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload } = await admin.from('evento_drive_uploads').select('id,actor_id,evento_id,session_uri').eq('id', uploadId).eq('carpeta', 'BRIEF').maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró la carga.' };
  const result = await eventForRequester(upload.evento_id);
  if ('error' in result || result.access.context!.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para cancelar esta carga.' };
  const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
  await admin.from('evento_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : {}) }).eq('id', uploadId);
  return { success: true as const };
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
  const mimeType = rule?.mimeType;
  if (!rule || !mimeType || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'Formato o tamaño no permitido.' };
  try {
    const folders = await ensurePublicacionDriveFolders(result.row.drive_folder_id); const admin = getSupabaseAdmin();
    const { data: uploadId, error } = await admin.rpc('reserve_evento_deliverable_upload', { p_actor_id: access.context.user.id, p_evento_id: input.id, p_file_name: input.name, p_mime_type: mimeType, p_file_size: input.size });
    if (error || !uploadId) throw new Error(error?.message || 'No se pudo reservar la carga.');
    const sessionUri = await createDriveResumableSession({ folderId: folders.deliverables.id, uploadId, name: input.name, mimeType, size: input.size });
    const saved = await admin.from('evento_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
    if (saved.error) { await revokeDriveResumableSession(sessionUri).catch(() => false); throw new Error('No se pudo guardar la sesión segura.'); }
    return { success: true as const, uploadId, sessionUri, mimeType };
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
