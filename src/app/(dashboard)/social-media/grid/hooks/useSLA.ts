'use client';

import { Publicacion } from '@/types';
import { calcularSlaState, SLA_META } from '../utils/sla';
import type { SlaState } from '../utils/sla';

export function useSLA() {
  const calcularPeorSlaDelDia = (publicaciones: Publicacion[]): SlaState | null => {
    const estadosSla = publicaciones.map((p) => calcularSlaState(p.fecha_limite_brief));
    const peorEstado: SlaState | null = estadosSla.includes('vencido')
      ? 'vencido'
      : estadosSla.includes('hoy')
      ? 'hoy'
      : estadosSla.includes('proximo')
      ? 'proximo'
      : null;
    return peorEstado;
  };

  return {
    calcularSlaState,
    SLA_META,
    calcularPeorSlaDelDia,
  };
}

export type { SlaState };
