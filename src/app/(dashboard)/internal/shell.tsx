'use client';

import { ListTodo } from 'lucide-react';
import { useRegisterShellSlots } from '../components/ShellSlot';
import type { NavGroup } from '../components/SocialMediaShell';

export function InternalLayoutClient({ children }: { children: React.ReactNode }) {
  const groups: NavGroup[] = [{ label: 'Interno', items: [
    { href: '/internal/pendientes', label: 'Pendientes', icon: ListTodo },
  ] }];
  useRegisterShellSlots(null, groups);
  return <div className="min-h-full">{children}</div>;
}
