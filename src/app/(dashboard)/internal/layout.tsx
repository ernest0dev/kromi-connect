import { notFound } from 'next/navigation';
import { requireUser, hasPermission } from '@/lib/auth/dal';
import { InternalLayoutClient } from './shell';

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  if (!(await hasPermission('internal.store-tasks.read'))) notFound();
  return <InternalLayoutClient>{children}</InternalLayoutClient>;
}
