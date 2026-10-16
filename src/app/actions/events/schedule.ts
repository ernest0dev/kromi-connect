'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { EVENTOS_RUTA, validateEventInput } from '@/lib/events';
import type { EventoDetalle, EventoHistorial, EventoRow, Json } from '@/types';

type Failure = { success: false; error: string; code?: 'POSIBLE_CRUCE' | 'CONFLICTO_VERSION' | 'MOTIVO_REQUERIDO'; cruces?: unknown[] };
const GENERIC = 'No se pudo completar la operación. Inténtalo de nuevo.';
function rpcFailure(error: { code?: string; message: string; details?: string | null }): Failure {
  if (error.message.includes('POSIBLE_CRUCE')) {
    let cruces: unknown[] = [];
    try { cruces = JSON.parse(error.details ?? '[]'); } catch { /* error details are optional */ }
    return { success: false, code: 'POSIBLE_CRUCE', error: 'Hay otro evento en el mismo horario y tienda. Confirma si quieres continuar.', cruces };
  }
  if (error.message.includes('CONFLICTO_VERSION')) return { success: false, code: 'CONFLICTO_VERSION', error: 'Otra persona modificó este evento. Recarga la ficha para ver la versión actual.' };
  if (error.message.includes('MOTIVO_REQUERIDO')) return { success: false, code: 'MOTIVO_REQUERIDO', error: 'Escribe el motivo para continuar.' };
  if (error.code === 'P0001' || error.code === '42501') return { success: false, error: error.message };
  return { success: false, error: GENERIC };
}
const failAccess = (error: string | null) => ({ success: false as const, error: error ?? 'No tienes permiso para realizar esta acción.' });

export async function getEventScheduleDataAction(input: {
  desde?: string | null; hasta?: string | null; sedeId?: string | null; estatus?: string | null;
  tipo?: string | null; origen?: string | null; q?: string | null; archivados?: boolean; limit?: number; offset?: number;
}): Promise<{ success: true; rows: EventoRow[]; total: number } | Failure> {
  const access = await authorizeAction('events.schedule.read');
  if (access.error || !access.context) return failAccess(access.error);
  const { data, error } = await access.context.supabase.rpc('list_events', {
    p_desde: input.desde ?? null, p_hasta: input.hasta ?? null, p_sede_id: input.sedeId ?? null,
    p_estatus: input.estatus ?? null, p_tipo: input.tipo ?? null, p_origen: input.origen ?? null,
    p_responsable_id: null, p_search: input.q?.slice(0, 100) || null, p_archivados: input.archivados === true,
    p_dir: 'asc', p_limit: Math.min(200, Math.max(1, input.limit ?? 100)), p_offset: Math.max(0, input.offset ?? 0),
  });
  if (error) return rpcFailure(error);
  const rows = (data ?? []) as unknown as EventoRow[];
  return { success: true, rows, total: rows[0]?.total_count ?? 0 };
}

export async function getEventDetailAction(id: string): Promise<{ success: true; evento: EventoDetalle; historial: EventoHistorial[] } | Failure> {
  const access = await authorizeAction('events.schedule.read');
  if (access.error || !access.context) return failAccess(access.error);
  const [detail, history] = await Promise.all([
    access.context.supabase.rpc('get_event', { p_evento_id: id }),
    access.context.supabase.rpc('get_event_history', { p_evento_id: id, p_limit: 30, p_offset: 0 }),
  ]);
  if (detail.error) return rpcFailure(detail.error);
  const evento = detail.data?.[0] as unknown as EventoDetalle | undefined;
  if (!evento) return { success: false, error: 'No se encontró el evento.' };
  if (history.error) return rpcFailure(history.error);
  return { success: true, evento, historial: (history.data ?? []) as EventoHistorial[] };
}

export async function checkEventOverlapAction(input: { id?: string | null; inicio: string; fin: string; sedeIds: string[] }) {
  const access = await authorizeAction('events.schedule.read');
  if (access.error || !access.context) return failAccess(access.error);
  const { data, error } = await access.context.supabase.rpc('check_event_overlap', {
    p_evento_id: input.id ?? null, p_inicio: input.inicio, p_fin: input.fin, p_sede_ids: input.sedeIds,
  });
  return error ? rpcFailure(error) : { success: true as const, cruces: data ?? [] };
}

export async function createEventAction(input: Record<string, unknown>, confirmarCruce = false): Promise<{ success: true; id: string } | Failure> {
  const access = await authorizeAction('events.schedule.create');
  if (access.error || !access.context) return failAccess(access.error);
  const invalid = validateEventInput(input);
  if (invalid) return { success: false, error: invalid };
  const { data, error } = await access.context.supabase.rpc('create_event', { p_datos: input as unknown as Json, p_confirmar_cruce: confirmarCruce });
  if (error) return rpcFailure(error);
  revalidatePath(EVENTOS_RUTA);
  return { success: true, id: data };
}

