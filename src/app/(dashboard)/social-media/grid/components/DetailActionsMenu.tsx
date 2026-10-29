'use client';

import { useState } from 'react';
import { Archive, Ban, MoreHorizontal } from 'lucide-react';

interface Props {
  onArchive: () => void;
  /** Se omite cuando la publicación ya está cancelada. */
  onCancel?: () => void;
  disabled?: boolean;
  /** Variante pequeña para tarjetas. */
  compact?: boolean;
  /** Hacia dónde se despliega; en el pie de una tarjeta conviene "up". */
  placement?: 'down' | 'up';
}

/** Acciones secundarias/destructivas, agrupadas para no competir con la acción principal. */
export function DetailActionsMenu({ onArchive, onCancel, disabled = false, compact = false, placement = 'down' }: Props) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más acciones"
        title="Más acciones"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50 ${compact ? 'p-1.5' : 'px-3 py-2 text-xs'}`}
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onMouseDown={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute right-0 z-20 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${placement === 'up' ? 'bottom-full mb-1' : 'mt-1'}`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={run(onArchive)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Archive size={13} aria-hidden="true" /> Mover al Archivo
            </button>
            {onCancel && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onCancel)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <Ban size={13} aria-hidden="true" /> Cancelar publicación
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
