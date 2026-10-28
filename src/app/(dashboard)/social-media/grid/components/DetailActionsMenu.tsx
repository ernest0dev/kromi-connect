'use client';

import { useState } from 'react';
import { Archive, Ban, MoreHorizontal } from 'lucide-react';

interface Props {
  onArchive: () => void;
  /** Se omite cuando la publicación ya está cancelada. */
  onCancel?: () => void;
}

/** Acciones secundarias/destructivas del detalle, agrupadas para no competir con Editar. */
export function DetailActionsMenu({ onArchive, onCancel }: Props) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más acciones"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onMouseDown={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
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
