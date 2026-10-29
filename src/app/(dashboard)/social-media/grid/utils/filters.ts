import type { EstatusEnum, FormatoEnum, PublicacionConCuentas } from '@/types';
import { ESTATUS_STYLE } from './constants';
import { QUICK_VIEW_IDS, matchesQuickView } from './quickViews';
import type { QuickViewId } from './quickViews';
import { addDaysIso, mondayOf } from './today';

export type SortKey = 'fecha' | 'etapa' | 'actualizacion' | 'prioridad' | 'titulo';
export type SortDir = 'asc' | 'desc';
export type GroupKey = 'ninguno' | 'dia' | 'semana' | 'campana' | 'estado';
export type DisenoFiltro = 'todos' | 'si' | 'no';
export type RodajeFiltro = 'todos' | 'no' | 'si' | 'PREBO' | 'MANONGO';

export interface GridFilters {
  q: string;
  formato: FormatoEnum | 'TODOS';
  estatus: EstatusEnum[];
  /** '' = todas, 'none' = sin campaña, o el id de la campaña. */
  campana: string;
  /** '' = todos, o el nombre del tema. */
  tema: string;
  /** 'ALL' = todas las cuentas, o el id de la cuenta. */
  cuenta: string;
  diseno: DisenoFiltro;
  rodaje: RodajeFiltro;
  /** Solo piezas que hoy esperan una acción de Social Media. */
  accion: boolean;
  /** Vista rápida (indicadores del header). Ignora el mes activo. */
  vista: QuickViewId | '';
  sort: SortKey;
  dir: SortDir;
  group: GroupKey;
}

export const DEFAULT_FILTERS: GridFilters = {
  q: '',
  formato: 'TODOS',
  estatus: [],
  campana: '',
  tema: '',
  cuenta: 'ALL',
  diseno: 'todos',
  rodaje: 'todos',
  accion: false,
  vista: '',
  sort: 'fecha',
  dir: 'asc',
  group: 'ninguno',
};

/** Orden del flujo; también define el orden de la opción "Etapa del flujo". */
export const ESTATUS_ETAPAS: readonly EstatusEnum[] = [
  'PENDIENTE_BRIEF',
  'EN_RODAJE',
  'SOLICITADO',
  'EN_DISENO',
  'EN_CORRECCION',
  'RECHAZADO_DISENO',
  'EN_REVISION_CM',
  'PENDIENTE_APROBACION_GERENCIA',
  'APROBADO',
  'PROGRAMADO',
  'PUBLICADO',
  'INCOMPLETO',
  'CANCELADO',
];

export const SORT_KEYS: readonly SortKey[] = ['fecha', 'etapa', 'actualizacion', 'prioridad', 'titulo'];
export const GROUP_KEYS: readonly GroupKey[] = ['ninguno', 'dia', 'semana', 'campana', 'estado'];
export const FORMATOS_FILTRO: readonly (FormatoEnum | 'TODOS')[] = ['TODOS', 'CARRUSEL', 'POST', 'REEL', 'STORY'];

export const SORT_LABEL: Record<SortKey, string> = {
  fecha: 'Fecha de publicación',
  etapa: 'Etapa del flujo',
  actualizacion: 'Última actualización',
  prioridad: 'Prioridad',
  titulo: 'Título',
};

export const GROUP_LABEL: Record<GroupKey, string> = {
  ninguno: 'Sin agrupar',
  dia: 'Día',
  semana: 'Semana',
  campana: 'Campaña',
  estado: 'Estado',
};

/** Estados donde Social Media es quien debe mover la pieza. */
const ESTATUS_ACCION_SM: readonly EstatusEnum[] = ['PENDIENTE_BRIEF', 'EN_RODAJE', 'EN_REVISION_CM', 'APROBADO'];

export function needsMyAction(pub: Pick<PublicacionConCuentas, 'estatus' | 'fecha_publicacion'>, today: string): boolean {
  if (ESTATUS_ACCION_SM.includes(pub.estatus)) return true;
  return pub.estatus === 'PROGRAMADO' && pub.fecha_publicacion <= today;
}

