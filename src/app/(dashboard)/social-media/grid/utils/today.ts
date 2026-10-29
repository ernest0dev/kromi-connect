/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Caracas. */
export function todayInCaracas(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Suma (o resta) días a una fecha ISO YYYY-MM-DD sin depender de la zona horaria. */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lunes de la semana a la que pertenece la fecha ISO indicada. */
export function mondayOf(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDaysIso(iso, -offset);
}
