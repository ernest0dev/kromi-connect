'use client';

import { useMemo } from 'react';
import { Publicacion } from '@/types';
import { generateCalendarDays, getTodayIso, CalendarDay } from '../utils/date';
import { GridCalendarProps } from '../types/grid';
import { GridCell } from './GridCell';

export function GridCalendar({
  currentDate,
  publicaciones,
  isPending,
  onTicketClick,
  onDragStart,
  onDragOver,
  onDrop,
}: GridCalendarProps) {
  const calendarDays = useMemo(
    () => generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const hoyStr = useMemo(() => getTodayIso(new Date()), []);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
    >
      <div
        className="grid grid-cols-7 border-b text-center py-2.5 text-xs font-semibold"
        style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
      >
        <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
      </div>

      <div className={`grid grid-cols-7 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
        {calendarDays.map((cell: CalendarDay, idx) => {
          if (!cell)
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[110px] border-b border-r"
                style={{ background: 'var(--hueso)', borderColor: 'var(--borde)' }}
              />
            );

          const itemsDelDia = publicaciones.filter(
            (p: Publicacion) => p.fecha_publicacion === cell.dateStr
          );
          const esHoy = cell.dateStr === hoyStr;

          return (
            <GridCell
              key={cell.dateStr}
              day={cell.day}
              dateStr={cell.dateStr}
              isToday={esHoy}
              publicaciones={itemsDelDia}
              onTicketClick={onTicketClick}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          );
        })}
      </div>
    </div>
  );
}
