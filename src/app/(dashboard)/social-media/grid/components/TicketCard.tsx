'use client';

import { TicketCardProps } from '../types/grid';
import { ESTATUS_STYLE } from '../utils/constants';

export function TicketCard({ publicacion, onClick, onDragStart }: TicketCardProps) {
  const estatusStyle = ESTATUS_STYLE[publicacion.estatus];
  return (
    <div
      key={publicacion.id}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] font-medium truncate cursor-pointer active:cursor-grabbing"
      style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar }}
      title={publicacion.titulo}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: estatusStyle.dotVar }}
      />
      <span className="truncate">{publicacion.titulo}</span>
    </div>
  );
}
