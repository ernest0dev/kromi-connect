import { hasPermission, requireUser } from '@/lib/auth/dal';
import { notFound } from 'next/navigation';
import { EventsLayoutClient } from './shell';

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [inventory, schedule] = await Promise.all([
    hasPermission('events.inventory.read'),
    hasPermission('events.schedule.read'),
  ]);
  if (!inventory && !schedule) notFound();
  return <EventsLayoutClient>{children}</EventsLayoutClient>;
}
