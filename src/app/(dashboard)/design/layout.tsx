import { hasPermission, requirePermission } from '@/lib/auth/dal';
import { DesignLayoutClient } from './shell';

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('design.posts.read');
  const canReadInternal = await hasPermission('design.internal.read');
  return <DesignLayoutClient canReadInternal={canReadInternal}>{children}</DesignLayoutClient>;
}
