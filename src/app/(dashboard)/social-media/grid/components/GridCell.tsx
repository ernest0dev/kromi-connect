'use client';

import { GridCellProps } from '../types/grid';
import type { Efemeride } from '@/app/actions/efemerides/efemerides';
import type { CampanaGrid } from '@/app/actions/campanas/campaigns';
import { TicketCard } from './TicketCard';

export function GridCell({
  day,
  dateStr,
  isToday,
  publicaciones,
  efemerides,
  campanas,
  onTicketClick,
  onEfemerideClick,
  onCampaignClick,
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
        {efemerides.map((efemeride: Efemeride) => {
          const isPeriod = efemeride.fecha_inicio !== efemeride.fecha_fin;
          const continuesFromPreviousMonth = efemeride.fecha_inicio.slice(0, 7) !== dateStr.slice(0, 7);
          const interval = isPeriod
            ? `${new Date(`${efemeride.fecha_inicio}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })} – ${new Date(`${efemeride.fecha_fin}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : new Date(`${efemeride.fecha_inicio}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
          return (
            <button
              key={efemeride.id}
              type="button"
              draggable={false}
              onClick={() => onEfemerideClick(efemeride)}
              className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-[5px] border border-dashed px-1.5 py-[4px] text-left text-[9px] leading-[1.25] ui-focus-ring ${isPeriod ? 'border-[#c7a96b] bg-[#fbf6e9] text-[#71551d]' : 'border-[#8aa3bd] bg-[#eef4fa] text-[#34546f]'}`}
              title={`${efemeride.nombre} · ${interval}`}
              aria-label={`${isPeriod ? continuesFromPreviousMonth ? 'Periodo en curso' : 'Periodo' : 'Efeméride'}: ${efemeride.nombre}, ${interval}. Abrir detalles.`}
            >
              <span className="shrink-0 rounded-sm bg-white/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide">{isPeriod ? continuesFromPreviousMonth ? 'En curso' : 'Periodo' : 'Fecha'}</span>
              <span className="truncate font-medium">{efemeride.nombre}</span>
            </button>
          );
        })}
        {campanas.map((campaign: CampanaGrid) => {
          const continuesFromPreviousMonth = campaign.fecha_inicio.slice(0, 7) !== dateStr.slice(0, 7);
          const isFinished = campaign.estatus === 'FINALIZADA';
          return (
            <button
              key={campaign.id}
              type="button"
              draggable={false}
              onClick={() => onCampaignClick(campaign)}
              className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-[5px] border px-1.5 py-[4px] text-left text-[9px] leading-[1.25] ui-focus-ring ${isFinished ? 'border-slate-300 bg-slate-100 text-slate-500 opacity-70' : campaign.estatus === 'ACTIVA' ? 'border-[#73ad92] bg-[#edf7f1] text-[#315b47]' : 'border-[#a597d1] bg-[#f2effa] text-[#51447c]'}`}
              title={`${campaign.nombre} · ${campaign.estatus === 'FINALIZADA' ? 'Finalizada' : campaign.estatus === 'ACTIVA' ? 'Activa' : 'Planificada'} · ${campaign.fecha_inicio} – ${campaign.fecha_fin}`}
              aria-label={`Campaña ${campaign.nombre}, ${isFinished ? 'finalizada' : campaign.estatus === 'ACTIVA' ? 'activa' : 'planificada'}${continuesFromPreviousMonth ? ', continúa de un mes anterior' : ''}. Abrir efemérides relacionadas.`}
            >
              <span className="shrink-0 rounded-sm bg-white/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide">{isFinished ? 'Histórica' : continuesFromPreviousMonth ? 'Continúa' : 'Campaña'}</span>
              <span className="truncate font-medium">{campaign.nombre}</span>
              {campaign.efemerides.length > 1 && <span className="shrink-0 rounded-full bg-white/70 px-1.25 text-[8px] font-bold">{campaign.efemerides.length} ef.</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
