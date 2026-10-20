import type { EventoEstatus, EventoIndicadores, EventoTipo, EventoOrigen } from '@/types';
import { validateEventDesign } from '@/lib/eventDesign';

export const EVENTOS_RUTA = '/events';
export const EVENTO_ESTATUS: { value: EventoEstatus; label: string }[] = [
  { value: 'EN_PLANIFICACION', label: 'En planificación' }, { value: 'PROGRAMADO', label: 'Programado' },
  { value: 'EN_CURSO', label: 'En curso' }, { value: 'TERMINADO', label: 'Terminado' }, { value: 'CANCELADO', label: 'Cancelado' },
];
export const EVENTO_TIPOS: { value: EventoTipo; label: string }[] = [
  { value: 'DEGUSTACION', label: 'Degustación' }, { value: 'IMPULSO', label: 'Impulso' }, { value: 'OTRO', label: 'Otro' },
];
export const EVENTO_ORIGENES: { value: EventoOrigen; label: string }[] = [
  { value: 'PROPIO', label: 'Propio' }, { value: 'PROVEEDOR', label: 'Proveedor' },
];
export const EVENTO_ESTATUS_LABEL: Record<EventoEstatus, string> = Object.fromEntries(EVENTO_ESTATUS.map((x) => [x.value, x.label])) as Record<EventoEstatus, string>;
export const EVENTO_INDICADORES: { key: keyof EventoIndicadores; label: string }[] = [
  { key: 'proximo', label: 'Próximo' }, { key: 'fecha_vencida', label: 'Fecha vencida' },
  { key: 'incompleto', label: 'Incompleto' }, { key: 'materiales_sin_declarar', label: 'Materiales sin declarar' },
  { key: 'cierre_pendiente', label: 'Cierre pendiente' },
];
export const TZ_EVENTOS = 'America/Caracas';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
export function parseEventQuery(sp: Record<string, string | string[] | undefined>) {
  const date = first(sp.fecha);
  const status = first(sp.estatus);
  const type = first(sp.tipo);
  const origin = first(sp.origen);
  const view = first(sp.vista);
  return {
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : `${getCaracasDay(new Date().toISOString()).slice(0, 7)}-01`,
    sede: first(sp.sede), estatus: EVENTO_ESTATUS.some((x) => x.value === status) ? status as EventoEstatus : '',
    tipo: EVENTO_TIPOS.some((x) => x.value === type) ? type as EventoTipo : '',
    origen: EVENTO_ORIGENES.some((x) => x.value === origin) ? origin as EventoOrigen : '',
    q: first(sp.q).trim().slice(0, 100), page: Math.max(1, Math.min(10000, Number(first(sp.page)) || 1)),
    vista: view === 'semana' ? 'semana' as const : 'mes' as const,
  };
}

export function toCaracasInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_EVENTOS, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Converts a local date/time input to an ISO timestamp using the UTC-4 Caracas offset. */
export function caracasInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00-04:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatEventDate(iso: string | null, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-VE', { ...options, timeZone: TZ_EVENTOS }).format(new Date(iso));
}

export function getCaracasDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_EVENTOS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function startOfCaracasMonth(date: string) {
  const [y, m] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 4));
}

export function getCalendarRange(month: string, week = false) {
  const start = startOfCaracasMonth(month);
  if (week) {
    const [y, m, d] = month.slice(0, 10).split('-').map(Number);
    const local = new Date(Date.UTC(y, m - 1, d || 1, 4));
    const dow = (local.getUTCDay() + 6) % 7;
    local.setUTCDate(local.getUTCDate() - dow);
    return { from: local, to: new Date(local.getTime() + 7 * 86400000), days: 7 };
  }
  const offset = (start.getUTCDay() + 6) % 7;
  const from = new Date(start.getTime() - offset * 86400000);
  const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 4));
  const endDow = (last.getUTCDay() + 6) % 7;
  return { from, to: new Date(last.getTime() + (6 - endDow + 1) * 86400000), days: Math.ceil((last.getTime() + (6 - endDow + 1) * 86400000 - from.getTime()) / 86400000) };
}

export function validateEventInput(input: Record<string, unknown>): string | null {
  const name = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  if (!name || name.length > 160) return 'El nombre debe tener entre 1 y 160 caracteres.';
  if (!EVENTO_TIPOS.some((x) => x.value === input.tipo)) return 'Selecciona el tipo del evento.';
  if (input.tipo === 'OTRO' && !(typeof input.tipo_otro === 'string' && input.tipo_otro.trim())) return 'Especifica el tipo de evento.';
  if (!EVENTO_ORIGENES.some((x) => x.value === input.origen)) return 'Selecciona el origen del evento.';
  if (input.origen === 'PROVEEDOR' && !(typeof input.proveedor_nombre === 'string' && input.proveedor_nombre.trim())) return 'Escribe el nombre del proveedor.';
  const sedes = input.sedes;
  if (!Array.isArray(sedes) || sedes.length === 0 || sedes.some((s) => !s || typeof s.sede_id !== 'string')) return 'Selecciona al menos una tienda.';
  const ini = typeof input.inicio === 'string' ? Date.parse(input.inicio) : NaN;
  const fin = typeof input.fin === 'string' ? Date.parse(input.fin) : NaN;
  if (Number.isNaN(ini) !== Number.isNaN(fin)) return 'Completa el inicio y el fin, o deja ambas fechas vacías.';
  if (!Number.isNaN(ini) && fin <= ini) return 'El fin debe ser posterior al inicio.';
  for (const key of ['descripcion', 'patrocinadores', 'materiales']) if (typeof input[key] === 'string' && input[key].length > 2000) return `El campo ${key} no puede superar 2000 caracteres.`;
  const designError = validateEventDesign({ ...input, inicio: input.inicio });
  if (designError) return designError;
  return null;
}
