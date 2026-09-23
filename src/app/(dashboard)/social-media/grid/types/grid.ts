import { Publicacion, FormatoEnum, EstatusEnum } from '@/types';
import type { DragEvent } from 'react';

export interface GridCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  publicaciones: Publicacion[];
  onTicketClick: (id: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, dateStr: string) => void;
}

export interface GridCalendarProps {
  currentDate: Date;
  publicaciones: Publicacion[];
  isPending: boolean;
  onTicketClick: (id: string) => void;
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
  isSelected: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (titulo?: string, fechaPublicacion?: string) => Promise<void>;
  onStatusChange: (nuevoEstatus: EstatusEnum) => Promise<void>;
}

export interface TicketEditFormProps {
  publicacion: Publicacion;
  onSave: (titulo: string, fechaPublicacion: string) => Promise<void>;
  onCancel: () => void;
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
  onFiltroChange: (filtro: 'TODOS' | FormatoEnum) => void;
}
