import { requirePermission } from '@/lib/auth/dal';
import { DesignLayoutClient } from './shell';

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('design.requests.read');
  return <DesignLayoutClient>{children}</DesignLayoutClient>;
}
