import type { TipoCampanaEnum } from "@/types/enums";

export type CampanaEstatus = "PLANIFICADA" | "ACTIVA" | "FINALIZADA" | "ARCHIVADA";
export type CampanaEstatusOperativo = Exclude<CampanaEstatus, "ARCHIVADA">;

export interface Campana {
  id: string;
  nombre: string;
  descripcion?: string | null;
  tipo_campana: TipoCampanaEnum;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number | null;
  estatus: CampanaEstatus;
  estatus_pre_archivado?: CampanaEstatusOperativo | null;
  activo?: boolean;
  created_at?: string;
  publicaciones?: PublicacionCampana[];
  efemerides?: EfemerideCampana[];
  evaluacion?: CampanaEvaluacion | null;
}

export interface EfemerideCampana {
  id: string;
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface CampanaGrid {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_campana: TipoCampanaEnum;
  estatus: CampanaEstatus;
  fecha_inicio: string;
  fecha_fin: string;
  efemerides: EfemerideCampana[];
}

export interface CampanaPublicacionGrid {
  id: string;
  nombre: string;
  estatus: CampanaEstatus;
}

export interface PublicacionCampana {
  id: string;
  titulo: string;
  formato: string;
  fecha_publicacion: string;
  estatus: string;
  drive_folder_url?: string | null;
}

export interface CampanaEvaluacion {
  id: string;
  campana_id: string;
  alcance_total: number | null;
  interacciones_totales: number | null;
  presupuesto_ejecutado: number | null;
  informe_cualitativo: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface CreateCampaignInput {
  nombre: string;
  descripcion?: string;
  tipo_campana: TipoCampanaEnum;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
  efemeride_ids?: string[];
}

export interface UpdateCampaignInput extends CreateCampaignInput {
  confirmar_desvinculacion?: boolean;
}

export interface SaveCampaignEvaluationInput {
  campana_id: string;
  alcance_total?: number | null;
  interacciones_totales?: number | null;
  presupuesto_ejecutado?: number | null;
  informe_cualitativo?: string;
  observaciones?: string;
}

export interface Efemeride {
  id: string;
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion: string | null;
  created_at: string;
}

export interface EfemerideInput {
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
}
