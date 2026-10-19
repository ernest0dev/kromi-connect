'use client';

import { usePathname } from 'next/navigation';
import { ClipboardList, ListTodo } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

export function DesignLayoutClient({ children, canReadInternal }: { children: React.ReactNode; canReadInternal: boolean }) {
  const pathname = usePathname();
  const navGroups: NavGroup[] = [{ label: 'Diseño', items: [
    { href: '/design/publications', label: 'Solicitudes', icon: ClipboardList, exact: true },
    ...(canReadInternal ? [{ href: '/design/internal', label: 'Pendientes del Interno', icon: ListTodo, exact: true }] : []),
  ] }];
  useRegisterShellSlots(null, navGroups);
  return <div data-design-route={pathname} className="min-h-full">{children}</div>;
}
