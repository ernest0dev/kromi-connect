import { requirePermission } from '@/lib/auth/dal';
import { EventsLayoutClient } from './shell';

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('events.inventory.read');
  return <EventsLayoutClient>{children}</EventsLayoutClient>;
}
