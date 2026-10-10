import { Publicacion, PublicacionConCuentas, FormatoEnum, EstatusEnum, SocialAccountOption } from '@/types';
import type { Efemeride } from '@/app/actions/efemerides/efemerides';
import type { CampanaGrid } from '@/app/actions/campanas/campaigns';
import type { DragEvent } from 'react';

export interface GridCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  publicaciones: PublicacionConCuentas[];
  efemerides: Efemeride[];
  campanas: CampanaGrid[];
  socialAccounts: SocialAccountOption[];
  onTicketClick: (id: string) => void;
  onEfemerideClick: (efemeride: Efemeride) => void;
  onCampaignClick: (campaign: CampanaGrid) => void;
  onCreateForDate: (dateStr: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, dateStr: string) => void;
}

export interface GridCalendarProps {
  currentDate: Date;
  publicaciones: PublicacionConCuentas[];
  efemerides: Efemeride[];
  campanas: CampanaGrid[];
  socialAccounts: SocialAccountOption[];
  isPending: boolean;
  onTicketClick: (id: string) => void;
  onEfemerideClick: (efemeride: Efemeride) => void;
  onCampaignClick: (campaign: CampanaGrid) => void;
  onCreateForDate: (dateStr: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, dateStr: string) => void;
}

export interface TicketCardProps {
  publicacion: Publicacion;
  formatoLabel?: string;
  onClick: () => void;
  onDragStart: (e: DragEvent) => void;
}

export interface TicketDetailCardProps {
  publicacion: Publicacion;
  nombreCampana: string | null;
  formatoLabel: string;
  onViewDetails: () => void;
  onArchive: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  isSelected: boolean;
  onEdit: () => void;
  onStatusChange: (nuevoEstatus: EstatusEnum, reason?: string) => Promise<void>;
}

export interface StatusSelectProps {
  currentStatus: EstatusEnum;
  onChange: (nuevoEstatus: EstatusEnum, reason?: string) => Promise<void>;
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
