import type {
  InventarioActividadRow,
  InventarioArticuloRow,
  InventarioCondicion,
  InventarioMovimientoTipo,
  InventarioTipoControl,
} from '@/types';

export type InventoryRpcResult<T> = { ok: true; value: T } | { ok: false; error: string };

const INVALID_RESPONSE = 'El servidor devolvió datos de inventario inválidos.';

function invalidResponse<T>(): InventoryRpcResult<T> {
  return { ok: false, error: INVALID_RESPONSE };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isInventoryType(value: unknown): value is InventarioTipoControl {
  return value === 'LOTE' || value === 'INDIVIDUAL';
}

function isInventoryCondition(value: unknown): value is InventarioCondicion {
  return value === 'DISPONIBLE' || value === 'DANADO' || value === 'EN_REPARACION' || value === 'DADO_DE_BAJA';
}

function isInventoryMovementType(value: unknown): value is InventarioMovimientoTipo {
  return value === 'CONTEO_INICIAL' || value === 'TRASLADO' || value === 'SALIDA' || value === 'RETORNO' || value === 'AJUSTE';
}

export function normalizeInventoryItem(value: unknown): InventoryRpcResult<InventarioArticuloRow> {
  if (!isRecord(value)) return invalidResponse();

  const {
    id,
    categoria_id,
    categoria_nombre,
    nombre,
    especificaciones,
    atributos,
    tipo_control,
    codigo,
    cantidad,
    unidad_medida,
    sede_id,
    sede_nombre,
    ubicacion_id,
    ubicacion_nombre,
    condicion,
    version,
    creado_en,
    creado_por,
    creado_por_nombre,
    modificado_en,
    modificado_por,
    modificado_por_nombre,
    total_count,
  } = value;

  if (
    typeof id !== 'string' ||
    typeof categoria_id !== 'string' ||
    typeof categoria_nombre !== 'string' ||
    typeof nombre !== 'string' ||
    !isNullableString(especificaciones) ||
    !isRecord(atributos) ||
    !isInventoryType(tipo_control) ||
    !isNullableString(codigo) ||
    typeof cantidad !== 'number' ||
    typeof unidad_medida !== 'string' ||
    typeof sede_id !== 'string' ||
    typeof sede_nombre !== 'string' ||
    typeof ubicacion_id !== 'string' ||
    typeof ubicacion_nombre !== 'string' ||
    !isInventoryCondition(condicion) ||
    typeof version !== 'number' ||
    typeof creado_en !== 'string' ||
    !isNullableString(creado_por) ||
    !isNullableString(creado_por_nombre) ||
    typeof modificado_en !== 'string' ||
    !isNullableString(modificado_por) ||
    !isNullableString(modificado_por_nombre) ||
    typeof total_count !== 'number'
  ) {
    return invalidResponse();
  }

  return {
    ok: true,
    value: {
      id,
      categoria_id,
      categoria_nombre,
      nombre,
      especificaciones,
      atributos,
      tipo_control,
      codigo,
      cantidad,
      unidad_medida,
      sede_id,
      sede_nombre,
      ubicacion_id,
      ubicacion_nombre,
      condicion,
      version,
      creado_en,
      creado_por,
      creado_por_nombre,
      modificado_en,
      modificado_por,
      modificado_por_nombre,
      total_count,
    },
  };
}

export function normalizeInventoryItems(value: unknown): InventoryRpcResult<InventarioArticuloRow[]> {
  if (!Array.isArray(value)) return invalidResponse();

  const items: InventarioArticuloRow[] = [];
  for (const item of value) {
    const normalized = normalizeInventoryItem(item);
    if (!normalized.ok) return normalized;
    items.push(normalized.value);
  }

  return { ok: true, value: items };
}

export function normalizeInventoryActivity(value: unknown): InventoryRpcResult<InventarioActividadRow[]> {
  if (!Array.isArray(value)) return invalidResponse();

  const rows: InventarioActividadRow[] = [];
  for (const row of value) {
    if (!isRecord(row)) return invalidResponse();

    const {
      id,
      tipo,
      cantidad,
      delta,
      origen_sede_nombre,
      origen_ubicacion_nombre,
      destino_sede_nombre,
      destino_ubicacion_nombre,
      origen_externo,
      destino_externo,
      fecha_hora,
      registrado_por,
      registrado_por_nombre,
      registrado_en,
      estado,
      observacion,
      saldo,
      corrige_movimiento_id,
      total_count,
    } = row;

    if (
      typeof id !== 'string' ||
      !isInventoryMovementType(tipo) ||
      typeof cantidad !== 'number' ||
      typeof delta !== 'number' ||
      !isNullableString(origen_sede_nombre) ||
      !isNullableString(origen_ubicacion_nombre) ||
      !isNullableString(destino_sede_nombre) ||
      !isNullableString(destino_ubicacion_nombre) ||
      !isNullableString(origen_externo) ||
      !isNullableString(destino_externo) ||
      typeof fecha_hora !== 'string' ||
      !isNullableString(registrado_por) ||
      !isNullableString(registrado_por_nombre) ||
      typeof registrado_en !== 'string' ||
      estado !== 'COMPLETADO' ||
      !isNullableString(observacion) ||
      typeof saldo !== 'number' ||
      !isNullableString(corrige_movimiento_id) ||
      typeof total_count !== 'number'
    ) {
      return invalidResponse();
    }

    rows.push({
      id,
      tipo,
      cantidad,
      delta,
      origen_sede_nombre,
      origen_ubicacion_nombre,
      destino_sede_nombre,
      destino_ubicacion_nombre,
      origen_externo,
      destino_externo,
      fecha_hora,
      registrado_por,
      registrado_por_nombre,
      registrado_en,
      estado,
      observacion,
      saldo,
      corrige_movimiento_id,
      total_count,
    });
  }

  return { ok: true, value: rows };
}

export function normalizeInventoryMovementArticleId(value: unknown): InventoryRpcResult<string> {
  if (!isRecord(value) || typeof value.articulo_id !== 'string') return invalidResponse();
  return { ok: true, value: value.articulo_id };
}
