'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { countDriveFolderFiles, createDriveResumableSession, ensurePublicacionDriveFolders, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getDriveFileRule } from '@/lib/driveFileRules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getDesignPublication(publicationId: string, permission: 'design.posts.read' | 'design.posts.upload') {
  if (!UUID.test(publicationId)) return { error: 'Identificador de publicación no válido.' } as const;
  const access = await authorizeAction(permission);
  if (access.error || !access.context) return { error: access.error || 'Inicia sesión para continuar.' } as const;
  const { data: rows, error } = await access.context.supabase.rpc('get_design_publication_request', { p_id: publicationId });
  if (error) return { error: error.message } as const;
  const publication = rows?.[0];
  if (!publication) return { error: 'No se encontró la solicitud de Diseño.' } as const;
  return { access, publication } as const;
}

async function ensureFolderIds(publication: { id: string; drive_folder_id: string | null; drive_brief_folder_id: string | null; drive_deliverables_folder_id: string | null }) {
  if (!publication.drive_folder_id) throw new Error('La publicación no tiene carpeta raíz de Drive.');
  if (publication.drive_brief_folder_id && publication.drive_deliverables_folder_id) return { briefId: publication.drive_brief_folder_id, deliverablesId: publication.drive_deliverables_folder_id };
  const folders = await ensurePublicacionDriveFolders(publication.drive_folder_id);
  const { error } = await (getSupabaseAdmin().from('publicaciones')).update({ drive_brief_folder_id: folders.brief.id, drive_deliverables_folder_id: folders.deliverables.id }).eq('id', publication.id);
  if (error) throw new Error('Se crearon las carpetas, pero no se pudieron guardar sus referencias.');
  return { briefId: folders.brief.id, deliverablesId: folders.deliverables.id };
}

async function reconcileDeliverableUploads(publicationId: string, folderId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await (admin.from('publicacion_drive_uploads')).select('id,file_size,status,expires_at').eq('publicacion_id', publicationId).eq('carpeta', 'ENTREGABLES').in('status', ['RESERVING', 'UPLOADING', 'CANCEL_PENDING']);
  if (error) throw new Error(error.message);
  for (const upload of data || []) {
    if (new Date(upload.expires_at).getTime() <= Date.now()) {
      await (admin.from('publicacion_drive_uploads')).update({ status: 'EXPIRED', session_uri: null }).eq('id', upload.id);
      continue;
    }
    if (upload.status === 'RESERVING') continue;
    const file = await findDriveUploadedFile(folderId, upload.id).catch(() => null);
    if (file && file.size === Number(upload.file_size)) await (admin.from('publicacion_drive_uploads')).update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', upload.id);
  }
}

export async function listDesignPublicationDriveFilesAction(publicationId: string) {
  const result = await getDesignPublication(publicationId, 'design.posts.read');
  if ('error' in result) return { success: false as const, error: result.error };
  try {
    const folders = await ensureFolderIds(result.publication);
    await reconcileDeliverableUploads(publicationId, folders.deliverablesId);
    const [briefFiles, deliverableFiles] = await Promise.all([listDriveFolderFiles(folders.briefId), listDriveFolderFiles(folders.deliverablesId)]);
    const { data: pendingUploads } = await (getSupabaseAdmin().from('publicacion_drive_uploads')).select('id,file_name,mime_type,file_size,status,expires_at').eq('publicacion_id', publicationId).eq('carpeta', 'ENTREGABLES').eq('actor_id', result.access.context!.user.id).eq('status', 'UPLOADING').gt('expires_at', new Date().toISOString());
    return { success: true as const, data: { briefFiles, deliverableFiles, briefUrl: `https://drive.google.com/drive/folders/${folders.briefId}`, deliverablesUrl: `https://drive.google.com/drive/folders/${folders.deliverablesId}`, pendingUploads: (pendingUploads || []).map((item: { id: string; file_name: string; mime_type: string; file_size: number; expires_at: string }) => ({ id: item.id, name: item.file_name, mimeType: item.mime_type, size: Number(item.file_size), expiresAt: item.expires_at })) } };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'No se pudieron consultar los archivos.' }; }
}

export async function startDeliverableUploadAction(input: { publicationId: string; name: string; size: number }) {
  const result = await getDesignPublication(input.publicationId, 'design.posts.upload');
  if ('error' in result) return { success: false as const, error: result.error };
  if (result.publication.estatus !== 'EN_DISENO') return { success: false as const, error: 'Primero debes abrir la solicitud para cargar entregables.' };
  const rule = getDriveFileRule('ENTREGABLES', input.name);
  if (!rule) return { success: false as const, error: 'El formato de archivo no está permitido.' };
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'Cada entregable puede pesar hasta 500 MB.' };
  try {
    const folders = await ensureFolderIds(result.publication);
    await reconcileDeliverableUploads(input.publicationId, folders.deliverablesId);
    const count = await countDriveFolderFiles(folders.deliverablesId);
    const admin = getSupabaseAdmin();
    const { data: uploadId, error } = await admin.rpc('reserve_publication_deliverable_upload', { p_actor_id: result.access.context!.user.id, p_publication_id: input.publicationId, p_file_name: input.name, p_mime_type: rule.mimeType, p_file_size: input.size, p_drive_file_count: Math.min(count, 20) });
    if (error || !uploadId) throw new Error(error?.message || 'No se pudo reservar un cupo de carga.');
    let sessionUri: string;
    try { sessionUri = await createDriveResumableSession({ folderId: folders.deliverablesId, uploadId, name: input.name, mimeType: rule.mimeType, size: input.size }); }
    catch (error) { await admin.from('publicacion_drive_uploads').update({ status: 'CANCELLED' }).eq('id', uploadId); throw error; }
    const { error: updateError } = await (admin.from('publicacion_drive_uploads')).update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
    if (updateError) { const revoked = await revokeDriveResumableSession(sessionUri).catch(() => false); await admin.from('publicacion_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', session_uri: revoked ? null : sessionUri }).eq('id', uploadId); throw new Error('No se pudo guardar la sesión segura de carga.'); }
    return { success: true as const, data: { uploadId, sessionUri, mimeType: rule.mimeType } };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'No se pudo iniciar la carga.' }; }
}

