import {
  FormatoEnum,
  EstatusEnum,
  TipoCampanaEnum,
  CampanaEstatusEnum,
  CampanaEstatusOperativoEnum,
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
          descripcion: string | null;
          tipo_campana: TipoCampanaEnum;
          fecha_inicio: string;
          fecha_fin: string;
          presupuesto: number | null;
          estatus: CampanaEstatusEnum;
          estatus_pre_archivado: CampanaEstatusOperativoEnum | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          descripcion?: string | null;
          tipo_campana: TipoCampanaEnum;
          fecha_inicio: string;
          fecha_fin: string;
          presupuesto?: number | null;
          estatus?: CampanaEstatusEnum;
          estatus_pre_archivado?: CampanaEstatusOperativoEnum | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          descripcion?: string | null;
          tipo_campana?: TipoCampanaEnum;
          fecha_inicio?: string;
          fecha_fin?: string;
          presupuesto?: number | null;
          estatus?: CampanaEstatusEnum;
          estatus_pre_archivado?: CampanaEstatusOperativoEnum | null;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      efemerides: {
        Row: {
          id: string;
          nombre: string;
          anio: number;
          fecha_inicio: string;
          fecha_fin: string;
          descripcion: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          anio: number;
          fecha_inicio: string;
          fecha_fin: string;
          descripcion?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          anio?: number;
          fecha_inicio?: string;
          fecha_fin?: string;
          descripcion?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      campana_efemerides: {
        Row: { campana_id: string; efemeride_id: string; created_at: string };
        Insert: { campana_id: string; efemeride_id: string; created_at?: string };
        Update: { campana_id?: string; efemeride_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: 'campana_efemerides_campana_id_fkey';
            columns: ['campana_id'];
            referencedRelation: 'campanas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campana_efemerides_efemeride_id_fkey';
            columns: ['efemeride_id'];
            referencedRelation: 'efemerides';
            referencedColumns: ['id'];
          }
        ];
      };
      categorias_contenido: {
        Row: { id: string; codigo: string; nombre: string; created_at: string };
        Insert: { id?: string; codigo: string; nombre: string; created_at?: string };
        Update: { id?: string; codigo?: string; nombre?: string; created_at?: string };
        Relationships: [];
      };
      publicacion_categorias: {
        Row: { publicacion_id: string; categoria_id: string; created_at: string };
        Insert: { publicacion_id: string; categoria_id: string; created_at?: string };
        Update: { publicacion_id?: string; categoria_id?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: 'publicacion_categorias_publicacion_id_fkey'; columns: ['publicacion_id']; referencedRelation: 'publicaciones'; referencedColumns: ['id'] },
          { foreignKeyName: 'publicacion_categorias_categoria_id_fkey'; columns: ['categoria_id']; referencedRelation: 'categorias_contenido'; referencedColumns: ['id'] }
        ];
      };
      publicaciones: {
        Row: {
          id: string;
          campana_id: string | null;
          titulo: string;
          formato: FormatoEnum;
          linea_contenido: string | null;
          fecha_publicacion: string;
          hora_publicacion: string | null;
          requiere_rodaje: boolean;
          fecha_rodaje: string | null;
          sedes: SedeEnum[];
          prioridad: number;
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
          deleted_at: string | null;
          drive_cleanup_status: string;
          drive_cleanup_error: string | null;
          drive_cleanup_attempted_at: string | null;
          drive_deleted_at: string | null;
          drive_preserved_at: string | null;
        };
        Insert: {
          id?: string;
          campana_id?: string | null;
          titulo: string;
          formato: FormatoEnum;
          linea_contenido?: string | null;
          fecha_publicacion: string;
          hora_publicacion?: string | null;
          requiere_rodaje?: boolean;
          fecha_rodaje?: string | null;
          sedes?: SedeEnum[];
          prioridad?: number;
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
          deleted_at?: string | null;
          drive_cleanup_status?: string;
          drive_cleanup_error?: string | null;
          drive_cleanup_attempted_at?: string | null;
          drive_deleted_at?: string | null;
          drive_preserved_at?: string | null;
        };
        Update: {
          id?: string;
          campana_id?: string | null;
          titulo?: string;
          formato?: FormatoEnum;
          linea_contenido?: string | null;
          fecha_publicacion?: string;
          hora_publicacion?: string | null;
          requiere_rodaje?: boolean;
          fecha_rodaje?: string | null;
          sedes?: SedeEnum[];
          prioridad?: number;
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
          deleted_at?: string | null;
          drive_cleanup_status?: string;
          drive_cleanup_error?: string | null;
          drive_cleanup_attempted_at?: string | null;
          drive_deleted_at?: string | null;
          drive_preserved_at?: string | null;
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
      publicacion_estatus_historial: {
        Row: { id: string; publicacion_id: string; estatus_anterior: EstatusEnum | null; estatus_nuevo: EstatusEnum; motivo: string | null; cambiado_por: string | null; cambiado_en: string };
        Insert: { id?: string; publicacion_id: string; estatus_anterior?: EstatusEnum | null; estatus_nuevo: EstatusEnum; motivo?: string | null; cambiado_por?: string | null; cambiado_en?: string };
        Update: { id?: string; publicacion_id?: string; estatus_anterior?: EstatusEnum | null; estatus_nuevo?: EstatusEnum; motivo?: string | null; cambiado_por?: string | null; cambiado_en?: string };
        Relationships: [];
      };
      publicacion_comentarios: {
        Row: { id: string; publicacion_id: string; autor_id: string | null; texto: string; tipo: string; creado_en: string };
        Insert: { id?: string; publicacion_id: string; autor_id?: string | null; texto: string; tipo?: string; creado_en?: string };
        Update: { id?: string; publicacion_id?: string; autor_id?: string | null; texto?: string; tipo?: string; creado_en?: string };
        Relationships: [];
      };
      publicacion_canales: {
        Row: {
          id: string;
          publicacion_id: string;
          canal: CanalEnum;
          estado_publicacion: string;
          url_publicacion: string | null;
          social_account_id: string | null;
        };
        Insert: {
          id?: string;
          publicacion_id: string;
          canal: CanalEnum;
          estado_publicacion?: string;
          url_publicacion?: string | null;
          social_account_id?: string | null;
        };
        Update: {
          id?: string;
          publicacion_id?: string;
          canal?: CanalEnum;
          estado_publicacion?: string;
          url_publicacion?: string | null;
          social_account_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'publicacion_canales_publicacion_id_fkey';
            columns: ['publicacion_id'];
            referencedRelation: 'publicaciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'publicacion_canales_social_account_id_fkey';
            columns: ['social_account_id'];
            referencedRelation: 'social_accounts';
            referencedColumns: ['id'];
          }
        ];
      };
      social_accounts: {
        Row: {
          id: string;
          platform: CanalEnum;
          handle: string;
          display_name: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: CanalEnum;
          handle: string;
          display_name: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: CanalEnum;
          handle?: string;
          display_name?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_social_accounts: {
        Row: { user_id: string; social_account_id: string; assigned_at: string };
        Insert: { user_id: string; social_account_id: string; assigned_at?: string };
        Update: { user_id?: string; social_account_id?: string; assigned_at?: string };
        Relationships: [
          { foreignKeyName: 'user_social_accounts_social_account_id_fkey'; columns: ['social_account_id']; referencedRelation: 'social_accounts'; referencedColumns: ['id'] }
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
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          role_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          role_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string | null;
          role_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_permission: {
        Args: { required_permission: string };
        Returns: boolean;
      };
      save_campaign_with_efemerides: {
        Args: {
          p_campana_id: string | null;
          p_nombre: string;
          p_descripcion: string | null;
          p_tipo_campana: TipoCampanaEnum;
          p_fecha_inicio: string;
          p_fecha_fin: string;
          p_presupuesto: number | null;
          p_efemeride_ids: string[];
          p_confirmar_desvinculacion: boolean;
        };
        Returns: string;
      };
      replace_publicacion_categorias: {
        Args: { p_publicacion_id: string; p_categoria_ids: string[] };
        Returns: undefined;
      };
      create_publicacion_with_relations: {
        Args: {
          p_titulo: string;
          p_formato: FormatoEnum;
          p_fecha_publicacion: string;
          p_campana_id: string | null;
          p_fecha_limite_brief: string | null;
          p_hook_texto: string | null;
          p_body_texto: string | null;
          p_cta_texto: string | null;
          p_hashtags: string[] | null;
          p_drive_folder_id: string | null;
          p_drive_folder_url: string | null;
          p_social_account_ids: string[];
          p_categoria_ids: string[];
        };
        Returns: Json;
      };
      update_publicacion_with_relations: {
        Args: {
          p_publicacion_id: string;
          p_titulo: string;
          p_formato: FormatoEnum;
          p_fecha_publicacion: string;
          p_campana_id: string | null;
          p_fecha_solicitud_diseno: string | null;
          p_fecha_entrega_diseno_real: string | null;
          p_fecha_aprobacion_gerencia: string | null;
          p_estatus: EstatusEnum;
          p_hook_texto: string | null;
          p_body_texto: string | null;
          p_cta_texto: string | null;
          p_hashtags: string[] | null;
          p_fecha_limite_brief: string | null;
          p_fecha_entrega_diseno_estimada: string | null;
          p_social_account_ids: string[];
          p_categoria_ids: string[];
        };
        Returns: Json;
      };
      transition_publicacion_status: {
        Args: { p_publicacion_id: string; p_estatus_nuevo: EstatusEnum; p_motivo?: string | null };
        Returns: Json;
      };
      get_design_publication_queue: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['publicaciones']['Row'][];
      };
      claim_expired_publication_purges: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; drive_folder_id: string | null; drive_folder_url: string | null }[];
      };
      restore_archived_publication: {
        Args: { p_publicacion_id: string };
        Returns: boolean;
      };
      set_publication_hour: {
        Args: { p_publicacion_id: string; p_hora_publicacion: string | null };
        Returns: boolean;
      };
      set_publication_production: {
        Args: { p_publicacion_id: string; p_requiere_rodaje: boolean; p_fecha_rodaje: string | null; p_sedes: SedeEnum[]; p_prioridad: number };
        Returns: boolean;
      };
      archive_publication: {
        Args: { p_publicacion_id: string };
        Returns: boolean;
      };
      user_has_all_publication_accounts: {
        Args: { p_publicacion_id: string };
        Returns: boolean;
      };
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
