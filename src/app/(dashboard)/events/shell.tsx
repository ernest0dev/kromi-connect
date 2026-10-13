'use client';

import { Package } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

const navGroups: NavGroup[] = [
  { label: 'Eventos', items: [{ href: '/events/inventory', label: 'Inventario', icon: Package }] },
];

export function EventsLayoutClient({ children }: { children: React.ReactNode }) {
  useRegisterShellSlots(null, navGroups);
  return <div className="min-h-full">{children}</div>;
}
