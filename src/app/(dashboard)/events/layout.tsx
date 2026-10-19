import { hasPermission, requireUser } from '@/lib/auth/dal';
import { notFound } from 'next/navigation';
import { EventsLayoutClient } from './shell';

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [inventory, schedule, internalTasks] = await Promise.all([
    hasPermission('events.inventory.read'),
    hasPermission('events.schedule.read'),
    hasPermission('internal.store-tasks.read'),
  ]);
  if (!inventory && !schedule) notFound();
  return <EventsLayoutClient inventory={inventory} schedule={schedule} internalTasks={internalTasks}>{children}</EventsLayoutClient>;
}
