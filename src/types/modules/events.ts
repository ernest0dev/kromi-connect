export type EventoEstatus = 'EN_PLANIFICACION' | 'PROGRAMADO' | 'EN_CURSO' | 'TERMINADO' | 'CANCELADO';
export type EventoTipo = 'DEGUSTACION' | 'IMPULSO' | 'OTRO';
export type EventoOrigen = 'PROPIO' | 'PROVEEDOR';

export interface EventoSede { sede_id: string; nombre: string; zona: string | null }
export interface EventoIndicadores { proximo?: boolean; fecha_vencida?: boolean; incompleto?: boolean; materiales_sin_declarar?: boolean; cierre_pendiente?: boolean; diseno_sin_solicitar?: boolean; diseno_atrasado?: boolean; diseno_posterior_al_evento?: boolean }
export interface EventoCruce { evento_id: string; nombre: string; estatus: EventoEstatus; inicio: string; fin: string; sede_id: string; sede_nombre: string }

export interface EventoRow {
  id: string; nombre: string; tipo: EventoTipo; tipo_otro: string | null; origen: EventoOrigen;
  proveedor_nombre: string | null; inicio: string | null; fin: string | null; estatus: EventoEstatus;
  responsable_id: string | null; responsable_nombre: string | null; presupuesto_estimado: number | null;
  moneda: 'USD'; requiere_inscripcion: boolean; version: number; archivado_en: string | null;
  con_patrocinio: boolean; tiene_materiales: boolean; sedes: EventoSede[]; hay_cruce: boolean;
  requiere_diseno: boolean; diseno_formatos: ('DIGITAL' | 'IMPRESION')[] | null; fecha_entrega_diseno: string | null; diseno_estatus: 'SOLICITADO' | 'EN_DISENO' | 'EN_CORRECCION' | 'ENTREGADO' | 'CANCELADO' | null;
  indicadores: EventoIndicadores; total_count: number;
}

export interface EventoDetalle extends Omit<EventoRow, 'con_patrocinio' | 'tiene_materiales' | 'hay_cruce' | 'total_count'> {
  descripcion: string | null; campana_id: string | null; gasto_real: number | null;
  inscripcion_cupo: number | null; inscripcion_limite: string | null; inscripcion_info: string | null;
  asistentes_esperados: number | null; asistentes_reales: number | null; notas_cierre: string | null;
  creado_en: string; creado_por: string | null; creado_por_nombre: string | null;
  modificado_en: string; modificado_por: string | null; modificado_por_nombre: string | null;
  patrocinadores: string | null; materiales: string | null; cruces: EventoCruce[];
  requiere_diseno: boolean; diseno_formatos: ('DIGITAL' | 'IMPRESION')[] | null; instrucciones_diseno: string | null; fecha_entrega_diseno: string | null;
  diseno_estatus: 'SOLICITADO' | 'EN_DISENO' | 'EN_CORRECCION' | 'ENTREGADO' | 'CANCELADO' | null; diseno_solicitado_en: string | null; diseno_iniciado_en: string | null; diseno_entregado_en: string | null; disenador_id: string | null; disenador_nombre: string | null;
  drive_brief_file_count: number;
}

export interface EventoHistorial {
  id: string; tipo: 'ESTATUS' | 'REPROGRAMACION' | 'DISENO'; anterior: Record<string, unknown>;
  nuevo: Record<string, unknown>; motivo: string | null; cambiado_por: string | null;
  cambiado_por_nombre: string | null; cambiado_en: string; total_count: number;
}

export interface EventoPermisos { create: boolean; update: boolean; status: boolean; archive: boolean; design: boolean }
export interface EventoSedeCatalogo { id: string; codigo: string; nombre: string; orden: number }
export interface EventoResponsable { user_id: string; full_name: string | null; email: string | null }

