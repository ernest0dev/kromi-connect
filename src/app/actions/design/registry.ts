'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authorizeAction } from '@/lib/auth/dal';
import type { Json } from '@/types/database.types';

const REGISTRY_PATH = '/design/registro';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIORITIES = new Set(['URGENTE', 'IMPORTANTE', 'NORMAL']);
const REQUEST_STATES = new Set(['ABIERTA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA']);
const DELIVERABLE_STATES = new Set(['PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO']);

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function invalid(message: string): never {
  redirect(`${REGISTRY_PATH}?error=${encodeURIComponent(message)}`);
}

function reportFailure(operation: string, error: { message: string; code?: string }) {
  console.error(`[design registry] ${operation} failed (${error.code ?? 'unknown'}): ${error.message}`);
  invalid('No se pudo guardar el cambio. Revisa los datos o actualiza la vista e inténtalo de nuevo.');
}

function validDate(value: string) {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export async function createDesignRequestAction(formData: FormData) {
  const access = await authorizeAction('design.solicitudes.create');
  if (access.error || !access.context) invalid(access.error ?? 'No tienes permiso para realizar esta acción.');

  const title = text(formData, 'titulo');
  const priority = text(formData, 'prioridad');
  const targetDate = text(formData, 'fecha_objetivo');
  if (!title || title.length > 200) invalid('El título es obligatorio y debe tener máximo 200 caracteres.');
  if (priority && !PRIORITIES.has(priority)) invalid('La prioridad indicada no es válida.');
  if (!validDate(targetDate)) invalid('La fecha objetivo no es válida.');

  const data: Json = {
    titulo: title,
    objetivo: text(formData, 'objetivo') || null,
    alcance_original: text(formData, 'alcance_original') || null,
    solicitante_nombre_original: text(formData, 'solicitante_nombre_original') || null,
    departamento_id: text(formData, 'departamento_id') || null,
    area_id: text(formData, 'area_id') || null,
    prioridad: priority || null,
    fecha_objetivo: targetDate || null,
    referencia_manual: text(formData, 'referencia_manual') || null,
    estado: 'ABIERTA',
  };

  const { supabase } = access.context;
  const { error } = await supabase.rpc('create_solicitud_diseno', { p_data: data });
  if (error) reportFailure('create request', error);
  revalidatePath(REGISTRY_PATH);
  redirect(`${REGISTRY_PATH}?created=1`);
}

export async function updateDesignRequestAction(formData: FormData) {
  const access = await authorizeAction('design.solicitudes.update');
  if (access.error || !access.context) invalid(access.error ?? 'No tienes permiso para realizar esta acción.');

  const id = text(formData, 'solicitud_id');
  const version = Number(text(formData, 'version'));
  const title = text(formData, 'titulo');
  const priority = text(formData, 'prioridad');
  const targetDate = text(formData, 'fecha_objetivo');
  if (!UUID_PATTERN.test(id) || !Number.isSafeInteger(version) || version < 1) {
    invalid('La solicitud o su versión no son válidas.');
  }
  if (!title || title.length > 200) invalid('El título es obligatorio y debe tener máximo 200 caracteres.');
  if (priority && !PRIORITIES.has(priority)) invalid('La prioridad indicada no es válida.');
  if (!validDate(targetDate)) invalid('La fecha objetivo no es válida.');

  const data: Json = {
    titulo: title,
    objetivo: text(formData, 'objetivo') || null,
    alcance_original: text(formData, 'alcance_original') || null,
    prioridad: priority || null,
    fecha_objetivo: targetDate || null,
    referencia_manual: text(formData, 'referencia_manual') || null,
  };
  const { supabase } = access.context;
  const { error } = await supabase.rpc('update_solicitud_diseno', {
    p_id: id,
    p_expected_version: version,
    p_data: data,
  });
  if (error) reportFailure('update request', error);
  revalidatePath(REGISTRY_PATH);
  redirect(`${REGISTRY_PATH}?updated=1`);
}

export async function addDesignDeliverableAction(formData: FormData) {
  const access = await authorizeAction('design.solicitudes.update');
  if (access.error || !access.context) invalid(access.error ?? 'No tienes permiso para realizar esta acción.');

  const requestId = text(formData, 'solicitud_id');
  const piece = text(formData, 'pieza');
  const category = text(formData, 'categoria');
  const targetDate = text(formData, 'fecha_objetivo');
  const quantityText = text(formData, 'cantidad_piezas');
  const quantity = quantityText ? Number(quantityText) : null;
  const formatCountText = text(formData, 'cantidad_formatos');
  const formatCount = formatCountText ? Number(formatCountText) : null;
  const formatId = text(formData, 'formato_id');
  const mediumId = text(formData, 'medio_id');
  if (!UUID_PATTERN.test(requestId)) invalid('La solicitud no es válida.');
  if (!piece || piece.length > 200) invalid('El nombre de la pieza es obligatorio y debe tener máximo 200 caracteres.');
  if (category && category !== 'DIGITAL' && category !== 'IMPRESO') invalid('La categoría indicada no es válida.');
  if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 1)) {
    invalid('La cantidad debe ser un entero mayor que cero.');
  }
  if (formatCount !== null && (!Number.isSafeInteger(formatCount) || formatCount < 1)) {
    invalid('La cantidad de formatos debe ser un entero mayor que cero.');
  }
  if ((formatId && !UUID_PATTERN.test(formatId)) || (mediumId && !UUID_PATTERN.test(mediumId))) {
    invalid('El formato o medio seleccionado no es válido.');
  }
  if (!validDate(targetDate)) invalid('La fecha objetivo del entregable no es válida.');

  const data: Json = {
    pieza: piece,
    categoria: category || null,
    formato_id: formatId || null,
    formato_original: text(formData, 'formato_original') || null,
    medio_id: mediumId || null,
    medio_original: text(formData, 'medio_original') || null,
    cantidad_piezas: quantity,
    cantidad_formatos: formatCount,
    alcance_texto: text(formData, 'alcance_texto') || null,
    material: text(formData, 'material') || null,
    medidas: text(formData, 'medidas') || null,
    fecha_objetivo: targetDate || null,
  };
  const { supabase } = access.context;
  const { error } = await supabase.rpc('add_solicitud_diseno_entregable', {
    p_solicitud_id: requestId,
    p_data: data,
  });
  if (error) reportFailure('add deliverable', error);
  revalidatePath(REGISTRY_PATH);
  redirect(`${REGISTRY_PATH}?deliverable=added`);
}

