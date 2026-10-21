'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { createDriveResumableSession, ensurePublicacionDriveFolders, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getDriveFileRule } from '@/lib/driveFileRules';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import type { InternalDesignRequest } from '@/lib/internalTasks';

const UUID = /^[0-9a-f-]{36}$/i;
const PATH = '/design/internal';

async function getRequest(id: string) {
  const access = await authorizeAction('design.internal.read');
  if (access.error || !access.context) return { error: access.error || 'Inicia sesión para continuar.' } as const;
  if (!UUID.test(id)) return { error: 'Identificador inválido.' } as const;
  const { data, error } = await access.context.supabase.rpc('get_design_internal_request', { p_pendiente_id: id });
  if (error || !data?.[0]) return { error: error?.message || 'No se encontró la solicitud.' } as const;
  return { access, request: data[0] as unknown as InternalDesignRequest } as const;
}

export async function startInternalDesignWorkAction(id: string) {
  const access = await authorizeAction('design.internal.start');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  if (!UUID.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  const { error } = await access.context.supabase.rpc('design_start_internal_request', { p_pendiente_id: id });
  if (error) return { success: false as const, error: error.message };
  revalidatePath(PATH); revalidatePath(`${PATH}/${id}`);
  return { success: true as const };
}

export async function reopenInternalDesignWorkAction(id: string) {
  const access = await authorizeAction('design.internal.start');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  if (!UUID.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  const { error } = await access.context.supabase.rpc('design_reopen_internal_request', { p_pendiente_id: id });
  if (error) return { success: false as const, error: error.message };
  revalidatePath(PATH); revalidatePath(`${PATH}/${id}`); revalidatePath('/internal/pendientes');
  return { success: true as const };
}

export async function requestInternalDesignCorrectionAction(id: string, reason: string) {
  const access = await authorizeAction('internal.store-tasks.status.update');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  if (!UUID.test(id) || reason.trim().length < 1 || reason.trim().length > 500) return { success: false as const, error: 'Describe la corrección (hasta 500 caracteres).' };
  const { error } = await access.context.supabase.rpc('request_pendiente_design_correction', { p_pendiente_id: id, p_reason: reason.trim() });
  if (error) return { success: false as const, error: error.message };
  revalidatePath(PATH); revalidatePath(`${PATH}/${id}`); revalidatePath('/internal/pendientes'); revalidatePath('/design/publications');
  return { success: true as const };
}

export async function getInternalDesignFilesAction(id: string) {
  const result = await getRequest(id);
  if ('error' in result) return { success: false as const, error: result.error };
  try {
    if (!result.request.drive_folder_id) return { success: true as const, briefFiles: [], deliverableFiles: [] };
    const folders = await ensurePublicacionDriveFolders(result.request.drive_folder_id);
    const [briefFiles, deliverableFiles] = await Promise.all([listDriveFolderFiles(folders.brief.id), listDriveFolderFiles(folders.deliverables.id)]);
    await getSupabaseAdmin().from('pendientes_tienda').update({ drive_brief_folder_id: folders.brief.id, drive_deliverables_folder_id: folders.deliverables.id }).eq('id', id);
    const { data: pendingUploads } = await getSupabaseAdmin().from('pendiente_drive_uploads').select('id,file_name,mime_type,file_size,expires_at').eq('pendiente_id', id).eq('actor_id', result.access.context.user.id).eq('carpeta', 'ENTREGABLES').eq('status', 'UPLOADING').gt('expires_at', new Date().toISOString());
    return { success: true as const, briefFiles, deliverableFiles, pendingUploads: (pendingUploads ?? []).map((item) => ({ id: item.id, name: item.file_name, mimeType: item.mime_type, size: Number(item.file_size), expiresAt: item.expires_at })) };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudieron cargar archivos de Drive.' }; }
}

export async function startInternalDeliverableUploadAction(input: { id: string; name: string; mimeType: string; size: number }) {
  const access = await authorizeAction('design.internal.upload');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso para cargar.' };
  const result = await getRequest(input.id);
  if ('error' in result) return { success: false as const, error: result.error };
  if (result.request.diseno_estatus !== 'EN_DISENO' || !result.request.drive_folder_id) return { success: false as const, error: 'La solicitud debe estar en diseño y tener carpeta de Drive.' };
  const rule = getDriveFileRule('ENTREGABLES', input.name);
  const mimeType = rule?.mimeType;
  if (!rule || !mimeType || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'Formato o tamaño de entregable no permitido.' };
  try {
    const folders = await ensurePublicacionDriveFolders(result.request.drive_folder_id);
    const admin = getSupabaseAdmin();
    const { data: uploadId, error } = await admin.rpc('reserve_pendiente_deliverable_upload', {
      p_actor_id: access.context.user.id, p_pendiente_id: input.id, p_file_name: input.name, p_mime_type: mimeType, p_file_size: input.size,
    });
    if (error || !uploadId) throw new Error(error?.message || 'No se pudo reservar la carga.');
    const sessionUri = await createDriveResumableSession({ folderId: folders.deliverables.id, uploadId, name: input.name, mimeType, size: input.size });
    await admin.from('pendiente_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
    return { success: true as const, uploadId, sessionUri, mimeType };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.' }; }
}

export async function finishInternalDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin();
  const { data: upload, error } = await admin.from('pendiente_drive_uploads').select('*').eq('id', uploadId).maybeSingle();
  if (error || !upload || upload.carpeta !== 'ENTREGABLES') return { success: false as const, error: error?.message || 'No se encontró la carga.' };
  const access = await authorizeAction('design.internal.upload');
  if (access.error || !access.context || access.context.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para confirmar esta carga.' };
  const result = await getRequest(upload.pendiente_id);
  if ('error' in result || !result.request.drive_folder_id || result.request.diseno_estatus !== 'EN_DISENO') return { success: false as const, error: 'La solicitud ya no está disponible.' };
  try {
    const folders = await ensurePublicacionDriveFolders(result.request.drive_folder_id);
    const file = await findDriveUploadedFile(folders.deliverables.id, uploadId);
    if (!file || file.size !== Number(upload.file_size) || file.mimeType !== upload.mime_type) return { success: false as const, error: 'Drive todavía no confirma el archivo esperado.' };
    await admin.from('pendiente_drive_uploads').update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    revalidatePath(`${PATH}/${upload.pendiente_id}`);
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo confirmar el entregable.' }; }
}

export async function resumeInternalDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload } = await admin.from('pendiente_drive_uploads').select('*').eq('id', uploadId).eq('carpeta', 'ENTREGABLES').maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró la carga.' };
  const access = await authorizeAction('design.internal.upload');
  if (access.error || !access.context || access.context.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para reanudar esta carga.' };
  if (upload.status !== 'UPLOADING' || !upload.session_uri || new Date(upload.expires_at).getTime() <= Date.now()) return { success: false as const, error: 'La sesión venció o ya no está disponible.' };
  const request = await getRequest(upload.pendiente_id);
  if ('error' in request || request.request.diseno_estatus !== 'EN_DISENO') return { success: false as const, error: 'La solicitud ya no admite entregables.' };
  return { success: true as const, data: { sessionUri: upload.session_uri, name: upload.file_name, mimeType: upload.mime_type, size: Number(upload.file_size) } };
}

export async function cancelInternalDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga inválida.' };
  const admin = getSupabaseAdmin(); const { data: upload } = await admin.from('pendiente_drive_uploads').select('id,actor_id,session_uri').eq('id', uploadId).eq('carpeta', 'ENTREGABLES').maybeSingle();
  const access = await authorizeAction('design.internal.upload');
  if (!upload || access.error || !access.context || access.context.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para cancelar esta carga.' };
  const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
  await admin.from('pendiente_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : {}) }).eq('id', uploadId);
  return revoked ? { success: true as const } : { success: false as const, error: 'No se pudo cancelar la sesión; el cupo queda reservado hasta que expire.' };
}

export async function deliverInternalDesignWorkAction(id: string) {
  const access = await authorizeAction('design.internal.deliver');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso para entregar.' };
  const result = await getRequest(id);
  if ('error' in result) return { success: false as const, error: result.error };
  if (!result.request.drive_folder_id || !result.request.diseno_iniciado_en) return { success: false as const, error: 'No se pudo verificar el inicio del trabajo.' };
  try {
    const folders = await ensurePublicacionDriveFolders(result.request.drive_folder_id);
    const files = await listDriveFolderFiles(folders.deliverables.id);
    const startedAt = Date.parse(result.request.diseno_iniciado_en);
    if (!files.some((file) => Date.parse(file.createdTime) > startedAt)) return { success: false as const, error: 'Carga al menos un entregable nuevo después de iniciar el trabajo.' };
    const { error } = await access.context.supabase.rpc('design_deliver_internal_request', { p_pendiente_id: id });
    if (error) return { success: false as const, error: error.message };
    revalidatePath(PATH); revalidatePath(`${PATH}/${id}`); revalidatePath('/internal/pendientes');
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo entregar.' }; }
}