/* ---------- URL <-> filtros ---------- */

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseFilters(params: URLSearchParams): GridFilters {
  const estatus = (params.get('estado') || '')
    .split(',')
    .filter((value): value is EstatusEnum => (ESTATUS_ETAPAS as readonly string[]).includes(value));
  return {
    q: (params.get('q') || '').slice(0, 120),
    formato: pick(params.get('formato'), FORMATOS_FILTRO, DEFAULT_FILTERS.formato),
    estatus: [...new Set(estatus)],
    campana: params.get('campana') || '',
    tema: params.get('tema') || '',
    cuenta: params.get('cuenta') || 'ALL',
    diseno: pick(params.get('diseno'), ['todos', 'si', 'no'] as const, 'todos'),
    rodaje: pick(params.get('rodaje'), ['todos', 'no', 'si', 'PREBO', 'MANONGO'] as const, 'todos'),
    accion: params.get('accion') === '1',
    vista: pick<QuickViewId | ''>(params.get('vista'), ['', ...QUICK_VIEW_IDS], ''),
    sort: pick(params.get('orden'), SORT_KEYS, DEFAULT_FILTERS.sort),
    dir: pick(params.get('dir'), ['asc', 'desc'] as const, DEFAULT_FILTERS.dir),
    group: pick(params.get('agrupar'), GROUP_KEYS, DEFAULT_FILTERS.group),
  };
}

/** Escribe en `params` solo lo que difiere de los valores por defecto (URLs cortas). */
export function writeFiltersToParams(filters: GridFilters, params: URLSearchParams): void {
  const setOrDelete = (key: string, value: string, defaultValue: string) => {
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
  };
  setOrDelete('q', filters.q.trim(), '');
  setOrDelete('formato', filters.formato, DEFAULT_FILTERS.formato);
  setOrDelete('estado', filters.estatus.join(','), '');
  setOrDelete('campana', filters.campana, '');
  setOrDelete('tema', filters.tema, '');
  setOrDelete('cuenta', filters.cuenta, DEFAULT_FILTERS.cuenta);
  setOrDelete('diseno', filters.diseno, DEFAULT_FILTERS.diseno);
  setOrDelete('rodaje', filters.rodaje, DEFAULT_FILTERS.rodaje);
  setOrDelete('accion', filters.accion ? '1' : '', '');
  setOrDelete('vista', filters.vista, '');
  setOrDelete('orden', filters.sort, DEFAULT_FILTERS.sort);
  setOrDelete('dir', filters.dir, DEFAULT_FILTERS.dir);
  setOrDelete('agrupar', filters.group, DEFAULT_FILTERS.group);
}

export function hasActiveFilters(filters: GridFilters): boolean {
  return (
    !!filters.q.trim() ||
    filters.formato !== 'TODOS' ||
    filters.estatus.length > 0 ||
    !!filters.campana ||
    !!filters.tema ||
    filters.cuenta !== 'ALL' ||
    filters.diseno !== 'todos' ||
    filters.rodaje !== 'todos' ||
    filters.accion ||
    !!filters.vista
  );
}

/* ---------- Filtrado ---------- */

