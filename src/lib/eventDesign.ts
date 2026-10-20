export const EVENT_DESIGN_FORMATS = ['DIGITAL', 'IMPRESION'] as const;
export type EventDesignFormat = (typeof EVENT_DESIGN_FORMATS)[number];

export function validateEventDesign(input: {
  requiere_diseno?: unknown; diseno_formatos?: unknown; instrucciones_diseno?: unknown;
  fecha_entrega_diseno?: unknown; inicio?: unknown;
}, today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })) {
  if (input.requiere_diseno !== true) return null;
  const formats = Array.isArray(input.diseno_formatos) ? input.diseno_formatos : [];
  if (!formats.length || formats.some((format) => !EVENT_DESIGN_FORMATS.includes(format as EventDesignFormat))) return 'Selecciona al menos un formato de diseño.';
  if (typeof input.instrucciones_diseno !== 'string' || !input.instrucciones_diseno.trim()) return 'Las instrucciones de diseño son obligatorias.';
  if ((input.instrucciones_diseno as string).trim().length > 4000) return 'Las instrucciones admiten hasta 4000 caracteres.';
  const due = typeof input.fecha_entrega_diseno === 'string' ? input.fecha_entrega_diseno : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return 'Indica una fecha de entrega válida.';
  if (due < today) return 'La fecha de entrega no puede ser anterior a hoy.';
  const eventStart = typeof input.inicio === 'string' ? input.inicio : '';
  if (!eventStart) return 'Asigna una fecha al evento antes de solicitar diseño.';
  const eventDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(eventStart));
  if (due > eventDay) return 'La fecha de entrega no puede ser posterior al día del evento.';
  return null;
}

export function suggestedEventDesignDate(eventStart?: string | null) {
  if (!eventStart) return '';
  const eventDay = eventStart.slice(0, 10);
  const date = new Date(`${eventDay}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 2);
  return date.toISOString().slice(0, 10);
}
