'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  activeCount: number;
  children: ReactNode;
}

/** Botón con panel flotante; se cierra con clic fuera o con Escape. */
export function FilterPopover({ label, activeCount, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="ui-control flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
        style={activeCount > 0 ? { borderColor: 'var(--azul)', color: 'var(--azul-osc)' } : undefined}
      >
        {label}
        {activeCount > 0 && (
          <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--azul)' }}>
            {activeCount}
          </span>
        )}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onMouseDown={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 min-w-[250px] space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
