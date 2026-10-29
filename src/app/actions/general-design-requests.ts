'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { createDriveResumableSession, ensureDriveChildFolder, ensureGeneralRequestDriveFolder, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getDriveFileRule } from '@/lib/driveFileRules';
import { getCaracasToday } from '@/lib/designSla';

const UUID = /^[0-9a-f-]{36}$/i;

const CATEGORIES = ['Carnicería', 'Charcutería', 'Pescadería', 'Víveres', 'Panadería', 'Farmacia', 'Eventos', 'Otros'];
const SCOPES = ['Prebo', 'Mañongo', 'Trigal Sur', 'Trigal Norte', 'Guataparo', 'Castillito', 'San Felipe', 'Online'];
const DEPARTMENTS = ['Mercadeo', 'Operaciones', 'Capital Humano', 'Selección', 'Compras', 'Farmacia', 'Ventas Online'];

export async function createGeneralDesignRequestAction(input: {
  title: string; designType: string; otherType?: string; instructions: string;
  categories: string[]; scopes: string[]; department: string; requiredDate: string; specifications?: string; submissionKey: string;
}) {
  const access = await authorizeAction('requests.general.create');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const { user, profile, supabase } = access.context;
  if (!UUID.test(input.submissionKey)) return { success: false as const, error: 'No se pudo identificar el envío. Recarga el formulario e inténtalo otra vez.' };
  if (!['social-media', 'events', 'internal'].includes(profile.role_code)) return { success: false as const, error: 'Tu perfil no puede crear solicitudes generales.' };
  const title = input.title.trim(); const instructions = input.instructions.trim();
  const date = new Date(`${input.requiredDate}T12:00:00`);
  if (!title || title.length > 200 || !instructions || instructions.length > 5000) return { success: false as const, error: 'Revisa el título y las instrucciones.' };
  if (!['DIGITAL', 'PRINT', 'BOTH', 'OTHER'].includes(input.designType)) return { success: false as const, error: 'Selecciona un tipo de diseño válido.' };
  if (input.designType === 'OTHER' && (!input.otherType?.trim() || input.otherType.trim().length > 120)) return { success: false as const, error: 'Describe el tipo de diseño (hasta 120 caracteres).' };
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.requiredDate) return { success: false as const, error: 'Indica una fecha válida.' };
  if (input.requiredDate < getCaracasToday()) return { success: false as const, error: 'La fecha requerida no puede estar en el pasado (zona horaria de Caracas).' };
  if (!DEPARTMENTS.includes(input.department) || input.categories.some((item) => !CATEGORIES.includes(item)) || input.scopes.some((item) => !SCOPES.includes(item))) return { success: false as const, error: 'Hay opciones de catálogo no válidas.' };
  const { data, error } = await (supabase as any).from('general_design_requests').insert({
    title, design_type: input.designType, design_type_other: input.designType === 'OTHER' ? input.otherType?.trim() : null,
    instructions, categories: input.categories, scopes: input.scopes, department: input.department,
    required_date: input.requiredDate, additional_specifications: input.specifications?.trim() || null,
    requester_id: user.id, requester_role: profile.role_code, client_submission_key: input.submissionKey,
  }).select('id').single();
  if (error?.code === '23505') {
    const { data: prior } = await (supabase as any).from('general_design_requests').select('id,drive_status').eq('requester_id', user.id).eq('client_submission_key', input.submissionKey).maybeSingle();
    if (prior) return { success: true as const, id: prior.id, driveStatus: prior.drive_status as 'READY' | 'ERROR' | 'PENDING' };
  }
  if (error) return { success: false as const, error: 'No se pudo guardar la solicitud. Inténtalo de nuevo.' };
  const admin = getSupabaseAdmin();
  await (admin as any).from('general_design_request_history').insert({ request_id: data.id, actor_id: user.id, action: 'CREATED' });
  let driveStatus: 'READY' | 'ERROR' = 'READY';
  try {
    const folder = await ensureGeneralRequestDriveFolder(data.id);
    await (admin as any).from('general_design_requests').update({ drive_folder_id: folder.id, drive_folder_url: folder.url, drive_status: 'READY', drive_error: null }).eq('id', data.id);
    await (admin as any).from('general_design_request_history').insert({ request_id: data.id, actor_id: user.id, action: 'DRIVE_UPDATED', detail: { status: 'READY' } });
  } catch (cause) {
    driveStatus = 'ERROR';
    const message = cause instanceof Error ? cause.message.slice(0, 500) : 'No se pudo crear la carpeta de Drive.';
    await (admin as any).from('general_design_requests').update({ drive_status: 'ERROR', drive_error: message }).eq('id', data.id);
  }
  revalidatePath('/requests/mine'); revalidatePath('/design/publications');
  return { success: true as const, id: data.id, driveStatus };
}

