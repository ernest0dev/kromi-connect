'use client';

import { useRegisterShellSlots } from '../components/ShellSlot';

export function EventsLayoutClient({ children }: { children: React.ReactNode }) {
  useRegisterShellSlots(null);
  return <div className="min-h-full">{children}</div>;
}
