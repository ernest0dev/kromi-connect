'use client';

import { GridCellProps } from '../types/grid';
import { useSLA } from '../hooks/useSLA';
import { TicketCard } from './TicketCard';

export function GridCell({
  day,
  dateStr,
  isToday,
  publicaciones,
  onTicketClick,
  onDragStart,
  onDragOver,
  onDrop,
}: GridCellProps) {
  const { calcularPeorSlaDelDia, SLA_META } = useSLA();
  const peorEstado = calcularPeorSlaDelDia(publicaciones);

  return (
    <div
      key={dateStr}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, dateStr)}
      className="min-h-[110px] p-2 border-b border-r transition-colors flex flex-col justify-between"
      style={{
        background: isToday ? 'color-mix(in srgb, var(--azul) 8%, white)' : 'var(--papel)',
        borderColor: 'var(--borde)',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-xs font-semibold"
          style={{ color: isToday ? 'var(--azul)' : 'var(--gris)' }}
        >
          {day}
        </span>
        {peorEstado && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: SLA_META[peorEstado].textVar }}
            title={SLA_META[peorEstado].label}
          />
        )}
      </div>

      <div className="space-y-1 flex-1 overflow-y-auto max-h-[86px]">
        {publicaciones.map((pub) => (
          <TicketCard
            key={pub.id}
            publicacion={pub}
            onClick={() => onTicketClick(pub.id)}
            onDragStart={(e) => onDragStart(e, pub.id)}
          />
        ))}
      </div>
    </div>
  );
}
