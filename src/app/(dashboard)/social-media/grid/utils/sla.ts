export type SlaState = 'vencido' | 'hoy' | 'proximo' | 'ok' | 'sin-fecha';

export function calcularSlaState(fechaLimiteBrief: string | null | undefined): SlaState {
  if (!fechaLimiteBrief) return 'sin-fecha';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimiteBrief + 'T00:00:00');
  const diffDias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);

  if (diffDias < 0) return 'vencido';
  if (diffDias === 0) return 'hoy';
  if (diffDias <= 2) return 'proximo';
  return 'ok';
}

export const SLA_META: Record<SlaState, { label: string; textVar: string; bgVar: string; dotVar: string }> = {
  vencido: { label: 'Brief vencido', textVar: '#A32D2D', bgVar: '#FCEBEB', dotVar: '#C52018' },
  hoy: { label: 'Brief vence hoy', textVar: '#8A4B0C', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)', dotVar: 'var(--naranja)' },
  proximo: { label: 'Brief próximo a vencer', textVar: '#8A4B0C', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)', dotVar: 'var(--naranja)' },
  ok: { label: 'En plazo', textVar: '#256B3A', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', dotVar: 'var(--verde)' },
  'sin-fecha': { label: 'Sin fecha límite', textVar: 'var(--gris)', bgVar: 'var(--hueso)', dotVar: 'var(--gris)' },
};
