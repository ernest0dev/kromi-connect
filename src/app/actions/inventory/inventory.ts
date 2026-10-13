'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import {
  INVENTARIO_RUTA,
  LIMITES,
  isUuid,
  parseQuantity,
  validateItemInput,
  validateItemUpdate,
  validateMovementInput,
  type ItemFormInput,
  type ItemUpdateInput,
  type MovementInput,
} from '@/lib/inventory';
import type { InventarioActividadRow, InventarioArticuloRow, InventarioTipoControl } from '@/types';

type Failure = {
  success: false;
  error: string;
  /** POSIBLE_DUPLICADO pide confirmación; CONFLICTO_VERSION trae la versión vigente para comparar. */
  code?: 'POSIBLE_DUPLICADO' | 'CONFLICTO_VERSION';
  current?: InventarioArticuloRow | null;
};

const GENERIC_ERROR = 'No se pudo completar la operación. Inténtalo de nuevo.';

/** Las funciones SQL lanzan mensajes en español con SQLSTATE P0001 (o 42501 sin permiso); lo demás no se muestra. */
function mapRpcError(error: { code?: string; message: string }): Pick<Failure, 'error' | 'code'> {
  if (error.message.includes('POSIBLE_DUPLICADO')) {
    return {
      code: 'POSIBLE_DUPLICADO',
      error: 'Ya existe un artículo igual en esa ubicación. Si es la misma existencia, suma la cantidad con un movimiento; si es otro, créalo de todos modos.',
    };
  }
  if (error.message.includes('CONFLICTO_VERSION')) {
    return { code: 'CONFLICTO_VERSION', error: 'Otra persona modificó este artículo mientras lo editabas.' };
  }
  if (error.code === 'P0001' || error.code === '42501') return { error: error.message };
  return { error: GENERIC_ERROR };
}

const trimOrNull = (value: string | undefined) => {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
};

async function fetchCurrentItem(
  supabase: NonNullable<Awaited<ReturnType<typeof authorizeAction>>['context']>['supabase'],
  id: string,
): Promise<InventarioArticuloRow | null> {
  const { data } = await supabase.rpc('list_inventory_items', { p_articulo_id: id, p_limit: 1 });
  return data?.[0] ?? null;
}

export async function createInventoryItemAction(
  input: ItemFormInput & { observacion?: string; confirmarDuplicado?: boolean },
): Promise<{ success: true; id: string } | Failure> {
  const access = await authorizeAction('events.inventory.create');
  if (access.error || !access.context) return { success: false, error: access.error ?? 'Inicia sesión para continuar.' };

  const invalid = validateItemInput(input);
  if (invalid) return { success: false, error: invalid };
  const observacion = trimOrNull(input.observacion);
  if (observacion && observacion.length > LIMITES.observacion) {
    return { success: false, error: `La observación no puede superar ${LIMITES.observacion} caracteres.` };
  }

  const { data, error } = await access.context.supabase.rpc('create_inventory_item', {
    p_categoria_id: input.categoriaId,
    p_nombre: input.nombre.trim(),
    p_especificaciones: trimOrNull(input.especificaciones),
    p_tipo_control: input.tipoControl,
    p_codigo: input.tipoControl === 'INDIVIDUAL' ? input.codigo.trim() : null,
    p_cantidad: input.tipoControl === 'INDIVIDUAL' ? 1 : parseQuantity(input.cantidad),
    p_unidad_medida: input.unidadMedida.trim() || 'unidades',
    p_ubicacion_id: input.ubicacionId,
    p_condicion: input.condicion,
    p_observacion: observacion,
    p_confirmar_duplicado: input.confirmarDuplicado === true,
  });
  if (error) return { success: false, ...mapRpcError(error) };

  revalidatePath(INVENTARIO_RUTA);
  return { success: true, id: data };
}

export async function updateInventoryItemAction(
  input: ItemUpdateInput & { tipoControl: InventarioTipoControl },
): Promise<{ success: true; version: number } | Failure> {
  const access = await authorizeAction('events.inventory.update');
  if (access.error || !access.context) return { success: false, error: access.error ?? 'Inicia sesión para continuar.' };

  const invalid = validateItemUpdate(input, input.tipoControl);
  if (invalid) return { success: false, error: invalid };

  const { data, error } = await access.context.supabase.rpc('update_inventory_item', {
    p_articulo_id: input.id,
    p_expected_version: input.expectedVersion,
    p_categoria_id: input.categoriaId,
    p_nombre: input.nombre.trim(),
    p_especificaciones: trimOrNull(input.especificaciones),
    p_codigo: input.tipoControl === 'INDIVIDUAL' ? input.codigo.trim() : null,
    p_unidad_medida: input.unidadMedida.trim() || 'unidades',
    p_condicion: input.condicion,
  });
  if (error) {
    const mapped = mapRpcError(error);
    const current = mapped.code === 'CONFLICTO_VERSION' ? await fetchCurrentItem(access.context.supabase, input.id) : undefined;
    return { success: false, ...mapped, current };
  }

  revalidatePath(INVENTARIO_RUTA);
  return { success: true, version: data };
}

