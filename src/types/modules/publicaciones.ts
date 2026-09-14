import { Database } from '../database.types';
import { FormatoEnum, EstatusEnum, SedeEnum, CanalEnum } from '../enums';

// Tipos base directos de la base de datos
export type Publicacion = Database['public']['Tables']['publicaciones']['Row'];
export type PublicacionInsert = Database['public']['Tables']['publicaciones']['Insert'];
export type PublicacionUpdate = Database['public']['Tables']['publicaciones']['Update'];

export type ChecklistRodaje = Database['public']['Tables']['checklist_rodaje']['Row'];
export type PublicacionCanal = Database['public']['Tables']['publicacion_canales']['Row'];

// Tipos Extendidos / DTOs para Frontend y Server Actions
export interface PublicacionConDetalles extends Publicacion {
  canales?: PublicacionCanal[];
  checklist?: ChecklistRodaje[];
}