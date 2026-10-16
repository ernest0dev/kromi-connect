import { ScheduleView } from '../../ScheduleView';
import { loadSchedule, type EventSearchParams } from '../../loadSchedule';

export const metadata = { title: 'Archivo de eventos' };
export default async function EventsArchivePage({ searchParams }: { searchParams: EventSearchParams }) {
  const data = await loadSchedule(searchParams, 'archive');
  return <ScheduleView {...data} mode="archive" />;
}
