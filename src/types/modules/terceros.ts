import { Database } from '../database.types';
import { Publicacion } from './publicaciones';

// Tipos base
export type SolicitudTercero = Database['public']['Tables']['solicitudes_terceros']['Row'];
export type SolicitudTerceroInsert = Database['public']['Tables']['solicitudes_terceros']['Insert'];
export type SolicitudTerceroUpdate = Database['public']['Tables']['solicitudes_terceros']['Update'];

export type InventarioPremio = Database['public']['Tables']['inventario_premios']['Row'];
export type InventarioPremioInsert = Database['public']['Tables']['inventario_premios']['Insert'];
export type InventarioPremioUpdate = Database['public']['Tables']['inventario_premios']['Update'];

// DTOs / Interfaces compuestas
export interface SolicitudTerceroConTicket extends SolicitudTercero {
  publicacion?: Publicacion | null;
}

export interface InventarioPremioConDetalles extends InventarioPremio {
  solicitud_origen?: SolicitudTercero | null;
}