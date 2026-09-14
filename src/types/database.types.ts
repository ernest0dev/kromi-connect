import {
  FormatoEnum,
  EstatusEnum,
  TipoCampanaEnum,
  DepartamentoEnum,
  CanalEnum,
  SedeEnum,
} from './enums';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      campanas: {
        Row: {
          id: string;
          nombre: string;
          tipo_campana: TipoCampanaEnum;
          fecha_inicio: string;
          fecha_fin: string;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          tipo_campana: TipoCampanaEnum;
          fecha_inicio: string;
          fecha_fin: string;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          tipo_campana?: TipoCampanaEnum;
          fecha_inicio?: string;
          fecha_fin?: string;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      publicaciones: {
        Row: {
          id: string;
          campana_id: string | null;
          titulo: string;
          formato: FormatoEnum;
          linea_contenido: string | null;
          fecha_publicacion: string;
          fecha_limite_brief: string | null;
          fecha_solicitud_diseno: string | null;
          fecha_entrega_diseno_estimada: string | null;
          fecha_entrega_diseno_real: string | null;
          fecha_aprobacion_gerencia: string | null;
          estatus: EstatusEnum;
          hook_texto: string | null;
          body_texto: string | null;
          cta_texto: string | null;
          hashtags: string[] | null;
          version_copy: number;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          creador_id: string | null;
          disenador_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campana_id?: string | null;
          titulo: string;
          formato: FormatoEnum;
          linea_contenido?: string | null;
          fecha_publicacion: string;
          fecha_limite_brief?: string | null;
          fecha_solicitud_diseno?: string | null;
          fecha_entrega_diseno_estimada?: string | null;
          fecha_entrega_diseno_real?: string | null;
          fecha_aprobacion_gerencia?: string | null;
          estatus?: EstatusEnum;
          hook_texto?: string | null;
          body_texto?: string | null;
          cta_texto?: string | null;
          hashtags?: string[] | null;
          version_copy?: number;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          creador_id?: string | null;
          disenador_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campana_id?: string | null;
          titulo?: string;
          formato?: FormatoEnum;
          linea_contenido?: string | null;
          fecha_publicacion?: string;
          fecha_limite_brief?: string | null;
          fecha_solicitud_diseno?: string | null;
          fecha_entrega_diseno_estimada?: string | null;
          fecha_entrega_diseno_real?: string | null;
          fecha_aprobacion_gerencia?: string | null;
          estatus?: EstatusEnum;
          hook_texto?: string | null;
          body_texto?: string | null;
          cta_texto?: string | null;
          hashtags?: string[] | null;
          version_copy?: number;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          creador_id?: string | null;
          disenador_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'publicaciones_campana_id_fkey';
            columns: ['campana_id'];
            referencedRelation: 'campanas';
            referencedColumns: ['id'];
          }
        ];
      };
      publicacion_canales: {
        Row: {
          id: string;
          publicacion_id: string;
          canal: CanalEnum;
          estado_publicacion: string;
          url_publicacion: string | null;
        };
        Insert: {
          id?: string;
          publicacion_id: string;
          canal: CanalEnum;
          estado_publicacion?: string;
          url_publicacion?: string | null;
        };
        Update: {
          id?: string;
          publicacion_id?: string;
          canal?: CanalEnum;
          estado_publicacion?: string;
          url_publicacion?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'publicacion_canales_publicacion_id_fkey';
            columns: ['publicacion_id'];
            referencedRelation: 'publicaciones';
            referencedColumns: ['id'];
          }
        ];
      };
      checklist_rodaje: {
        Row: {
          id: string;
          publicacion_id: string;
          toma_requerida: string;
          area_tienda: string;
          sucursal: SedeEnum;
          completado: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          publicacion_id: string;
          toma_requerida: string;
          area_tienda: string;
          sucursal: SedeEnum;
          completado?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          publicacion_id?: string;
          toma_requerida?: string;
          area_tienda?: string;
          sucursal?: SedeEnum;
          completado?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'checklist_rodaje_publicacion_id_fkey';
            columns: ['publicacion_id'];
            referencedRelation: 'publicaciones';
            referencedColumns: ['id'];
          }
        ];
      };
      solicitudes_terceros: {
        Row: {
          id: string;
          departamento_emisor: DepartamentoEnum;
          tipo_solicitud: string;
          descripcion: string | null;
          materiales_adjuntos_url: string[] | null;
          estatus_solicitud: string;
          publicacion_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          departamento_emisor: DepartamentoEnum;
          tipo_solicitud: string;
          descripcion?: string | null;
          materiales_adjuntos_url?: string[] | null;
          estatus_solicitud?: string;
          publicacion_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          departamento_emisor?: DepartamentoEnum;
          tipo_solicitud?: string;
          descripcion?: string | null;
          materiales_adjuntos_url?: string[] | null;
          estatus_solicitud?: string;
          publicacion_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'solicitudes_terceros_publicacion_id_fkey';
            columns: ['publicacion_id'];
            referencedRelation: 'publicaciones';
            referencedColumns: ['id'];
          }
        ];
      };
      inventario_premios: {
        Row: {
          id: string;
          proveedor_nombre: string | null;
          nombre_premio: string;
          cantidad_recibida: number;
          cantidad_entregada: number;
          sucursal_ubicacion: SedeEnum;
          campana_id: string | null;
          solicitud_id: string | null;
          estado_premio: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          proveedor_nombre?: string | null;
          nombre_premio: string;
          cantidad_recibida?: number;
          cantidad_entregada?: number;
          sucursal_ubicacion: SedeEnum;
          campana_id?: string | null;
          solicitud_id?: string | null;
          estado_premio?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          proveedor_nombre?: string | null;
          nombre_premio?: string;
          cantidad_recibida?: number;
          cantidad_entregada?: number;
          sucursal_ubicacion?: SedeEnum;
          campana_id?: string | null;
          solicitud_id?: string | null;
          estado_premio?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventario_premios_campana_id_fkey';
            columns: ['campana_id'];
            referencedRelation: 'campanas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventario_premios_solicitud_id_fkey';
            columns: ['solicitud_id'];
            referencedRelation: 'solicitudes_terceros';
            referencedColumns: ['id'];
          }
        ];
      };
      reporte_atencion_cliente: {
        Row: {
          id: string;
          fecha_semana: string;
          canal: CanalEnum;
          tipo: string;
          categoria: string | null;
          detalle_comentario: string | null;
          accion_tomada: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          fecha_semana: string;
          canal: CanalEnum;
          tipo: string;
          categoria?: string | null;
          detalle_comentario?: string | null;
          accion_tomada?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          fecha_semana?: string;
          canal?: CanalEnum;
          tipo?: string;
          categoria?: string | null;
          detalle_comentario?: string | null;
          accion_tomada?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      campana_evaluaciones: {
        Row: {
          id: string;
          campana_id: string;
          alcance_total: number | null;
          interacciones_totales: number | null;
          presupuesto_ejecutado: number | null;
          informe_cualitativo: string | null;
          observaciones: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campana_id: string;
          alcance_total?: number | null;
          interacciones_totales?: number | null;
          presupuesto_ejecutado?: number | null;
          informe_cualitativo?: string | null;
          observaciones?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campana_id?: string;
          alcance_total?: number | null;
          interacciones_totales?: number | null;
          presupuesto_ejecutado?: number | null;
          informe_cualitativo?: string | null;
          observaciones?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campana_evaluaciones_campana_id_fkey';
            columns: ['campana_id'];
            referencedRelation: 'campanas';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      formato_enum: FormatoEnum;
      estatus_enum: EstatusEnum;
      tipo_campana_enum: TipoCampanaEnum;
      departamento_enum: DepartamentoEnum;
      canal_enum: CanalEnum;
      sede_enum: SedeEnum;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}