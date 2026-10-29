import type { EstatusEnum, FormatoEnum } from '@/types';
import { addDaysIso } from './today';

/** Vistas rápidas: las mismas reglas alimentan los indicadores del header y el filtro de la lista. */
export type QuickViewId = 'brief-vencido' | 'por-revisar' | 'por-aprobar' | 'hoy' | 'sin-copy';

export const QUICK_VIEW_IDS: readonly QuickViewId[] = ['brief-vencido', 'por-revisar', 'por-aprobar', 'hoy', 'sin-copy'];

export const QUICK_VIEW_LABEL: Record<QuickViewId, string> = {
  'brief-vencido': 'Briefs vencidos o que vencen hoy',
  'por-revisar': 'Entregas de Diseño por revisar',
  'por-aprobar': 'Por aprobar',
  hoy: 'Para publicar hoy',
  'sin-copy': 'Sin copy · próximos 7 días',
};

export interface QuickViewRow {
  estatus: EstatusEnum;
  requiere_diseno: boolean;
  fecha_limite_brief: string | null;
  fecha_publicacion: string;
  formato: FormatoEnum;
  hook_texto: string | null;
  body_texto: string | null;
  cta_texto: string | null;
}

export interface GridIndicators {
  briefVencidos: number;
  briefHoy: number;
  porRevisar: number;
  porAprobar: number;
  hoySinPublicar: number;
  sinCopy7d: number;
}

const ESTATUS_FINALES: readonly EstatusEnum[] = ['PUBLICADO', 'CANCELADO'];
/** Mientras la pieza está en estos estados el brief todavía es responsabilidad de Social Media. */
const ESTATUS_BRIEF_ABIERTO: readonly EstatusEnum[] = ['PENDIENTE_BRIEF', 'EN_RODAJE'];

export function hasCopy(row: Pick<QuickViewRow, 'hook_texto' | 'body_texto' | 'cta_texto'>): boolean {
  return [row.hook_texto, row.body_texto, row.cta_texto].some((text) => !!text?.trim());
}

export function matchesQuickView(row: QuickViewRow, view: QuickViewId, today: string): boolean {
  if (ESTATUS_FINALES.includes(row.estatus)) return false;
  switch (view) {
    case 'brief-vencido':
      return (
        row.requiere_diseno &&
        ESTATUS_BRIEF_ABIERTO.includes(row.estatus) &&
        !!row.fecha_limite_brief &&
        row.fecha_limite_brief <= today
      );
    case 'por-revisar':
      return row.estatus === 'EN_REVISION_CM';
    case 'por-aprobar':
      return row.estatus === 'PENDIENTE_APROBACION_GERENCIA';
    case 'hoy':
      return row.fecha_publicacion === today;
    case 'sin-copy':
      return (
        row.formato !== 'STORY' &&
        row.fecha_publicacion >= today &&
        row.fecha_publicacion <= addDaysIso(today, 7) &&
        !hasCopy(row)
      );
  }
}

export function computeIndicators(rows: QuickViewRow[], today: string): GridIndicators {
  const count = (view: QuickViewId, extra?: (row: QuickViewRow) => boolean) =>
    rows.filter((row) => matchesQuickView(row, view, today) && (!extra || extra(row))).length;
  return {
    briefVencidos: count('brief-vencido', (row) => (row.fecha_limite_brief || '') < today),
    briefHoy: count('brief-vencido', (row) => row.fecha_limite_brief === today),
    porRevisar: count('por-revisar'),
    porAprobar: count('por-aprobar'),
    hoySinPublicar: count('hoy'),
    sinCopy7d: count('sin-copy'),
  };
}