async function getOwnRequest(id: string) {
  if (!UUID.test(id)) return { error: 'Identificador inválido.' } as const;
  const access = await authorizeAction('requests.general.read-own');
  if (access.error || !access.context) return { error: access.error || 'No tienes permiso.' } as const;
  const { data, error } = await (access.context.supabase as any).from('general_design_requests').select('*').eq('id', id).eq('requester_id', access.context.user.id).maybeSingle();
  if (error || !data) return { error: 'No se encontró la solicitud.' } as const;
  return { access, request: data } as const;
}

export async function retryGeneralRequestDriveFolderAction(id: string) {
  const result = await getOwnRequest(id);
  if ('error' in result) return { success: false as const, error: result.error };
  try {
    const folder = await ensureGeneralRequestDriveFolder(id);
    const admin = getSupabaseAdmin() as any;
    await admin.from('general_design_requests').update({ drive_folder_id: folder.id, drive_folder_url: folder.url, drive_status: 'READY', drive_error: null }).eq('id', id);
    await admin.from('general_design_request_history').insert({ request_id: id, actor_id: result.access.context!.user.id, action: 'DRIVE_UPDATED', detail: { status: 'READY' } });
    revalidatePath('/requests/mine');
    return { success: true as const, url: folder.url };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'No se pudo crear la carpeta de Drive.';
    await (getSupabaseAdmin() as any).from('general_design_requests').update({ drive_status: 'ERROR', drive_error: message.slice(0, 500) }).eq('id', id);
    return { success: false as const, error: message };
  }
}

