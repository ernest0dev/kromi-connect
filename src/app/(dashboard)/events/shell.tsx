'use client';

import { CalendarDays, ListTodo, Package } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

export function EventsLayoutClient({ children, inventory, schedule, internalTasks = false }: { children: React.ReactNode; inventory: boolean; schedule: boolean; internalTasks?: boolean }) {
  const navGroups: NavGroup[] = [{ label: 'Eventos', items: [
    ...(schedule ? [
      { href: '/events/calendar', label: 'Calendario', icon: CalendarDays },
    ] : []),
    ...(inventory ? [{ href: '/events/inventory', label: 'Inventario', icon: Package }] : []),
  ] },
  ...(internalTasks ? [{ label: 'Interno', items: [{ href: '/internal/pendientes', label: 'Pendientes', icon: ListTodo }] }] : []),
  ];
  useRegisterShellSlots(null, navGroups);
  return <div className="min-h-full">{children}</div>;
}
