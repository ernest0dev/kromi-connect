export type CalendarDay = { day: number; dateStr: string } | null;

export function getMonthName(date: Date): string {
  return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
}

export function getTodayIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function generateCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startingDay = firstDay.getDay() - 1;
  if (startingDay === -1) startingDay = 6;

  const days: CalendarDay[] = [];
  for (let i = 0; i < startingDay; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({ day, dateStr });
  }
  return days;
}

/** Mes activo en la URL: `?mes=2026-11`. */
export function parseMonthParam(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
}

export function formatMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