export async function listGeneralRequestFilesAction(id: string, category: 'REFERENCIAS' | 'ENTREGABLES' = 'REFERENCIAS') {
  if (!UUID.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  let request: any = null;
  const design = await authorizeAction('design.requests.read');
  if (!design.error && design.context) {
    const { data } = await (design.context.supabase as any).from('general_design_requests').select('*').eq('id', id).maybeSingle();
    request = data;
  } else {
    const own = await getOwnRequest(id);
    if ('error' in own) return { success: false as const, error: own.error };
    request = own.request;
  }
  if (!request) return { success: false as const, error: 'No se encontró la solicitud.' };
  if (!request.drive_folder_id) return { success: true as const, files: [] as Awaited<ReturnType<typeof listDriveFolderFiles>> };
  try {
    const folder = await ensureDriveChildFolder(request.drive_folder_id, category === 'REFERENCIAS' ? 'Referencias' : 'Entregables');
    return { success: true as const, files: await listDriveFolderFiles(folder.id) };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudieron consultar los archivos.' }; }
}

export async function listGeneralRequestPendingUploadsAction(id: string, category: 'REFERENCIAS' | 'ENTREGABLES') {
  if (!UUID.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  if (category === 'REFERENCIAS') {
    const own = await getOwnRequest(id);
    if ('error' in own) return { success: false as const, error: own.error };
  } else {
    const access = await authorizeAction('design.requests.read');
    if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  }
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin.from('general_design_request_uploads').select('id,file_name,mime_type,file_size,created_at').eq('request_id', id).eq('category', category).eq('status', 'UPLOADING');
  if (error) return { success: false as const, error: 'No se pudieron consultar las cargas pendientes.' };
  return { success: true as const, uploads: (data ?? []).map((item: any) => ({ id: item.id, name: item.file_name, mimeType: item.mime_type, size: Number(item.file_size), createdAt: item.created_at })) };
}

export async function resumeGeneralRequestUploadAction(uploadId: string, category: 'REFERENCIAS' | 'ENTREGABLES') {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Identificador inválido.' };
  const access = category === 'REFERENCIAS' ? await authorizeAction('requests.general.read-own') : await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const query = admin.from('general_design_request_uploads').select('id,request_id,actor_id,file_name,mime_type,file_size,session_uri').eq('id', uploadId).eq('category', category).eq('status', 'UPLOADING').eq('actor_id', access.context.user.id);
  const { data: upload } = await query.maybeSingle();
  if (!upload?.session_uri) {
    await admin.from('general_design_request_uploads').update({ status: 'FAILED', session_uri: null }).eq('id', uploadId).eq('status', 'UPLOADING');
    return { success: false as const, restartable: true as const, error: 'La sesión de carga expiró. Se iniciará una sesión nueva.' };
  }
  if (category === 'REFERENCIAS') {
    const { data: request } = await (access.context.supabase as any).from('general_design_requests').select('id').eq('id', upload.request_id).eq('requester_id', access.context.user.id).maybeSingle();
    if (!request) return { success: false as const, error: 'No se encontró la solicitud.' };
  }
  return { success: true as const, uploadId: upload.id, sessionUri: upload.session_uri, name: upload.file_name, size: Number(upload.file_size), mimeType: upload.mime_type };
}

export async function expireGeneralRequestUploadAction(uploadId: string, category: 'REFERENCIAS' | 'ENTREGABLES') {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Identificador inválido.' };
  const access = category === 'REFERENCIAS' ? await authorizeAction('requests.general.read-own') : await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const { error } = await (getSupabaseAdmin() as any).from('general_design_request_uploads').update({ status: 'FAILED', session_uri: null }).eq('id', uploadId).eq('actor_id', access.context.user.id).eq('category', category).eq('status', 'UPLOADING');
  return error ? { success: false as const, error: 'No se pudo actualizar la carga expirada.' } : { success: true as const };
}

export async function startGeneralRequestReferenceUploadAction(input: { id: string; name: string; size: number }) {
  const result = await getOwnRequest(input.id);
  if ('error' in result) return { success: false as const, error: result.error };
  if (!['SOLICITADA', 'EN_DISENO', 'EN_CORRECCION'].includes(result.request.status)) return { success: false as const, error: 'La solicitud ya no acepta archivos de referencia.' };
  const rule = getDriveFileRule('BRIEF', input.name);
  if (!rule || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'El formato no está permitido o supera 100 MB.' };
  try {
    let folderId = result.request.drive_folder_id as string | null;
    if (!folderId) {
      const created = await retryGeneralRequestDriveFolderAction(input.id);
      if (!created.success) throw new Error(created.error);
      const refreshed = await getOwnRequest(input.id);
      if ('error' in refreshed) throw new Error(refreshed.error);
      folderId = refreshed.request.drive_folder_id;
    }
    const driveFolder = await ensureDriveChildFolder(folderId!, 'Referencias');
    const admin = getSupabaseAdmin() as any;
    const { count } = await admin.from('general_design_request_uploads').select('id', { count: 'exact', head: true }).eq('request_id', input.id).eq('category', 'REFERENCIAS').eq('status', 'COMPLETE');
    const { data: pending } = await admin.from('general_design_request_uploads').select('id').eq('request_id', input.id).eq('category', 'REFERENCIAS').eq('status', 'UPLOADING');
    if ((count ?? 0) + (pending?.length ?? 0) >= rule.maxFiles) throw new Error('La solicitud alcanzó el límite de 10 archivos de referencia.');
    const { data: upload, error } = await admin.from('general_design_request_uploads').insert({ request_id: input.id, actor_id: result.access.context!.user.id, category: 'REFERENCIAS', file_name: input.name, mime_type: rule.mimeType, file_size: input.size }).select('id').single();
    if (error) throw new Error(error.message);
    const sessionUri = await createDriveResumableSession({ folderId: driveFolder.id, uploadId: upload.id, name: input.name, mimeType: rule.mimeType, size: input.size });
    await admin.from('general_design_request_uploads').update({ session_uri: sessionUri }).eq('id', upload.id);
    return { success: true as const, uploadId: upload.id, sessionUri, mimeType: rule.mimeType };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.' }; }
}

export async function finishGeneralRequestReferenceUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('requests.general.read-own');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: upload } = await admin.from('general_design_request_uploads').select('*').eq('id', uploadId).eq('actor_id', access.context.user.id).maybeSingle();
  if (!upload || upload.status !== 'UPLOADING') return { success: false as const, error: 'La carga no está pendiente.' };
  const { data: request } = await admin.from('general_design_requests').select('drive_folder_id').eq('id', upload.request_id).eq('requester_id', access.context.user.id).maybeSingle();
  if (!request?.drive_folder_id) return { success: false as const, error: 'No se encontró la solicitud.' };
  try {
    const folder = await ensureDriveChildFolder(request.drive_folder_id, 'Referencias');
    const file = await findDriveUploadedFile(folder.id, upload.id);
    if (!file) return { success: false as const, error: 'Drive todavía no confirma el archivo. Reintenta en unos segundos.' };
    await admin.from('general_design_request_uploads').update({ status: 'COMPLETE', drive_file_id: file.id, drive_web_url: file.webViewLink, completed_at: new Date().toISOString(), session_uri: null }).eq('id', upload.id);
    await admin.from('general_design_request_history').insert({ request_id: upload.request_id, actor_id: access.context.user.id, action: 'DRIVE_UPDATED', detail: { category: 'REFERENCIAS', file_name: upload.file_name } });
    revalidatePath('/requests/mine');
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo finalizar la carga.' }; }
}

export async function cancelGeneralRequestReferenceUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('requests.general.read-own');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: upload } = await admin.from('general_design_request_uploads').select('id,session_uri').eq('id', uploadId).eq('actor_id', access.context.user.id).eq('status', 'UPLOADING').maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró una carga pendiente.' };
  if (upload.session_uri) await revokeDriveResumableSession(upload.session_uri);
  await admin.from('general_design_request_uploads').update({ status: 'CANCELLED', session_uri: null }).eq('id', uploadId);
  return { success: true as const };
}

export async function startGeneralDesignDeliverableUploadAction(input: { id: string; name: string; size: number }) {
  if (!UUID.test(input.id)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const rule = getDriveFileRule('ENTREGABLES', input.name);
  if (!rule || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > rule.maxBytes) return { success: false as const, error: 'El formato no está permitido o supera 500 MB.' };
  const admin = getSupabaseAdmin() as any;
  const { data: request } = await admin.from('general_design_requests').select('status,drive_folder_id,started_at').eq('id', input.id).maybeSingle();
  if (!request || request.status !== 'EN_DISENO' || !request.drive_folder_id) return { success: false as const, error: 'La solicitud debe estar en diseño y tener carpeta de Drive.' };
  const { count } = await admin.from('general_design_request_uploads').select('id', { count: 'exact', head: true }).eq('request_id', input.id).eq('category', 'ENTREGABLES').in('status', ['UPLOADING', 'COMPLETE']);
  if ((count ?? 0) >= rule.maxFiles) return { success: false as const, error: 'La solicitud alcanzó el límite de 20 entregables.' };
  try {
    const folder = await ensureDriveChildFolder(request.drive_folder_id, 'Entregables');
    const { data: upload, error } = await admin.from('general_design_request_uploads').insert({ request_id: input.id, actor_id: access.context.user.id, category: 'ENTREGABLES', file_name: input.name, mime_type: rule.mimeType, file_size: input.size }).select('id').single();
    if (error) throw new Error(error.message);
    const sessionUri = await createDriveResumableSession({ folderId: folder.id, uploadId: upload.id, name: input.name, mimeType: rule.mimeType, size: input.size });
    await admin.from('general_design_request_uploads').update({ session_uri: sessionUri }).eq('id', upload.id);
    return { success: true as const, uploadId: upload.id, sessionUri, mimeType: rule.mimeType };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.' }; }
}

export async function finishGeneralDesignDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: upload } = await admin.from('general_design_request_uploads').select('*').eq('id', uploadId).eq('actor_id', access.context.user.id).eq('category', 'ENTREGABLES').maybeSingle();
  if (!upload || upload.status !== 'UPLOADING') return { success: false as const, error: 'La carga no está pendiente.' };
  const { data: request } = await admin.from('general_design_requests').select('drive_folder_id,status,started_at').eq('id', upload.request_id).maybeSingle();
  if (!request || request.status !== 'EN_DISENO') return { success: false as const, error: 'La solicitud ya no está en diseño.' };
  try {
    const folder = await ensureDriveChildFolder(request.drive_folder_id, 'Entregables');
    const file = await findDriveUploadedFile(folder.id, upload.id);
    if (!file) return { success: false as const, error: 'Drive todavía no confirma el archivo. Reintenta en unos segundos.' };
    await admin.from('general_design_request_uploads').update({ status: 'COMPLETE', drive_file_id: file.id, drive_web_url: file.webViewLink, completed_at: new Date().toISOString(), session_uri: null }).eq('id', upload.id);
    await admin.from('general_design_request_history').insert({ request_id: upload.request_id, actor_id: access.context.user.id, action: 'DRIVE_UPDATED', detail: { category: 'ENTREGABLES', file_name: upload.file_name } });
    revalidatePath(`/design/requests/general/${upload.request_id}`);
    return { success: true as const };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo finalizar la carga.' }; }
}

export async function cancelGeneralDesignDeliverableUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: upload } = await admin.from('general_design_request_uploads').select('id,session_uri').eq('id', uploadId).eq('actor_id', access.context.user.id).eq('category', 'ENTREGABLES').eq('status', 'UPLOADING').maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró una carga pendiente.' };
  if (upload.session_uri) await revokeDriveResumableSession(upload.session_uri);
  await admin.from('general_design_request_uploads').update({ status: 'CANCELLED', session_uri: null }).eq('id', uploadId);
  return { success: true as const };
}

