'use client';

import { TicketCardProps } from '../types/grid';
import { ESTATUS_STYLE, FORMATO_LABEL_UPPER } from '../utils/constants';

export function TicketCard({ publicacion, onClick, onDragStart }: TicketCardProps) {
  const estatusStyle = ESTATUS_STYLE[publicacion.estatus];
  const formato = FORMATO_LABEL_UPPER[publicacion.formato];
  return (
    <div
      key={publicacion.id}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${publicacion.titulo} · ${formato}`}
      className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] font-medium cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
      style={{
        background: estatusStyle.bgVar,
        color: estatusStyle.textVar,
        borderLeft: `3px solid ${estatusStyle.dotVar}`,
      }}
      title={`${publicacion.titulo} · ${formato}`}
    >
      <span className="truncate">
        {publicacion.titulo}{' '}
        <span className="opacity-70">· {formato}</span>
      </span>
    </div>
  );
}
