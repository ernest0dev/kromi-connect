'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { validateStoreTask } from '@/lib/internalTasks';
import { createPublicacionDriveFolder, ensurePublicacionDriveFolders } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const PATH = '/internal/pendientes';
type Failure = { success: false; error: string; code?: string };
const denied = (error: string | null): Failure => ({ success: false, error: error ?? 'No tienes permiso para realizar esta acción.' });
function rpcError(error: { message: string; code?: string }): Failure {
  if (error.message.includes('CONFLICTO_VERSION')) return { success: false, code: 'CONFLICTO_VERSION', error: 'El pendiente cambió mientras lo editabas. Recarga la página.' };
  if (error.message.includes('MOTIVO_REQUERIDO')) return { success: false, code: 'MOTIVO_REQUERIDO', error: 'Escribe un motivo para continuar.' };
  if (error.code === '42501' || error.code === 'P0001') return { success: false, error: error.message };
  return { success: false, error: 'No se pudo completar la operación. Verifica que la migración esté aplicada e inténtalo otra vez.' };
}

export async function createStoreTasksAction(input: {
  tipo: string; titulo: string; detalle?: string; cantidad?: string; enlaceReferencia?: string;
  fechaRequerida?: string; sedeIds: string[]; requiereDiseno?: boolean; instruccionesDiseno?: string; fechaEntregaDiseno?: string;
}): Promise<{ success: true; createdIds: string[] } | Failure> {
  const access = await authorizeAction('internal.store-tasks.create');
  if (access.error || !access.context) return denied(access.error);
  const invalid = validateStoreTask(input);
  if (invalid) return { success: false, error: invalid };
  const { data, error } = await access.context.supabase.rpc('create_store_tasks', {
    p_data: {
      tipo: input.tipo, titulo: input.titulo.trim(), detalle: input.detalle?.trim() || null,
      cantidad: input.cantidad?.trim() || null,
      fecha_requerida: input.fechaRequerida || null, requiere_diseno: input.requiereDiseno === true,
      instrucciones_diseno: input.instruccionesDiseno?.trim() || null, fecha_entrega_diseno: input.fechaEntregaDiseno || null,
    },
    p_sede_ids: input.sedeIds,
  });
  if (error) return rpcError(error);
  const createdRows = (Array.isArray(data) ? data : []) as unknown as Array<{ id: string; titulo: string; sede_id: string }>;
  try {
    const admin = getSupabaseAdmin();
    const { data: stores } = await access.context.supabase.rpc('list_internal_stores');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
    await Promise.all(createdRows.map(async (row) => {
      try {
      const storeName = stores?.find((store) => store.id === row.sede_id)?.nombre ?? 'Tienda';
      const folder = await createPublicacionDriveFolder(`[PENDIENTE] ${today} - ${storeName} - ${row.titulo}`);
      if (!folder) return;
      const folders = await ensurePublicacionDriveFolders(folder.id);
      await admin.from('pendientes_tienda').update({
        drive_folder_id: folder.id, drive_folder_url: folder.url,
        drive_brief_folder_id: folders.brief.id, drive_deliverables_folder_id: folders.deliverables.id,
      }).eq('id', row.id).eq('creado_por', access.context.user.id);
      } catch { /* El pendiente queda guardado; Drive se puede reintentar desde su detalle. */ }
    }));
  } catch { /* El pendiente queda guardado; Drive se puede reintentar desde su detalle. */ }
  revalidatePath(PATH);
  return { success: true, createdIds: createdRows.map((row) => row.id) };
}

export async function getStoreTaskDetailAction(id: string) {
  const access = await authorizeAction('internal.store-tasks.read');
  if (access.error || !access.context) return { success: false as const, error: access.error ?? 'Inicia sesión para continuar.' };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false as const, error: 'Identificador inválido.' };
  const { data, error } = await access.context.supabase.rpc('get_store_task', { p_id: id });
  if (error || !data) return { success: false as const, error: error?.message ?? 'No se encontró el pendiente.' };
  return { success: true as const, data: data as unknown as { diseno_solicitado_en?: string | null; historial?: Array<{ id: string; tipo: string; anterior: Record<string, unknown>; nuevo: Record<string, unknown>; motivo: string | null; cambiado_por_nombre: string; cambiado_en: string }> } };
}

export async function transitionStoreTaskAction(input: {
  id: string; version: number; status: string; reason?: string;
}): Promise<{ success: true } | Failure> {
  const access = await authorizeAction('internal.store-tasks.status.update');
  if (access.error || !access.context) return denied(access.error);
  if (!/^[0-9a-f-]{36}$/i.test(input.id) || !Number.isInteger(input.version)) return { success: false, error: 'Referencia inválida.' };
  const { error } = await access.context.supabase.rpc('transition_store_task_status', {
    p_id: input.id, p_version: input.version, p_estatus: input.status, p_motivo: input.reason?.trim() || null,
  });
  if (error) return rpcError(error);
  revalidatePath(PATH);
  return { success: true };
}

export async function updateStoreTaskAction(input: {
  id: string; version: number; tipo: string; titulo: string; detalle?: string; cantidad?: string;
  enlaceReferencia?: string; fechaRequerida?: string; requiereDiseno: boolean;
  instruccionesDiseno?: string; fechaEntregaDiseno?: string;
}): Promise<{ success: true } | Failure> {
  const access = await authorizeAction('internal.store-tasks.update');
  if (access.error || !access.context) return denied(access.error);
  if (!/^[0-9a-f-]{36}$/i.test(input.id) || !Number.isInteger(input.version)) return { success: false, error: 'Referencia inválida.' };
  const invalid = validateStoreTask({ ...input, sedeIds: ['current'] });
  if (invalid) return { success: false, error: invalid };
  const { error } = await access.context.supabase.rpc('update_store_task', {
    p_id: input.id, p_version: input.version, p_data: {
      tipo: input.tipo, titulo: input.titulo.trim(), detalle: input.detalle?.trim() || null,
      cantidad: input.cantidad?.trim() || null,
      fecha_requerida: input.fechaRequerida || null, requiere_diseno: input.requiereDiseno,
      instrucciones_diseno: input.instruccionesDiseno?.trim() || null, fecha_entrega_diseno: input.fechaEntregaDiseno || null,
    },
  });
  if (error) return rpcError(error);
  revalidatePath(PATH);
  return { success: true };
}

export async function archiveStoreTaskAction(input: { id: string; version: number; restore?: boolean }): Promise<{ success: true } | Failure> {
  const access = await authorizeAction('internal.store-tasks.archive');
  if (access.error || !access.context) return denied(access.error);
  if (!/^[0-9a-f-]{36}$/i.test(input.id) || !Number.isInteger(input.version)) return { success: false, error: 'Referencia inválida.' };
  const { error } = await access.context.supabase.rpc(input.restore ? 'restore_store_task' : 'archive_store_task', {
    p_id: input.id, p_version: input.version,
  });
  if (error) return rpcError(error);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/archive`);
  return { success: true };
}