async function authorizedUpload(uploadId: string) {
  if (!UUID.test(uploadId)) return { error: 'Carga no válida.' } as const;
  const admin = getSupabaseAdmin();
  const { data: upload, error } = await (admin.from('publicacion_drive_uploads')).select('*').eq('id', uploadId).eq('carpeta', 'ENTREGABLES').maybeSingle();
  if (error || !upload) return { error: error?.message || 'No se encontró la carga.' } as const;
  const result = await getDesignPublication(upload.publicacion_id, 'design.posts.upload');
  if ('error' in result || result.access.context!.user.id !== upload.actor_id) return { error: 'No tienes autorización para operar esta carga.' } as const;
  return { upload, publication: result.publication, admin } as const;
}

export async function finishDeliverableUploadAction(uploadId: string) {
  const result = await authorizedUpload(uploadId);
  if ('error' in result) return { success: false as const, error: result.error };
  if (result.publication.estatus !== 'EN_DISENO') return { success: false as const, error: 'La solicitud ya no está en diseño.' };
  try {
    const folders = await ensureFolderIds(result.publication);
    let file = await findDriveUploadedFile(folders.deliverablesId, uploadId).catch(() => null);
    for (let attempt = 0; (!file || file.size !== Number(result.upload.file_size)) && attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      file = await findDriveUploadedFile(folders.deliverablesId, uploadId).catch(() => null);
    }
    if (!file || file.size !== Number(result.upload.file_size)) return { success: false as const, error: 'Drive todavía no confirma el archivo esperado.' };
    const { error: updateError } = await (result.admin.from('publicacion_drive_uploads')).update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    if (updateError) return { success: false as const, error: 'El archivo está en Drive, pero no se pudo registrar la confirmación.' };
    revalidatePath('/design/publications'); revalidatePath(`/design/publications/${result.publication.id}`);
    return { success: true as const };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'No se pudo confirmar el archivo.' }; }
}

export async function resumeDeliverableUploadAction(uploadId: string) {
  const result = await authorizedUpload(uploadId);
  if ('error' in result) return { success: false as const, error: result.error };
  if (result.publication.estatus !== 'EN_DISENO' || result.upload.status !== 'UPLOADING' || !result.upload.session_uri || new Date(result.upload.expires_at).getTime() <= Date.now()) return { success: false as const, error: 'La sesión venció o la solicitud ya no permite cargar.' };
  return { success: true as const, data: { sessionUri: result.upload.session_uri, name: result.upload.file_name, mimeType: result.upload.mime_type, size: Number(result.upload.file_size) } };
}

export async function cancelDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga no válida.' };
  const access = await authorizeAction('design.posts.upload');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión.' };
  const admin = getSupabaseAdmin();
  const { data: upload, error } = await admin.from('publicacion_drive_uploads').select('id,actor_id,session_uri').eq('id', uploadId).eq('carpeta', 'ENTREGABLES').maybeSingle();
  if (error || !upload || upload.actor_id !== access.context.user.id) return { success: false as const, error: 'No tienes autorización para cancelar esta carga.' };
  const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
  await admin.from('publicacion_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : {}) }).eq('id', uploadId);
  return revoked ? { success: true as const } : { success: false as const, error: 'No se pudo cancelar la sesión; el cupo queda reservado hasta que expire.' };
}

export async function listPublicacionDeliverablesForReviewAction(publicationId: string) {
  const access = await authorizeAction('social-media.posts.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión.' };
  const { data: allowed } = await access.context.supabase.rpc('user_has_all_publication_accounts', { p_publicacion_id: publicationId });
  if (!allowed) return { success: false as const, error: 'No tienes acceso a todas las cuentas destino.' };
  const { data: publication, error } = await access.context.supabase.from('publicaciones').select('drive_deliverables_folder_id').eq('id', publicationId).is('deleted_at', null).maybeSingle();
  if (error || !publication?.drive_deliverables_folder_id) return { success: false as const, error: error?.message || 'La carpeta Entregables no está disponible.' };
  try { const files = await listDriveFolderFiles(publication.drive_deliverables_folder_id); return { success: true as const, data: files }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'Drive no respondió.' }; }
}

export async function getPublicationDesignerNameAction(publicationId: string) {
  const access = await authorizeAction('social-media.posts.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión.' };
  const { data, error } = await access.context.supabase.rpc('get_publication_designer_names', { p_ids: [publicationId] });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const, name: data?.[0]?.full_name || null };
}
