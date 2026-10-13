// Utilidades puras del inventario de Eventos (sin acceso a datos), usables en servidor y cliente.
// La validación real vive en las funciones SQL; aquí se repite para responder rápido y con mensajes claros.

import type {
  InventarioConsulta,
  InventarioCondicion,
  InventarioMovimientoRegistrable,
  InventarioSortKey,
  InventarioTipoControl,
} from '@/types';

export const INVENTARIO_RUTA = '/events/inventory';
export const CARACAS_TZ = 'America/Caracas';

export const CONDICIONES: { value: InventarioCondicion; label: string }[] = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'DANADO', label: 'Dañado' },
  { value: 'EN_REPARACION', label: 'En reparación' },
  { value: 'DADO_DE_BAJA', label: 'Dado de baja' },
];

export const TIPOS_CONTROL: { value: InventarioTipoControl; label: string; short: string }[] = [
  { value: 'LOTE', label: 'Por cantidad / lote', short: 'Lote' },
  { value: 'INDIVIDUAL', label: 'Unidad individual', short: 'Individual' },
];

export const MOVIMIENTOS_REGISTRABLES: {
  value: InventarioMovimientoRegistrable;
  label: string;
  description: string;
}[] = [
  { value: 'TRASLADO', label: 'Traslado', description: 'Entre sedes o ubicaciones' },
  { value: 'SALIDA', label: 'Salida', description: 'Sale de la sede' },
  { value: 'RETORNO', label: 'Retorno', description: 'Vuelve a una sede' },
  { value: 'AJUSTE', label: 'Conteo / ajuste', description: 'Corrige la cantidad contada' },
];

export const MOVIMIENTO_ETIQUETAS: Record<string, string> = {
  CONTEO_INICIAL: 'Conteo inicial',
  TRASLADO: 'Traslado',
  SALIDA: 'Salida',
  RETORNO: 'Retorno',
  AJUSTE: 'Conteo / ajuste',
};

/** Sugerencias para el campo libre de unidad de medida. La lista definitiva está pendiente con el equipo. */
export const UNIDADES_SUGERIDAS = ['unidades', 'cajas', 'paquetes', 'bolsas', 'rollos', 'metros'];

export const PAGE_SIZES = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 10;