export async function deliverGeneralDesignRequestAction(id: string) {
  if (!UUID.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: request } = await admin.from('general_design_requests').select('status,started_at').eq('id', id).maybeSingle();
  if (!request || request.status !== 'EN_DISENO' || !request.started_at) return { success: false as const, error: 'La solicitud no está en diseño.' };
  const { count } = await admin.from('general_design_request_uploads').select('id', { count: 'exact', head: true }).eq('request_id', id).eq('category', 'ENTREGABLES').eq('status', 'COMPLETE').gt('completed_at', request.started_at);
  if (!count) return { success: false as const, error: 'Carga al menos un entregable nuevo antes de entregar.' };
  const now = new Date().toISOString();
  const { data, error } = await admin.from('general_design_requests').update({ status: 'ENTREGADA', delivered_at: now, updated_at: now }).eq('id', id).eq('status', 'EN_DISENO').select('id').maybeSingle();
  if (error || !data) return { success: false as const, error: error?.message || 'No se pudo completar la entrega.' };
  await admin.from('general_design_request_history').insert({ request_id: id, actor_id: access.context.user.id, action: 'DELIVERED' });
  revalidatePath('/design/publications'); revalidatePath(`/design/requests/general/${id}`); revalidatePath('/requests/mine');
  return { success: true as const };
}