export interface FilterContext {
  today: string;
  campanaNombrePorId: Map<string, string>;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function applyFilters(pubs: PublicacionConCuentas[], filters: GridFilters, ctx: FilterContext): PublicacionConCuentas[] {
  const query = normalize(filters.q.trim());
  return pubs.filter((pub) => {
    if (filters.formato !== 'TODOS' && pub.formato !== filters.formato) return false;
    if (filters.estatus.length && !filters.estatus.includes(pub.estatus)) return false;
    if (filters.campana === 'none' && pub.campana_id) return false;
    if (filters.campana && filters.campana !== 'none' && pub.campana_id !== filters.campana) return false;
    if (filters.tema && !(pub.linea_contenido || '').split(',').some((name) => name.trim() === filters.tema)) return false;
    if (filters.cuenta !== 'ALL' && !pub.social_account_ids.includes(filters.cuenta)) return false;
    if (filters.diseno === 'si' && !pub.requiere_diseno) return false;
    if (filters.diseno === 'no' && pub.requiere_diseno) return false;
    if (filters.rodaje === 'si' && !pub.requiere_rodaje) return false;
    if (filters.rodaje === 'no' && pub.requiere_rodaje) return false;
    if ((filters.rodaje === 'PREBO' || filters.rodaje === 'MANONGO') && !(pub.requiere_rodaje && pub.sedes?.includes(filters.rodaje))) return false;
    if (filters.accion && !needsMyAction(pub, ctx.today)) return false;
    if (filters.vista && !matchesQuickView(pub, filters.vista, ctx.today)) return false;
    if (query) {
      const campana = pub.campana_id ? ctx.campanaNombrePorId.get(pub.campana_id) || '' : '';
      if (!normalize(`${pub.titulo} ${pub.linea_contenido || ''} ${campana}`).includes(query)) return false;
    }
    return true;
  });
}

/* ---------- Orden ---------- */

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function compareByDate(a: PublicacionConCuentas, b: PublicacionConCuentas): number {
  return (
    compareText(a.fecha_publicacion, b.fecha_publicacion) ||
    compareText(a.hora_publicacion ?? '99:99', b.hora_publicacion ?? '99:99') ||
    compareText(a.created_at, b.created_at) ||
    compareText(a.id, b.id)
  );
}

const etapaRank = (pub: PublicacionConCuentas) => {
  const index = ESTATUS_ETAPAS.indexOf(pub.estatus);
  return index === -1 ? ESTATUS_ETAPAS.length : index;
};

/** Orden estable: ante empates siempre desempata por fecha, hora y creación. */
export function sortPublicaciones(pubs: PublicacionConCuentas[], sort: SortKey, dir: SortDir): PublicacionConCuentas[] {
  const sign = dir === 'desc' ? -1 : 1;
  const primary = (a: PublicacionConCuentas, b: PublicacionConCuentas): number => {
    switch (sort) {
      case 'fecha':
        return compareByDate(a, b);
      case 'etapa':
        return etapaRank(a) - etapaRank(b);
      case 'actualizacion':
        return compareText(a.updated_at, b.updated_at);
      case 'prioridad':
        return a.prioridad - b.prioridad;
      case 'titulo':
        return a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' });
    }
  };
  return [...pubs].sort((a, b) => sign * primary(a, b) || compareByDate(a, b));
}

/* ---------- Agrupación ---------- */

export interface PublicacionGroup {
  key: string;
  label: string;
  items: PublicacionConCuentas[];
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function formatDayLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return capitalize(
    new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date),
  );
}

function formatWeekLabel(mondayIso: string): string {
  const short = (iso: string) =>
    new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .format(new Date(`${iso}T12:00:00Z`))
      .replace(/\./g, '');
  return `Semana del ${short(mondayIso)} al ${short(addDaysIso(mondayIso, 6))}`;
}

export function groupPublicaciones(
  sorted: PublicacionConCuentas[],
  group: GroupKey,
  options: { campanaNombrePorId: Map<string, string>; sort: SortKey; dir: SortDir },
): PublicacionGroup[] {
  if (group === 'ninguno') return sorted.length ? [{ key: 'all', label: '', items: sorted }] : [];

  const buckets = new Map<string, PublicacionGroup>();
  const keyAndLabel = (pub: PublicacionConCuentas): [string, string] => {
    switch (group) {
      case 'dia':
        return [pub.fecha_publicacion, formatDayLabel(pub.fecha_publicacion)];
      case 'semana': {
        const monday = mondayOf(pub.fecha_publicacion);
        return [monday, formatWeekLabel(monday)];
      }
      case 'campana': {
        const name = pub.campana_id ? options.campanaNombrePorId.get(pub.campana_id) : undefined;
        return pub.campana_id ? [pub.campana_id, name || 'Campaña vinculada'] : ['none', 'Sin campaña'];
      }
      case 'estado':
        return [pub.estatus, ESTATUS_STYLE[pub.estatus]?.label || pub.estatus];
    }
  };

  for (const pub of sorted) {
    const [key, label] = keyAndLabel(pub);
    const bucket = buckets.get(key) || { key, label, items: [] };
    bucket.items.push(pub);
    buckets.set(key, bucket);
  }

  const groups = [...buckets.values()];
  const chronologicalSign = options.sort === 'fecha' && options.dir === 'desc' ? -1 : 1;
  if (group === 'dia' || group === 'semana') groups.sort((a, b) => chronologicalSign * compareText(a.key, b.key));
  if (group === 'campana') {
    groups.sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })));
  }
  if (group === 'estado') groups.sort((a, b) => ESTATUS_ETAPAS.indexOf(a.key as EstatusEnum) - ESTATUS_ETAPAS.indexOf(b.key as EstatusEnum));
  return groups;
}
