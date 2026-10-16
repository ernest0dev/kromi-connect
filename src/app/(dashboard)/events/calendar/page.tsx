import { ScheduleView } from '../ScheduleView';
import { loadSchedule, type EventSearchParams } from '../loadSchedule';

export const metadata = { title: 'Programación de eventos' };
export default async function EventsCalendarPage({ searchParams }: { searchParams: EventSearchParams }) {
  const raw = await searchParams;
  const week = (Array.isArray(raw.vista) ? raw.vista[0] : raw.vista) === 'semana';
  const data = await loadSchedule(searchParams, week ? 'week' : 'month');
  return <ScheduleView {...data} mode={week ? 'week' : 'month'} />;
}
