'use client';

import { CalendarDays, Package } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

export function EventsLayoutClient({ children, inventory, schedule }: { children: React.ReactNode; inventory: boolean; schedule: boolean }) {
  const navGroups: NavGroup[] = [{ label: 'Eventos', items: [
    ...(schedule ? [
      { href: '/events/calendar', label: 'Calendario', icon: CalendarDays },
    ] : []),
    ...(inventory ? [{ href: '/events/inventory', label: 'Inventario', icon: Package }] : []),
  ] }];
  useRegisterShellSlots(null, navGroups);
  return <div className="min-h-full">{children}</div>;
}