export async function setGeneralDesignPriorityAction(id: string, priority: 'HIGH' | 'NORMAL' | 'LOW') {
  if (!UUID.test(id) || !['HIGH', 'NORMAL', 'LOW'].includes(priority)) return { success: false as const, error: 'Prioridad no válida.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin.from('general_design_requests').update({ priority, updated_at: new Date().toISOString() }).eq('id', id).in('status', ['SOLICITADA', 'EN_DISENO', 'EN_CORRECCION']).select('id').maybeSingle();
  if (error || !data) return { success: false as const, error: error?.message || 'La solicitud ya no admite cambios de prioridad.' };
  await admin.from('general_design_request_history').insert({ request_id: id, actor_id: access.context.user.id, action: 'PRIORITY_UPDATED', detail: { priority } });
  revalidatePath('/design/publications'); revalidatePath(`/design/requests/general/${id}`);
  return { success: true as const };
}

export async function requestGeneralCancellationAction(id: string, reason: string) {
  const result = await getOwnRequest(id);
  if ('error' in result) return { success: false as const, error: result.error };
  const clean = reason.trim();
  if (clean.length < 1 || clean.length > 1000) return { success: false as const, error: 'Escribe el motivo (hasta 1000 caracteres).' };
  if (!['SOLICITADA', 'EN_DISENO', 'EN_CORRECCION'].includes(result.request.status)) return { success: false as const, error: 'Esta solicitud ya no admite cancelaciones.' };
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin.from('general_design_cancellations').insert({ request_id: id, requester_id: result.access.context!.user.id, reason: clean });
  if (error) return { success: false as const, error: error.code === '23505' ? 'Ya existe una petición de cancelación pendiente.' : 'No se pudo registrar la petición.' };
  await admin.from('general_design_request_history').insert({ request_id: id, actor_id: result.access.context!.user.id, action: 'CANCELLATION_REQUESTED', detail: { reason: clean } });
  revalidatePath(`/design/requests/general/${id}`); revalidatePath('/requests/mine');
  return { success: true as const };
}

export async function startGeneralDesignWorkAction(id: string) {
  if (!UUID.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: request } = await admin.from('general_design_requests').select('status,designer_id').eq('id', id).maybeSingle();
  if (!request || !['SOLICITADA', 'EN_CORRECCION'].includes(request.status)) return { success: false as const, error: 'La solicitud no está disponible para iniciar.' };
  const { data, error } = await admin.from('general_design_requests').update({ status: 'EN_DISENO', designer_id: request.designer_id ?? access.context.user.id, started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', request.status).select('id').maybeSingle();
  if (error || !data) return { success: false as const, error: error?.message || 'La solicitud cambió mientras se iniciaba.' };
  await admin.from('general_design_request_history').insert({ request_id: id, actor_id: access.context.user.id, action: 'STARTED' });
  revalidatePath('/design/publications'); revalidatePath(`/design/requests/general/${id}`);
  return { success: true as const };
}

export async function resolveGeneralCancellationAction(id: string, decision: 'APPROVED' | 'REJECTED', note: string) {
  if (!UUID.test(id) || !['APPROVED', 'REJECTED'].includes(decision) || note.trim().length > 1000) return { success: false as const, error: 'Datos de resolución no válidos.' };
  const access = await authorizeAction('design.requests.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'No tienes permiso.' };
  const admin = getSupabaseAdmin() as any;
  const { data: request } = await admin.from('general_design_requests').select('status').eq('id', id).maybeSingle();
  if (!request || !['SOLICITADA', 'EN_DISENO', 'EN_CORRECCION'].includes(request.status)) return { success: false as const, error: 'La solicitud ya no está activa.' };
  const { data: pending } = await admin.from('general_design_cancellations').select('id').eq('request_id', id).eq('status', 'PENDING').maybeSingle();
  if (!pending) return { success: false as const, error: 'No hay una petición pendiente.' };
  const now = new Date().toISOString();
  const { data: updated, error } = await admin.from('general_design_cancellations').update({ status: decision, reviewer_id: access.context.user.id, reviewed_at: now, review_note: note.trim() || null }).eq('id', pending.id).eq('status', 'PENDING').select('id').maybeSingle();
  if (error || !updated) return { success: false as const, error: error?.message || 'La petición ya fue resuelta.' };
  if (decision === 'APPROVED') await admin.from('general_design_requests').update({ status: 'CANCELADA', updated_at: now }).eq('id', id).in('status', ['SOLICITADA', 'EN_DISENO', 'EN_CORRECCION']);
  await admin.from('general_design_request_history').insert({ request_id: id, actor_id: access.context.user.id, action: decision === 'APPROVED' ? 'CANCELLATION_APPROVED' : 'CANCELLATION_REJECTED', detail: { note: note.trim() } });
  revalidatePath('/design/publications'); revalidatePath(`/design/requests/general/${id}`); revalidatePath('/requests/mine');
  return { success: true as const };
}
