import { ScheduleView } from '../../ScheduleView';
import { loadSchedule, type EventSearchParams } from '../../loadSchedule';

export const metadata = { title: 'Listado de eventos' };
export default async function EventsListPage({ searchParams }: { searchParams: EventSearchParams }) {
  const data = await loadSchedule(searchParams, 'list');
  return <ScheduleView {...data} mode="list" />;
}
