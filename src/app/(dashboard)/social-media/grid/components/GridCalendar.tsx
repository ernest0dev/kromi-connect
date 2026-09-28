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
    <section
      aria-label="Calendario mensual"
      className="ui-card overflow-hidden"

    >
      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-7 min-w-[740px] border-b text-left text-[10px] font-bold uppercase tracking-[.05em]"
          style={{ background: 'var(--superficie-suave)', borderColor: 'var(--borde-ui)', color: 'var(--gris)' }}
        >
          <div className="border-r border-[var(--borde-ui)] px-[11px] py-[9px]">Lun</div>
          <div className="border-r border-[var(--borde-ui)] px-[11px] py-[9px]">Mar</div>
          <div className="border-r border-[var(--borde-ui)] px-[11px] py-[9px]">Mié</div>
          <div className="border-r border-[var(--borde-ui)] px-[11px] py-[9px]">Jue</div>
          <div className="border-r border-[var(--borde-ui)] px-[11px] py-[9px]">Vie</div>
          <div className="border-r border-[var(--borde-ui)] px-[11px] py-[9px]">Sáb</div>
          <div className="px-[11px] py-[9px]">Dom</div>
        </div>

        <div
          className={`grid grid-cols-7 min-w-[740px] ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {calendarDays.map((cell: CalendarDay, idx) => {
            if (!cell)
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[104px] border-b border-r"
                  style={{ background: 'var(--hueso)', borderColor: 'var(--borde-ui)' }}
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

      <div className="flex flex-wrap items-center gap-x-[14px] gap-y-1 border-t px-[13px] py-[10px] text-[10px]" style={{ borderColor: 'var(--borde-ui)', color: 'var(--gris)' }}>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#3574d4]" aria-hidden="true" />
          En proceso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#db8b1b]" aria-hidden="true" />
          Requiere atención
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#17845b]" aria-hidden="true" />
          Aprobado / publicado
        </span>
        <span className="ml-auto">Arrastra una publicación para cambiar su fecha</span>
      </div>
    </section>
  );
}
