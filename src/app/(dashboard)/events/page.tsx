import { redirect } from 'next/navigation';
import { hasPermission, requireUser } from '@/lib/auth/dal';

export default async function EventsIndexPage() {
  await requireUser();
  if (await hasPermission('events.schedule.read')) redirect('/events/calendar');
  redirect('/events/inventory');
}
