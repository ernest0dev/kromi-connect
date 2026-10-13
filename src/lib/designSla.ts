const TIME_ZONE = 'America/Caracas';

function dateKey(value: string | null | undefined) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function getCaracasToday(now = new Date()) {
  return dateKey(now.toISOString())!;
}

export function formatDesignDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const key = dateKey(value);
  if (!key) return '—';
  return new Intl.DateTimeFormat('es-VE', { ...options, timeZone: TIME_ZONE }).format(new Date(`${key}T12:00:00Z`));
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function getDesignDueLabel(estimate: string | null | undefined, today: string) {
  const due = dateKey(estimate);
  if (!due) return 'Sin fecha estimada';
  const days = daysBetween(today, due);
  if (days < 0) return `Vencida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

export function getDesignSlaOutcome(estimate: string | null | undefined, delivered: string | null | undefined) {
  const due = dateKey(estimate);
  const actual = dateKey(delivered);
  if (!due || !actual) return '—';
  const lateDays = daysBetween(due, actual);
  if (lateDays <= 0) return 'A tiempo';
  return `${lateDays} ${lateDays === 1 ? 'día' : 'días'} de retraso`;
}

export function getDesignDueTone(estimate: string | null | undefined, today: string) {
  const due = dateKey(estimate);
  if (!due) return 'neutral' as const;
  const days = daysBetween(today, due);
  if (days < 0) return 'late' as const;
  if (days <= 1) return 'soon' as const;
  return 'neutral' as const;
}

export function formatSocialPlatform(value: string) {
  const names: Record<string, string> = {
    INSTAGRAM: 'Instagram',
    FACEBOOK: 'Facebook',
    TIKTOK: 'TikTok',
    YOUTUBE: 'YouTube',
    LINKEDIN: 'LinkedIn',
    X: 'X',
  };
  return names[value] || value.toLowerCase().replaceAll('_', ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
