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
      className="min-h-[104px] p-[7px] border-b border-r transition-colors flex flex-col justify-between"
      style={{
        background: isToday ? 'color-mix(in srgb, var(--azul) 6%, white)' : 'var(--papel)',
        borderColor: isToday ? 'color-mix(in srgb, var(--azul) 28%, white)' : 'var(--borde)',
      }}
    >
      <div
        className="flex items-center justify-between gap-1 mb-1.5"
        aria-current={isToday ? 'date' : undefined}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`text-xs font-semibold ${isToday ? 'h-[22px] w-[22px] rounded-full grid place-items-center text-[11px]' : ''}`}
            style={{
              color: isToday ? '#fff' : 'var(--gris)',
              background: isToday ? 'var(--azul)' : 'transparent',
            }}
          >
            {day}
          </span>
          {isToday && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--azul)', color: '#fff' }}
            >
              HOY
            </span>
          )}
        </span>
        {peorEstado && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: SLA_META[peorEstado].dotVar }}
            title={`SLA del día: ${SLA_META[peorEstado].label}`}
            aria-label={`Publicaciones de este día: ${SLA_META[peorEstado].label}`}
            role="img"
          />
        )}
      </div>
      {peorEstado && (
        <span
          className="sr-only"
          aria-live="polite"
        >{`Indicador SLA: ${SLA_META[peorEstado].label}`}</span>
      )}

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
