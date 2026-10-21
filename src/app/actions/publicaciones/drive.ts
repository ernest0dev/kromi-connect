'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { createPublicacionDriveFolder } from '@/lib/googleDrive';
import { countDriveFolderFiles, createDriveResumableSession, ensurePublicacionDriveFolders, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const UUID = /^[0-9a-f-]{36}$/i;
const ALLOWED: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };

async function getAuthorizedPublication(publicationId: string, permission: 'social-media.posts.read' | 'social-media.posts.edit' | 'social-media.posts.status.update') {
  if (!UUID.test(publicationId)) return { error: 'Identificador de publicación no válido.' } as const;
  const access = await authorizeAction(permission);
  if (access.error || !access.context) return { error: access.error || 'Inicia sesión para continuar.' } as const;
  const { data: allowed, error: allowedError } = await access.context.supabase.rpc('user_has_all_publication_accounts', { p_publicacion_id: publicationId });
  if (allowedError || !allowed) return { error: 'No tienes acceso a todas las cuentas destino de esta publicación.' } as const;
  const { data, error } = await access.context.supabase.from('publicaciones').select('id, drive_folder_id, drive_folder_url, drive_brief_folder_id, drive_deliverables_folder_id, drive_brief_file_count, drive_brief_checked_at, instrucciones_diseno, requiere_diseno, estatus, deleted_at').eq('id', publicationId).maybeSingle();
  if (error || !data || data.deleted_at) return { error: error?.message || 'No se encontró la publicación activa.' } as const;
  if (!data.drive_folder_id) return { error: 'La publicación todavía no tiene carpeta de Drive.' } as const;
  return { access, publication: data } as const;
}

async function ensureFolders(publicationId: string, rootId: string, cachedBrief: string | null, cachedDeliverables: string | null) {
  if (cachedBrief && cachedDeliverables) return { briefId: cachedBrief, deliverablesId: cachedDeliverables };
  const folders = await ensurePublicacionDriveFolders(rootId);
  const admin = getSupabaseAdmin();
  const { error } = await (admin.from('publicaciones') as any).update({ drive_brief_folder_id: folders.brief.id, drive_deliverables_folder_id: folders.deliverables.id }).eq('id', publicationId);
  if (error) throw new Error('Se crearon las carpetas, pero no se pudieron guardar sus referencias. Reintenta la operación.');
  return { briefId: folders.brief.id, deliverablesId: folders.deliverables.id };
}

async function reconcileBriefUploads(publicationId: string, folderId: string) {
  const admin=getSupabaseAdmin();
  const {data,error}=await (admin.from('publicacion_drive_uploads') as any).select('id,file_size,mime_type,status,expires_at').eq('publicacion_id',publicationId).eq('carpeta','BRIEF').in('status',['RESERVING','UPLOADING','CANCEL_PENDING']);
  if(error)throw new Error(error.message);
  for(const upload of data||[]){
    if(new Date(upload.expires_at).getTime()<=Date.now()){
      await (admin.from('publicacion_drive_uploads') as any).update({status:'EXPIRED',session_uri:null}).eq('id',upload.id);
      continue;
    }
    if(upload.status==='RESERVING')continue;
    const file=await findDriveUploadedFile(folderId,upload.id).catch(()=>null);
    if(file&&file.size===Number(upload.file_size)&&file.mimeType===upload.mime_type){
      await (admin.from('publicacion_drive_uploads') as any).update({status:'COMPLETE',drive_file_id:file.id,completed_at:new Date().toISOString(),session_uri:null}).eq('id',upload.id);
    }
  }
}

