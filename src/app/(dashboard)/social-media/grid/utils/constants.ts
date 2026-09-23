import { FormatoEnum, EstatusEnum } from '@/types';

export const FORMATO_LABEL: Record<FormatoEnum, string> = {
  CARRUSEL: 'Carrusel',
  POST: 'Post',
  REEL: 'Reel',
  STORY: 'Story',
};

export const ESTATUS_ORDEN: EstatusEnum[] = [
  'PENDIENTE_BRIEF',
  'EN_RODAJE',
  'EN_DISENO',
  'EN_REVISION_CM',
  'RECHAZADO_DISENO',
  'PENDIENTE_APROBACION_GERENCIA',
  'APROBADO',
  'PROGRAMADO',
  'PUBLICADO',
];

/**
 * Único eje cromático con significado semántico en la vista: 4 familias
 * (gris = pendiente, azul = en proceso, naranja = requiere atención/
 * rechazo, verde = aprobado o publicado), todas tomadas de las variables
 * de marca en globals.css — no hex sueltos.
 */
export const ESTATUS_STYLE: Record<
  EstatusEnum,
  { label: string; dotVar: string; bgVar: string; textVar: string }
> = {
  PENDIENTE_BRIEF: { label: 'Brief pendiente', dotVar: 'var(--gris)', bgVar: 'var(--hueso)', textVar: 'var(--gris)' },
  EN_RODAJE: { label: 'En rodaje', dotVar: 'var(--azul)', bgVar: 'color-mix(in srgb, var(--azul) 12%, white)', textVar: 'var(--azul-osc)' },
  EN_DISENO: { label: 'En diseño', dotVar: 'var(--azul)', bgVar: 'color-mix(in srgb, var(--azul) 12%, white)', textVar: 'var(--azul-osc)' },
  EN_REVISION_CM: { label: 'En revisión CM', dotVar: 'var(--azul)', bgVar: 'color-mix(in srgb, var(--azul) 12%, white)', textVar: 'var(--azul-osc)' },
  RECHAZADO_DISENO: { label: 'Rechazado', dotVar: 'var(--naranja)', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)', textVar: '#8A4B0C' },
  PENDIENTE_APROBACION_GERENCIA: { label: 'Pendiente gerencia', dotVar: 'var(--naranja)', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)', textVar: '#8A4B0C' },
  APROBADO: { label: 'Aprobado', dotVar: 'var(--verde)', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', textVar: '#256B3A' },
  PROGRAMADO: { label: 'Programado', dotVar: 'var(--verde)', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', textVar: '#256B3A' },
  PUBLICADO: { label: 'Publicado', dotVar: 'var(--verde)', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', textVar: '#256B3A' },
};