export async function updateEventAction(input: { id: string; expectedVersion: number; datos: Record<string, unknown>; motivo?: string; confirmarCruce?: boolean }): Promise<{ success: true; version: number } | Failure> {
  const access = await authorizeAction('events.schedule.update');
  if (access.error || !access.context) return failAccess(access.error);
  const invalid = validateEventInput(input.datos);
  if (invalid) return { success: false, error: invalid };
  const { data, error } = await access.context.supabase.rpc('update_event', {
    p_evento_id: input.id, p_expected_version: input.expectedVersion, p_datos: input.datos as unknown as Json,
    p_motivo: input.motivo?.trim() || null, p_confirmar_cruce: input.confirmarCruce === true,
  });
  if (error) return rpcFailure(error);
  revalidatePath(EVENTOS_RUTA);
  return { success: true, version: data };
}

export async function rescheduleEventAction(input: { id: string; expectedVersion: number; inicio: string; fin: string; motivo?: string; confirmarCruce?: boolean }): Promise<{ success: true; version: number } | Failure> {
  const access = await authorizeAction('events.schedule.update');
  if (access.error || !access.context) return failAccess(access.error);
  if (!input.inicio || !input.fin || Date.parse(input.fin) <= Date.parse(input.inicio)) return { success: false, error: 'El fin debe ser posterior al inicio.' };
  const motivo = input.motivo?.trim() || null;
  if (motivo && motivo.length > 300) return { success: false, error: 'El motivo no puede superar 300 caracteres.' };
  const { data, error } = await access.context.supabase.rpc('reschedule_event', {
    p_evento_id: input.id, p_expected_version: input.expectedVersion, p_inicio: input.inicio, p_fin: input.fin,
    p_motivo: motivo, p_confirmar_cruce: input.confirmarCruce === true,
  });
  if (error) return rpcFailure(error);
  revalidatePath(EVENTOS_RUTA);
  return { success: true, version: data };
}

export async function transitionEventAction(input: { id: string; expectedVersion: number; estatus: string; motivo?: string; confirmarCruce?: boolean }): Promise<{ success: true; version: number } | Failure> {
  const access = await authorizeAction('events.schedule.status.update');
  if (access.error || !access.context) return failAccess(access.error);
  const { data, error } = await access.context.supabase.rpc('transition_event_status', {
    p_evento_id: input.id, p_expected_version: input.expectedVersion, p_estatus: input.estatus,
    p_motivo: input.motivo?.trim() || null, p_confirmar_cruce: input.confirmarCruce === true,
  });
  if (error) return rpcFailure(error);
  revalidatePath(EVENTOS_RUTA);
  return { success: true, version: data };
}

export async function saveEventClosureAction(input: { id: string; expectedVersion: number; asistentes: number | null; gasto: number | null; notas: string }) {
  const access = await authorizeAction('events.schedule.update');
  if (access.error || !access.context) return failAccess(access.error);
  if (input.asistentes !== null && (!Number.isInteger(input.asistentes) || input.asistentes < 0)) return { success: false as const, error: 'Los asistentes deben ser un número entero igual o mayor a cero.' };
  if (input.gasto !== null && (!Number.isFinite(input.gasto) || input.gasto < 0)) return { success: false as const, error: 'El gasto debe ser mayor o igual a cero.' };
  if (input.notas.length > 2000) return { success: false as const, error: 'Las notas no pueden superar 2000 caracteres.' };
  const { data, error } = await access.context.supabase.rpc('save_event_closure', {
    p_evento_id: input.id, p_expected_version: input.expectedVersion, p_asistentes_reales: input.asistentes,
    p_gasto_real: input.gasto, p_notas_cierre: input.notas,
  });
  if (error) return rpcFailure(error);
  revalidatePath(EVENTOS_RUTA);
  return { success: true as const, version: data };
}

async function archiveMutation(permission: 'events.schedule.archive', fn: 'archive_event' | 'restore_event', id: string, version: number) {
  const access = await authorizeAction(permission);
  if (access.error || !access.context) return failAccess(access.error);
  const { data, error } = await access.context.supabase.rpc(fn, { p_evento_id: id, p_expected_version: version });
  if (error) return rpcFailure(error);
  revalidatePath(EVENTOS_RUTA);
  return { success: true as const, version: data };
}
export async function archiveEventAction(id: string, version: number) {
  return archiveMutation('events.schedule.archive', 'archive_event', id, version);
}
export async function restoreEventAction(id: string, version: number) {
  return archiveMutation('events.schedule.archive', 'restore_event', id, version);
}