export async function listPublicacionBriefFilesAction(publicationId: string) {
  const result = await getAuthorizedPublication(publicationId, 'social-media.posts.read');
  if ('error' in result) return { success: false as const, error: result.error };
  try {
    const folder = await ensureFolders(publicationId, result.publication.drive_folder_id!, result.publication.drive_brief_folder_id, result.publication.drive_deliverables_folder_id);
    await reconcileBriefUploads(publicationId,folder.briefId);
    const [files, count] = await Promise.all([listDriveFolderFiles(folder.briefId), countDriveFolderFiles(folder.briefId)]);
    const { error } = await getSupabaseAdmin().rpc('sync_publication_drive_brief', { p_publication_id: publicationId, p_brief_folder_id: folder.briefId, p_deliverables_folder_id: folder.deliverablesId, p_file_count: Math.min(count, 10) });
    if (error) throw new Error(error.message);
    revalidatePath('/social-media/grid');
    const {data:pendingUploads}=await (getSupabaseAdmin().from('publicacion_drive_uploads') as any).select('id,file_name,mime_type,file_size,expires_at').eq('publicacion_id',publicationId).eq('carpeta','BRIEF').eq('actor_id',result.access.context!.user.id).eq('status','UPLOADING').gt('expires_at',new Date().toISOString());
    return { success: true as const, data: { files, count, checkedAt: new Date().toISOString(), folderUrl: `https://drive.google.com/drive/folders/${folder.briefId}`, pendingUploads:(pendingUploads||[]).map((upload:any)=>({id:upload.id,name:upload.file_name,mimeType:upload.mime_type,size:Number(upload.file_size),expiresAt:upload.expires_at})) } };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'No se pudo consultar el brief en Drive.' }; }
}

export async function listPublicacionDeliverablesAction(publicationId: string) {
  const access = await authorizeAction('design.posts.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.' };
  const { data: queue, error } = await access.context.supabase.rpc('get_design_publication_queue');
  if (error) return { success: false as const, error: error.message };
  const publication = queue?.find((item) => item.id === publicationId);
  if (!publication?.drive_folder_id) return { success: false as const, error: 'La solicitud no está en la cola de Design o no tiene carpeta de Drive.' };
  try {
    const folders = await ensurePublicacionDriveFolders(publication.drive_folder_id);
    await (getSupabaseAdmin().from('publicaciones') as any).update({ drive_brief_folder_id: folders.brief.id, drive_deliverables_folder_id: folders.deliverables.id }).eq('id', publicationId);
    const [briefFiles, deliverableFiles] = await Promise.all([listDriveFolderFiles(folders.brief.id), listDriveFolderFiles(folders.deliverables.id)]);
    return { success: true as const, data: { briefFiles, deliverableFiles, briefUrl: `https://drive.google.com/drive/folders/${folders.brief.id}`, deliverablesUrl: `https://drive.google.com/drive/folders/${folders.deliverables.id}` } };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudieron consultar los entregables.' }; }
}

export async function listDesignPublicationDriveFilesAction(publicationIds: string[]) {
  const access=await authorizeAction('design.posts.read');
  if(access.error||!access.context)return {success:false as const,error:access.error||'Inicia sesión para continuar.',data:{}};
  const ids=[...new Set(publicationIds.filter((id)=>UUID.test(id)))].slice(0,100);
  const {data:queue,error}=await access.context.supabase.rpc('get_design_publication_queue');
  if(error)return {success:false as const,error:error.message,data:{}};
  const wanted=(queue||[]).filter((publication)=>ids.includes(publication.id)&&publication.drive_folder_id);
  const entries=await Promise.all(wanted.map(async(publication)=>{
    try{
      const folders=await ensurePublicacionDriveFolders(publication.drive_folder_id!);
      await (getSupabaseAdmin().from('publicaciones') as any).update({drive_brief_folder_id:folders.brief.id,drive_deliverables_folder_id:folders.deliverables.id}).eq('id',publication.id);
      const [briefFiles,deliverableFiles]=await Promise.all([listDriveFolderFiles(folders.brief.id),listDriveFolderFiles(folders.deliverables.id)]);
      return [publication.id,{briefFiles,deliverableFiles,briefUrl:`https://drive.google.com/drive/folders/${folders.brief.id}`,deliverablesUrl:`https://drive.google.com/drive/folders/${folders.deliverables.id}`,error:null}] as const;
    }catch(cause){return [publication.id,{briefFiles:[],deliverableFiles:[],briefUrl:null,deliverablesUrl:null,error:cause instanceof Error?cause.message:'No se pudieron consultar los archivos.'}] as const;}
  }));
  return {success:true as const,error:undefined,data:Object.fromEntries(entries)};
}

export async function startPublicacionBriefUploadAction(input: { publicationId: string; name: string; mimeType: string; size: number }) {
  const result = await getAuthorizedPublication(input.publicationId, 'social-media.posts.edit');
  if ('error' in result) return { success: false as const, error: result.error };
  const extension = input.name.slice(input.name.lastIndexOf('.')).toLowerCase();
  if (!input.name || input.name.length > 180 || ALLOWED[extension] !== input.mimeType) return { success: false as const, error: 'Usa JPG, PNG, WebP, PDF o MP4 con su tipo de archivo correspondiente.' };
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > 100 * 1024 * 1024) return { success: false as const, error: 'Cada archivo puede pesar hasta 100 MB.' };
  try {
    const folders = await ensureFolders(input.publicationId, result.publication.drive_folder_id!, result.publication.drive_brief_folder_id, result.publication.drive_deliverables_folder_id);
    await reconcileBriefUploads(input.publicationId,folders.briefId);
    const count = await countDriveFolderFiles(folders.briefId);
    const admin = getSupabaseAdmin();
    const { error: syncError } = await admin.rpc('sync_publication_drive_brief', { p_publication_id: input.publicationId, p_brief_folder_id: folders.briefId, p_deliverables_folder_id: folders.deliverablesId, p_file_count: Math.min(count, 10) });
    if (syncError) throw new Error(syncError.message);
    const { data: uploadId, error: reserveError } = await admin.rpc('reserve_publication_brief_upload', { p_actor_id: result.access.context!.user.id, p_publication_id: input.publicationId, p_file_name: input.name, p_mime_type: input.mimeType, p_file_size: input.size });
    if (reserveError || !uploadId) throw new Error(reserveError?.message || 'No se pudo reservar un cupo de carga.');
    let sessionUri: string | null = null;
    try {
      sessionUri = await createDriveResumableSession({ folderId: folders.briefId, uploadId, name: input.name, mimeType: input.mimeType, size: input.size });
      const { error: updateError } = await (admin.from('publicacion_drive_uploads') as any).update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId);
      if (updateError) {
        const revoked = await revokeDriveResumableSession(sessionUri).catch(() => false);
        await (admin.from('publicacion_drive_uploads') as any).update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', session_uri: revoked ? null : sessionUri }).eq('id', uploadId);
        throw new Error('No se pudo guardar la sesión segura de carga.');
      }
      return { success: true as const, data: { uploadId, sessionUri } };
    } catch (cause) {
      if (!sessionUri) await (admin.from('publicacion_drive_uploads') as any).update({ status: 'CANCELLED' }).eq('id', uploadId);
      throw cause;
    }
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'No se pudo iniciar la carga.' }; }
}

