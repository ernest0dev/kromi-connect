'use client';

import { ListTodo, Package } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

export function InternalLayoutClient({ children, inventory }: { children: React.ReactNode; inventory: boolean }) {
  const groups: NavGroup[] = [
    { label: 'Interno', items: [{ href: '/internal/pendientes', label: 'Pendientes', icon: ListTodo }] },
    ...(inventory ? [{ label: 'Eventos', items: [{ href: '/events/inventory', label: 'Inventario', icon: Package }] }] : []),
  ];
  useRegisterShellSlots(null, groups);
  return <div className="min-h-full">{children}</div>;
}
