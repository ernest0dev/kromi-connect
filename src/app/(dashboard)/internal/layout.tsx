import { notFound } from 'next/navigation';
import { requireUser, hasPermission } from '@/lib/auth/dal';
import { InternalLayoutClient } from './shell';

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [tasks, inventory] = await Promise.all([
    hasPermission('internal.store-tasks.read'),
    hasPermission('events.inventory.read'),
  ]);
  if (!tasks) notFound();
  return <InternalLayoutClient inventory={inventory}>{children}</InternalLayoutClient>;
}