export async function finishPublicacionBriefUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga no válida.' };
  const admin = getSupabaseAdmin();
  const { data: upload, error } = await (admin.from('publicacion_drive_uploads') as any).select('*').eq('id', uploadId).maybeSingle();
  if (error || !upload) return { success: false as const, error: error?.message || 'No se encontró la reserva.' };
  const result = await getAuthorizedPublication(upload.publicacion_id, 'social-media.posts.edit');
  if ('error' in result || result.access.context!.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para confirmar esta carga.' };
  try {
    const folder = await ensureFolders(upload.publicacion_id, result.publication.drive_folder_id!, result.publication.drive_brief_folder_id, result.publication.drive_deliverables_folder_id);
    const file = await findDriveUploadedFile(folder.briefId, uploadId);
    if (!file || file.size !== Number(upload.file_size) || file.mimeType !== upload.mime_type) return { success: false as const, error: 'Drive todavía no confirma un archivo con los metadatos esperados.' };
    const count = await countDriveFolderFiles(folder.briefId);
    const { error: syncError } = await admin.rpc('sync_publication_drive_brief', { p_publication_id: upload.publicacion_id, p_brief_folder_id: folder.briefId, p_deliverables_folder_id: folder.deliverablesId, p_file_count: Math.min(count, 10) });
    if (syncError) throw new Error(syncError.message);
    await (admin.from('publicacion_drive_uploads') as any).update({ status: 'COMPLETE', drive_file_id: file.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    revalidatePath('/social-media/grid');
    return { success: true as const, data: file };
  } catch (cause) { return { success: false as const, error: cause instanceof Error ? cause.message : 'No se pudo confirmar el archivo.' }; }
}

export async function resumePublicacionBriefUploadAction(uploadId:string){
  if(!UUID.test(uploadId))return {success:false as const,error:'Carga no válida.'};
  const admin=getSupabaseAdmin();
  const {data:upload,error}=await (admin.from('publicacion_drive_uploads') as any).select('id,publicacion_id,actor_id,file_name,mime_type,file_size,session_uri,status,expires_at').eq('id',uploadId).maybeSingle();
  if(error||!upload)return {success:false as const,error:error?.message||'No se encontró la carga interrumpida.'};
  const result=await getAuthorizedPublication(upload.publicacion_id,'social-media.posts.edit');
  if('error' in result||result.access.context!.user.id!==upload.actor_id)return {success:false as const,error:'No tienes autorización para reanudar esta carga.'};
  if(upload.status!=='UPLOADING'||!upload.session_uri||new Date(upload.expires_at).getTime()<=Date.now())return {success:false as const,error:'La sesión de Drive venció o ya no está disponible. Inicia una carga nueva.'};
  return {success:true as const,data:{sessionUri:upload.session_uri,name:upload.file_name,mimeType:upload.mime_type,size:Number(upload.file_size)}};
}

export async function cancelPublicacionBriefUploadAction(uploadId: string) {
  if (!UUID.test(uploadId)) return { success: false as const, error: 'Carga no válida.' };
  const admin = getSupabaseAdmin();
  const { data: upload } = await (admin.from('publicacion_drive_uploads') as any).select('*').eq('id', uploadId).maybeSingle();
  if (!upload) return { success: false as const, error: 'No se encontró la reserva.' };
  const result = await getAuthorizedPublication(upload.publicacion_id, 'social-media.posts.edit');
  if ('error' in result || result.access.context!.user.id !== upload.actor_id) return { success: false as const, error: 'No tienes autorización para cancelar esta carga.' };
  const folders = upload.session_uri ? await ensureFolders(upload.publicacion_id, result.publication.drive_folder_id!, result.publication.drive_brief_folder_id, result.publication.drive_deliverables_folder_id) : null;
  const completedFile = folders ? await findDriveUploadedFile(folders.briefId, uploadId).catch(() => null) : null;
  if (completedFile) {
    const count = await countDriveFolderFiles(folders!.briefId);
    await admin.rpc('sync_publication_drive_brief', { p_publication_id: upload.publicacion_id, p_brief_folder_id: folders!.briefId, p_deliverables_folder_id: folders!.deliverablesId, p_file_count: Math.min(count, 10) });
    await (admin.from('publicacion_drive_uploads') as any).update({ status: 'COMPLETE', drive_file_id: completedFile.id, completed_at: new Date().toISOString(), session_uri: null }).eq('id', uploadId);
    return { success: true as const, completed: true as const };
  }
  const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
  await (admin.from('publicacion_drive_uploads') as any).update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', expires_at: revoked ? upload.expires_at : new Date(Date.now()+7*24*60*60*1000).toISOString(), ...(revoked ? { session_uri: null } : {}) }).eq('id', uploadId);
  if (revoked) return { success: true as const };
  return { success: false as const, error: 'No pudimos revocar la sesión de Drive. El cupo queda reservado hasta que expire.' };
}

export async function requestPublicationToDesignAction(publicationId: string) {
  const result = await getAuthorizedPublication(publicationId, 'social-media.posts.status.update');
  if ('error' in result) return { success: false as const, error: result.error };
  if (result.publication.requiere_diseno && (result.publication.instrucciones_diseno?.trim().length ?? 0) < 10) return { success: false as const, error: 'Escribe al menos 10 caracteres de instrucciones para solicitar diseño.' };
  try {
    const folders = await ensureFolders(publicationId, result.publication.drive_folder_id!, result.publication.drive_brief_folder_id, result.publication.drive_deliverables_folder_id);
    const count = await countDriveFolderFiles(folders.briefId);
    const { error: syncError } = await getSupabaseAdmin().rpc('sync_publication_drive_brief', { p_publication_id: publicationId, p_brief_folder_id: folders.briefId, p_deliverables_folder_id: folders.deliverablesId, p_file_count: Math.min(count, 10) });
    if (syncError) throw new Error(syncError.message);
    const { data, error } = await getSupabaseAdmin().rpc('request_publication_to_design', { p_publication_id: publicationId, p_actor_id: result.access.context!.user.id });
    if (error) throw new Error(error.message);
    revalidatePath('/social-media/grid'); revalidatePath('/social-media/kanban'); revalidatePath('/design/publications');
    return { success: true as const, data };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'No se pudo solicitar a Design.' }; }
}

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
