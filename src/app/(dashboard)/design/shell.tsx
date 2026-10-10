'use client';

import { usePathname } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

const navGroups: NavGroup[] = [{ label: 'Diseño', items: [{ href: '/design/publications', label: 'Solicitudes', icon: ClipboardList }] }];

export function DesignLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useRegisterShellSlots(null, navGroups);
  return <div data-design-route={pathname} className="min-h-full">{children}</div>;
}
