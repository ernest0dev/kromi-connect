'use client';

import { GridCellProps } from '../types/grid';
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
  return (
    <div
      key={dateStr}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, dateStr)}
      className="min-h-[104px] min-w-0 border-b border-r p-[7px] transition-colors"
      style={{
        background: isToday ? 'var(--superficie-dia-actual)' : 'var(--papel)',
        borderColor: 'var(--borde-ui)',
      }}
    >
      <div
        className="mb-1 flex h-[21px] items-center justify-between"
        aria-current={isToday ? 'date' : undefined}
      >
        <span
          className={`text-[11px] font-semibold ${isToday ? 'grid h-[22px] w-[22px] place-items-center rounded-full' : ''}`}
          style={{
            color: isToday ? '#fff' : 'var(--texto-calendario)',
            background: isToday ? 'var(--azul)' : 'transparent',
          }}
        >
          {day}
        </span>
        {isToday && <span className="text-[9px] font-bold" style={{ color: 'var(--azul)' }}>HOY</span>}
      </div>

      <div className="space-y-1">
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