export async function assignDesignRequestAction(formData: FormData) {
  const access = await authorizeAction('design.solicitudes.assign');
  if (access.error || !access.context) invalid(access.error ?? 'No tienes permiso para realizar esta acción.');

  const id = text(formData, 'solicitud_id');
  const version = Number(text(formData, 'version'));
  const selected = text(formData, 'responsable_id');
  if (!UUID_PATTERN.test(id) || !Number.isSafeInteger(version) || version < 1) {
    invalid('La solicitud o su versión no son válidas.');
  }
  if (selected && !UUID_PATTERN.test(selected)) invalid('El responsable seleccionado no es válido.');

  const { supabase } = access.context;
  const { error } = await supabase.rpc('set_solicitud_diseno_responsable', {
    p_id: id,
    p_expected_version: version,
    p_responsable_id: selected || null,
  });
  if (error) reportFailure('assign request', error);
  revalidatePath(REGISTRY_PATH);
  redirect(`${REGISTRY_PATH}?updated=1`);
}

export async function transitionDesignRequestAction(formData: FormData) {
  const access = await authorizeAction('design.solicitudes.status.update');
  if (access.error || !access.context) invalid(access.error ?? 'No tienes permiso para realizar esta acción.');

  const id = text(formData, 'solicitud_id');
  const version = Number(text(formData, 'version'));
  const status = text(formData, 'estado');
  const reason = text(formData, 'motivo');
  if (!UUID_PATTERN.test(id) || !Number.isSafeInteger(version) || version < 1) {
    invalid('La solicitud o su versión no son válidas.');
  }
  if (!REQUEST_STATES.has(status)) invalid('El estado indicado no es válido.');
  if ((status === 'COMPLETADA' || status === 'CANCELADA' || status === 'ABIERTA') && !reason) {
    invalid('Completar, cancelar o reabrir requiere un motivo.');
  }

  const { supabase } = access.context;
  const { error } = await supabase.rpc('transition_solicitud_diseno', {
    p_id: id,
    p_expected_version: version,
    p_estado: status,
    p_motivo: reason || null,
  });
  if (error) reportFailure('transition request', error);
  revalidatePath(REGISTRY_PATH);
  redirect(`${REGISTRY_PATH}?updated=1`);
}

export async function transitionDesignDeliverableAction(formData: FormData) {
  const access = await authorizeAction('design.solicitudes.status.update');
  if (access.error || !access.context) invalid(access.error ?? 'No tienes permiso para realizar esta acción.');

  const id = text(formData, 'entregable_id');
  const version = Number(text(formData, 'version'));
  const status = text(formData, 'estado');
  const reason = text(formData, 'motivo');
  if (!UUID_PATTERN.test(id) || !Number.isSafeInteger(version) || version < 1) {
    invalid('El entregable o su versión no son válidos.');
  }
  if (!DELIVERABLE_STATES.has(status)) invalid('El estado indicado no es válido.');
  if ((status === 'CANCELADO' || status === 'PENDIENTE') && !reason) {
    invalid('Cancelar o reabrir un entregable requiere un motivo.');
  }

  const { supabase } = access.context;
  const { error } = await supabase.rpc('transition_solicitud_diseno_entregable', {
    p_id: id,
    p_expected_version: version,
    p_estado: status,
    p_motivo: reason || null,
  });
  if (error) reportFailure('transition deliverable', error);
  revalidatePath(REGISTRY_PATH);
  redirect(`${REGISTRY_PATH}?updated=1`);
}
