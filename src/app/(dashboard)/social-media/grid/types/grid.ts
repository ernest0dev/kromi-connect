import { Publicacion, FormatoEnum, EstatusEnum } from '@/types';
import type { Efemeride } from '@/app/actions/efemerides/efemerides';
import type { CampanaGrid } from '@/app/actions/campanas/campaigns';
import type { DragEvent } from 'react';

export interface GridCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  publicaciones: Publicacion[];
  efemerides: Efemeride[];
  campanas: CampanaGrid[];
  onTicketClick: (id: string) => void;
  onEfemerideClick: (efemeride: Efemeride) => void;
  onCampaignClick: (campaign: CampanaGrid) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, dateStr: string) => void;
}

export interface GridCalendarProps {
  currentDate: Date;
  publicaciones: Publicacion[];
  efemerides: Efemeride[];
  campanas: CampanaGrid[];
  isPending: boolean;
  onTicketClick: (id: string) => void;
  onEfemerideClick: (efemeride: Efemeride) => void;
  onCampaignClick: (campaign: CampanaGrid) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, dateStr: string) => void;
}

export interface TicketCardProps {
  publicacion: Publicacion;
  onClick: () => void;
  onDragStart: (e: DragEvent) => void;
}

export interface TicketDetailCardProps {
  publicacion: Publicacion;
  nombreCampana: string | null;
  onViewDetails: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isSelected: boolean;
  onEdit: () => void;
  onStatusChange: (nuevoEstatus: EstatusEnum) => Promise<void>;
}

export interface StatusSelectProps {
  currentStatus: EstatusEnum;
  onChange: (nuevoEstatus: EstatusEnum) => Promise<void>;
  disabled?: boolean;
}

export interface GridHeaderProps {
  currentDate: Date;
  formatoFiltro: 'TODOS' | FormatoEnum;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onCreateClick: () => void;
  onFiltroChange: (filtro: 'TODOS' | FormatoEnum) => void;
}
