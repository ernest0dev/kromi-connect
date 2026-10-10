'use client';

import { useMemo } from 'react';
import { Publicacion } from '@/types';
import type { Efemeride } from '@/app/actions/efemerides/efemerides';
import type { CampanaGrid } from '@/app/actions/campanas/campaigns';
import { generateCalendarDays, getTodayIso, CalendarDay } from '../utils/date';
import { GridCalendarProps } from '../types/grid';
import { GridCell } from './GridCell';

export function GridCalendar({
  currentDate,
  publicaciones,
  efemerides,
  campanas,
  socialAccounts,
  isPending,
  onTicketClick,
  onEfemerideClick,
  onCampaignClick,
  onCreateForDate,
  onDragStart,
  onDragOver,
  onDrop,
}: GridCalendarProps) {
  const calendarDays = useMemo(
    () => generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const hoyStr = useMemo(() => getTodayIso(new Date()), []);
  const mesInicio = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
  const mesFin = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

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
            const itemsEfemerideDelDia = efemerides.filter((efemeride: Efemeride) => {
              if (efemeride.fecha_fin < mesInicio || efemeride.fecha_inicio > mesFin) return false;
              const fechaIndicador = efemeride.fecha_inicio < mesInicio ? mesInicio : efemeride.fecha_inicio;
              return fechaIndicador === cell.dateStr;
            }).sort((a, b) => {
              const aEsPeriodo = a.fecha_inicio !== a.fecha_fin;
              const bEsPeriodo = b.fecha_inicio !== b.fecha_fin;
              return Number(aEsPeriodo) - Number(bEsPeriodo) || a.nombre.localeCompare(b.nombre, 'es');
            });
            const itemsCampanaDelDia = campanas.filter((campaign: CampanaGrid) => {
              if (campaign.fecha_fin < mesInicio || campaign.fecha_inicio > mesFin) return false;
              const indicatorDate = campaign.fecha_inicio < mesInicio ? mesInicio : campaign.fecha_inicio;
              return indicatorDate === cell.dateStr;
            });
            const esHoy = cell.dateStr === hoyStr;

            return (
              <GridCell
                key={cell.dateStr}
                day={cell.day}
                dateStr={cell.dateStr}
                isToday={esHoy}
                publicaciones={itemsDelDia}
                efemerides={itemsEfemerideDelDia}
                campanas={itemsCampanaDelDia}
                socialAccounts={socialAccounts}
                onTicketClick={onTicketClick}
                onEfemerideClick={onEfemerideClick}
                onCampaignClick={onCampaignClick}
                onCreateForDate={onCreateForDate}
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
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#8aa3bd] bg-[#eef4fa]" aria-hidden="true" />
          Efeméride puntual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#c7a96b] bg-[#fbf6e9]" aria-hidden="true" />
          Periodo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#a597d1] bg-[#f2effa]" aria-hidden="true" />
          Campaña vinculada
        </span>
        <span className="text-slate-400">Finalizadas atenuadas · archivadas ocultas</span>
        <span className="ml-auto">Arrastra una publicación para cambiar su fecha</span>
      </div>
    </section>
  );
}