export async function registerInventoryMovementAction(
  input: MovementInput,
): Promise<{ success: true; articuloId: string } | Failure> {
  const access = await authorizeAction('events.inventory.move');
  if (access.error || !access.context) return { success: false, error: access.error ?? 'Inicia sesión para continuar.' };

  const invalid = validateMovementInput(input);
  if (invalid) return { success: false, error: invalid };

  const { data, error } = await access.context.supabase.rpc('register_inventory_movement', {
    p_articulo_id: input.articuloId,
    p_tipo: input.tipo,
    p_cantidad: parseQuantity(input.cantidad) ?? 0,
    p_expected_version: input.expectedVersion,
    p_destino_ubicacion_id: input.destinoUbicacionId || null,
    p_externo: trimOrNull(input.externo),
    p_fecha_hora: input.fechaHora ? new Date(input.fechaHora).toISOString() : null,
    p_observacion: trimOrNull(input.observacion),
  });
  if (error) {
    const mapped = mapRpcError(error);
    const current = mapped.code === 'CONFLICTO_VERSION' ? await fetchCurrentItem(access.context.supabase, input.articuloId) : undefined;
    return { success: false, ...mapped, current };
  }

  revalidatePath(INVENTARIO_RUTA);
  return { success: true, articuloId: data.articulo_id };
}

export async function createInventoryLocationAction(input: {
  sedeId: string;
  nombre: string;
}): Promise<{ success: true; id: string } | Failure> {
  const access = await authorizeAction('events.inventory.locations.create');
  if (access.error || !access.context) return { success: false, error: access.error ?? 'Inicia sesión para continuar.' };

  const nombre = input.nombre.trim();
  if (!isUuid(input.sedeId)) return { success: false, error: 'Elige primero la sede.' };
  if (!nombre || nombre.length > LIMITES.ubicacion) {
    return { success: false, error: `El nombre de la ubicación debe tener entre 1 y ${LIMITES.ubicacion} caracteres.` };
  }

  const { data, error } = await access.context.supabase.rpc('create_inventory_location', {
    p_sede_id: input.sedeId,
    p_nombre: nombre,
  });
  if (error) return { success: false, ...mapRpcError(error) };

  revalidatePath(INVENTARIO_RUTA);
  return { success: true, id: data };
}

export async function getInventoryItemActivityAction(input: {
  articuloId: string;
  tipo?: 'TRASLADO' | 'SALIDA' | 'RETORNO' | 'AJUSTE' | null;
  offset?: number;
}): Promise<{ success: true; rows: InventarioActividadRow[]; total: number } | { success: false; error: string }> {
  const access = await authorizeAction('events.inventory.read');
  if (access.error || !access.context) return { success: false, error: access.error ?? 'Inicia sesión para continuar.' };
  if (!isUuid(input.articuloId)) return { success: false, error: 'El artículo no es válido.' };

  const offset = Number.isInteger(input.offset) && (input.offset ?? 0) >= 0 ? (input.offset as number) : 0;
  const { data, error } = await access.context.supabase.rpc('get_inventory_item_activity', {
    p_articulo_id: input.articuloId,
    p_tipo: input.tipo ?? null,
    p_limit: 20,
    p_offset: offset,
  });
  if (error) return { success: false, error: mapRpcError(error).error };

  const rows = data ?? [];
  return { success: true, rows, total: rows[0]?.total_count ?? 0 };
}

export async function getInventoryItemAction(
  articuloId: string,
): Promise<{ success: true; item: InventarioArticuloRow | null } | { success: false; error: string }> {
  const access = await authorizeAction('events.inventory.read');
  if (access.error || !access.context) return { success: false, error: access.error ?? 'Inicia sesión para continuar.' };
  if (!isUuid(articuloId)) return { success: false, error: 'El artículo no es válido.' };
  return { success: true, item: await fetchCurrentItem(access.context.supabase, articuloId) };
}