const SORT_KEYS: InventarioSortKey[] = ['nombre', 'categoria', 'cantidad', 'ubicacion', 'condicion', 'modificado'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LIMITES = {
  nombre: 160,
  especificaciones: 2000,
  unidad: 30,
  codigo: 60,
  observacion: 500,
  externo: 120,
  ubicacion: 80,
} as const;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

export const sedeSlug = (codigo: string) => codigo.toLowerCase().replace(/_/g, '-');

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** Normaliza los parámetros de la URL. Todo valor desconocido vuelve a su valor por defecto. */
export function parseInventoryQuery(sp: Record<string, string | string[] | undefined>): InventarioConsulta {
  const condicion = first(sp.condicion);
  const control = first(sp.control);
  const sort = first(sp.sort);
  const pageSize = Number(first(sp.size));
  const page = Number(first(sp.page));
  return {
    sede: first(sp.sede).toLowerCase().slice(0, 40),
    q: first(sp.q).trim().slice(0, 100),
    categoria: isUuid(first(sp.categoria)) ? first(sp.categoria) : '',
    ubicacion: isUuid(first(sp.ubicacion)) ? first(sp.ubicacion) : '',
    condicion: CONDICIONES.some((c) => c.value === condicion) ? (condicion as InventarioCondicion) : '',
    control: TIPOS_CONTROL.some((c) => c.value === control) ? (control as InventarioTipoControl) : '',
    sort: SORT_KEYS.includes(sort as InventarioSortKey) ? (sort as InventarioSortKey) : 'nombre',
    dir: first(sp.dir) === 'desc' ? 'desc' : 'asc',
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

/** Construye la query string a partir de la consulta actual, omitiendo los valores por defecto. */
export function buildInventoryQueryString(query: InventarioConsulta, patch: Partial<InventarioConsulta> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.sede) params.set('sede', next.sede);
  if (next.q) params.set('q', next.q);
  if (next.categoria) params.set('categoria', next.categoria);
  if (next.ubicacion) params.set('ubicacion', next.ubicacion);
  if (next.condicion) params.set('condicion', next.condicion);
  if (next.control) params.set('control', next.control);
  if (next.sort !== 'nombre') params.set('sort', next.sort);
  if (next.dir !== 'asc') params.set('dir', next.dir);
  if (next.page > 1) params.set('page', String(next.page));
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set('size', String(next.pageSize));
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function shortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Usuario';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length > 2 ? 2 : 1].charAt(0).toUpperCase()}.`;
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(value);
}

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CARACAS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** "Hoy 14:32", "Ayer 17:05" o "12 oct, 11:20", en hora de Caracas. */
export function formatStamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const time = new Intl.DateTimeFormat('es-VE', { timeZone: CARACAS_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  if (dayKey(date) === dayKey(now)) return `Hoy ${time}`;
  if (dayKey(date) === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `Ayer ${time}`;
  // formatToParts evita que el separador ("01-oct" vs "01 oct") dependa de la versión de ICU.
  const parts = new Intl.DateTimeFormat('es-VE', { timeZone: CARACAS_TZ, day: 'numeric', month: 'short' }).formatToParts(date);
  const day = `${parts.find((p) => p.type === 'day')?.value ?? ''} ${(parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '')}`;
  return `${day}, ${time}`;
}

/** Convierte "12,5" o "12.5" a número; devuelve null si no es válido, negativo o con más de 2 decimales. */
export function parseQuantity(text: string | number): number | null {
  const raw = typeof text === 'number' ? String(text) : text.trim().replace(',', '.');
  if (raw === '' || !/^\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value >= 10_000_000_000) return null;
  return Math.round(value * 100) / 100 === value ? value : null;
}

export interface ItemFormInput {
  categoriaId: string;
  nombre: string;
  especificaciones: string;
  tipoControl: InventarioTipoControl;
  codigo: string;
  cantidad: string;
  unidadMedida: string;
  ubicacionId: string;
  condicion: InventarioCondicion | '';
}

export interface ItemUpdateInput {
  id: string;
  expectedVersion: number;
  categoriaId: string;
  nombre: string;
  especificaciones: string;
  codigo: string;
  unidadMedida: string;
  condicion: InventarioCondicion | '';
}

export interface MovementInput {
  articuloId: string;
  tipo: InventarioMovimientoRegistrable;
  cantidad: string;
  expectedVersion: number;
  destinoUbicacionId?: string;
  externo?: string;
  fechaHora?: string;
  observacion?: string;
}

function validateDescriptive(input: {
  categoriaId: string;
  nombre: string;
  especificaciones: string;
  unidadMedida: string;
  condicion: string;
}): string | null {
  if (!isUuid(input.categoriaId)) return 'Elige una categoría.';
  const nombre = input.nombre.trim();
  if (!nombre) return 'Escribe el nombre del artículo.';
  if (nombre.length > LIMITES.nombre) return `El nombre no puede superar ${LIMITES.nombre} caracteres.`;
  if (input.especificaciones.trim().length > LIMITES.especificaciones) {
    return `Las especificaciones no pueden superar ${LIMITES.especificaciones} caracteres.`;
  }
  if (input.unidadMedida.trim().length > LIMITES.unidad) return `La unidad de medida no puede superar ${LIMITES.unidad} caracteres.`;
  if (!CONDICIONES.some((c) => c.value === input.condicion)) return 'Elige la condición del artículo.';
  return null;
}

export function validateItemInput(input: ItemFormInput): string | null {
  const base = validateDescriptive(input);
  if (base) return base;
  if (!TIPOS_CONTROL.some((t) => t.value === input.tipoControl)) return 'Elige el tipo de control.';
  if (!isUuid(input.ubicacionId)) return 'Elige la sede y la ubicación interna.';
  const codigo = input.codigo.trim();
  if (input.tipoControl === 'INDIVIDUAL') {
    if (!codigo) return 'Una unidad individual necesita un código o etiqueta.';
    if (codigo.length > LIMITES.codigo) return `El código no puede superar ${LIMITES.codigo} caracteres.`;
  } else if (parseQuantity(input.cantidad) === null) {
    return 'La cantidad debe ser un número igual o mayor que 0, con hasta 2 decimales.';
  }
  return null;
}

export function validateItemUpdate(input: ItemUpdateInput, tipoControl: InventarioTipoControl): string | null {
  if (!isUuid(input.id)) return 'El artículo no es válido.';
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) return 'La versión del artículo no es válida.';
  const base = validateDescriptive(input);
  if (base) return base;
  const codigo = input.codigo.trim();
  if (tipoControl === 'INDIVIDUAL') {
    if (!codigo) return 'Una unidad individual necesita un código o etiqueta.';
    if (codigo.length > LIMITES.codigo) return `El código no puede superar ${LIMITES.codigo} caracteres.`;
  }
  return null;
}

export function validateMovementInput(input: MovementInput): string | null {
  if (!isUuid(input.articuloId)) return 'El artículo no es válido.';
  if (!MOVIMIENTOS_REGISTRABLES.some((m) => m.value === input.tipo)) return 'Elige el tipo de movimiento.';
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) return 'La versión del artículo no es válida.';
  const cantidad = parseQuantity(input.cantidad);
  if (cantidad === null) return 'La cantidad debe ser un número positivo con hasta 2 decimales.';
  if (input.tipo !== 'AJUSTE' && cantidad === 0) return 'La cantidad debe ser mayor que 0.';
  if (input.tipo === 'TRASLADO' && !isUuid(input.destinoUbicacionId)) return 'Elige el destino del traslado.';
  if (input.destinoUbicacionId && !isUuid(input.destinoUbicacionId)) return 'El destino no es válido.';
  if ((input.externo ?? '').trim().length > LIMITES.externo) return `El texto externo no puede superar ${LIMITES.externo} caracteres.`;
  const observacion = (input.observacion ?? '').trim();
  if (observacion.length > LIMITES.observacion) return `La observación no puede superar ${LIMITES.observacion} caracteres.`;
  if (input.tipo === 'AJUSTE' && !observacion) return 'Indica el motivo del ajuste.';
  if (input.fechaHora && Number.isNaN(new Date(input.fechaHora).getTime())) return 'La fecha no es válida.';
  return null;
}
