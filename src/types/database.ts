export type FormatoPublicacion = 'CARRUSEL' | 'POST' | 'REEL' | 'STORY';

export type EstadoTicket = 
  | 'BRIEF_PENDIENTE'
  | 'EN_RODAJE'
  | 'EN_DISENO'
  | 'EN_REVISION'
  | 'APROBADO_PROGRAMADO';

export interface Campana {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  creado_el: string;
}

export interface Publicacion {
  id: number;
  codigo_ticket: string; // Generado ej: TCK-001
  campana_id?: string | null;
  titulo: string;
  formato: FormatoPublicacion;
  dimensiones: string;
  linea_contenido?: string;
  fecha_publicacion: string;
  fecha_limite_brief: string;
  fecha_rodaje?: string;
  estatus: EstadoTicket;
  copy_pieza?: string;
  caption_redes?: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  creado_el: string;
  actualizado_el: string;
}

export interface ChecklistRodaje {
  id: string;
  publicacion_id: number;
  toma_requerida: string;
  area_tienda?: string;
  completado: boolean;
  creado_el: string;
}