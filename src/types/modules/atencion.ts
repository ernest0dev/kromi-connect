import { Database } from '../database.types';

export type ReporteAtencionCliente = Database['public']['Tables']['reporte_atencion_cliente']['Row'];
export type ReporteAtencionClienteInsert = Database['public']['Tables']['reporte_atencion_cliente']['Insert'];
export type ReporteAtencionClienteUpdate = Database['public']['Tables']['reporte_atencion_cliente']['Update'];

export interface ResumenEscuchaSocial {
  total_quejas: number;
  total_sugerencias: number;
  total_consultas: number;
  casos_abiertos: number;
}