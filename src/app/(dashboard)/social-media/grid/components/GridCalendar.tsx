'use client';

import { useMemo } from 'react';
import { Publicacion } from '@/types';
import { generateCalendarDays, getTodayIso, CalendarDay } from '../utils/date';
import { SLA_META } from '../utils/sla';
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
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
    >
      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-7 min-w-[700px] border-b text-left py-2 px-[11px] text-[10px] font-bold uppercase tracking-wider"
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
        >
          <div className="px-2">Lun</div>
          <div className="px-2">Mar</div>
          <div className="px-2">Mié</div>
          <div className="px-2">Jue</div>
          <div className="px-2">Vie</div>
          <div className="px-2">Sáb</div>
          <div className="px-2">Dom</div>
        </div>

        <div
          className={`grid grid-cols-7 min-w-[700px] ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {calendarDays.map((cell: CalendarDay, idx) => {
            if (!cell)
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[104px] border-b border-r"
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

      <div className="border-t" style={{ borderColor: 'var(--borde)' }}>
        {/* Grupo 1: colores de las tarjetas (estatus) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[11px]" style={{ color: 'var(--gris)' }}>
          <span className="font-semibold" style={{ color: 'var(--gris)' }}>Publicación:</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--gris)' }} aria-hidden="true" />
            Pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--azul)' }} aria-hidden="true" />
            En proceso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--naranja)' }} aria-hidden="true" />
            Requiere atención
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--verde)' }} aria-hidden="true" />
            Aprobado / publicado
          </span>
        </div>
        {/* Grupo 2: dots SLA del día */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-3 py-1 text-[10px] italic" style={{ color: 'var(--gris)' }}>
          <span className="font-semibold" style={{ color: 'var(--gris)' }}>Día:</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: SLA_META['vencido'].dotVar }} aria-hidden="true" />
            SLA vencido
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: SLA_META['hoy'].dotVar }} aria-hidden="true" />
            Brief próximo / hoy
          </span>
          <span className="lg:ml-auto">
            Arrastra una publicación para cambiar su fecha
          </span>
        </div>
      </div>
    </section>
  );
}
