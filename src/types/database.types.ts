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
import type { InventarioActividadRow, InventarioArticuloRow } from './modules/inventory';

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
      publicacion_drive_uploads: {
        Row: { id: string; publicacion_id: string; actor_id: string; file_name: string; mime_type: string; file_size: number; carpeta: 'BRIEF' | 'ENTREGABLES'; session_uri: string | null; status: 'RESERVING' | 'UPLOADING' | 'COMPLETE' | 'CANCEL_PENDING' | 'CANCELLED' | 'EXPIRED'; drive_file_id: string | null; expires_at: string; created_at: string; completed_at: string | null };
        Insert: { id?: string; publicacion_id: string; actor_id: string; file_name: string; mime_type: string; file_size: number; carpeta?: 'BRIEF' | 'ENTREGABLES'; session_uri?: string | null; status?: 'RESERVING' | 'UPLOADING' | 'COMPLETE' | 'CANCEL_PENDING' | 'CANCELLED' | 'EXPIRED'; drive_file_id?: string | null; expires_at?: string; created_at?: string; completed_at?: string | null };
        Update: { id?: string; publicacion_id?: string; actor_id?: string; file_name?: string; mime_type?: string; file_size?: number; carpeta?: 'BRIEF' | 'ENTREGABLES'; session_uri?: string | null; status?: 'RESERVING' | 'UPLOADING' | 'COMPLETE' | 'CANCEL_PENDING' | 'CANCELLED' | 'EXPIRED'; drive_file_id?: string | null; expires_at?: string; created_at?: string; completed_at?: string | null };
        Relationships: [{ foreignKeyName: 'publicacion_drive_uploads_publicacion_id_fkey'; columns: ['publicacion_id']; referencedRelation: 'publicaciones'; referencedColumns: ['id'] }];
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
          requiere_diseno: boolean;
          instrucciones_diseno: string | null;
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
          drive_brief_folder_id: string | null;
          drive_deliverables_folder_id: string | null;
          drive_brief_file_count: number;
          drive_brief_checked_at: string | null;
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
          requiere_diseno?: boolean;
          instrucciones_diseno?: string | null;
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
          drive_brief_folder_id?: string | null;
          drive_deliverables_folder_id?: string | null;
          drive_brief_file_count?: number;
          drive_brief_checked_at?: string | null;
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
          requiere_diseno?: boolean;
          instrucciones_diseno?: string | null;
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
          drive_brief_folder_id?: string | null;
          drive_deliverables_folder_id?: string | null;
          drive_brief_file_count?: number;
          drive_brief_checked_at?: string | null;
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
      inventario_sedes: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          orden: number;
          activa: boolean;
          created_at: string;
        };
        // Sin escritura directa: se cambia con migraciones (catálogo) o funciones RPC.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventario_ubicaciones: {
        Row: {
          id: string;
          sede_id: string;
          nombre: string;
          activa: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventario_categorias: {
        Row: {
          id: string;
          nombre: string;
          activa: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
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
      list_inventory_items: {
        Args: {
          p_sede_id?: string | null;
          p_search?: string | null;
          p_categoria_id?: string | null;
          p_ubicacion_id?: string | null;
          p_condicion?: string | null;
          p_tipo_control?: string | null;
          p_sort?: string;
          p_dir?: string;
          p_limit?: number;
          p_offset?: number;
          p_articulo_id?: string | null;
        };
        Returns: InventarioArticuloRow[];
      };
      get_inventory_sede_counts: {
        Args: Record<PropertyKey, never>;
        Returns: { sede_id: string; total: number }[];
      };
      get_inventory_item_activity: {
        Args: { p_articulo_id: string; p_tipo?: string | null; p_limit?: number; p_offset?: number };
        Returns: InventarioActividadRow[];
      };
      list_event_responsables: {
        Args: Record<PropertyKey, never>;
        Returns: { user_id: string; full_name: string | null }[];
      };
      list_event_campaigns: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; nombre: string }[];
      };
      list_events: {
        Args: {
          p_desde?: string | null; p_hasta?: string | null; p_sede_id?: string | null;
          p_estatus?: string | null; p_tipo?: string | null; p_origen?: string | null;
          p_responsable_id?: string | null; p_search?: string | null; p_archivados?: boolean;
          p_dir?: string; p_limit?: number; p_offset?: number;
        };
        Returns: {
          id: string; nombre: string; tipo: string; tipo_otro: string | null; origen: string;
          proveedor_nombre: string | null; inicio: string | null; fin: string | null; estatus: string;
          responsable_id: string | null; responsable_nombre: string | null; presupuesto_estimado: number | null;
          moneda: string; requiere_inscripcion: boolean; version: number; archivado_en: string | null;
          con_patrocinio: boolean; tiene_materiales: boolean; sedes: Json; hay_cruce: boolean;
          indicadores: Json; total_count: number;
        }[];
      };
      get_event: {
        Args: { p_evento_id: string };
        Returns: {
          id: string; nombre: string; descripcion: string | null; tipo: string; tipo_otro: string | null;
          origen: string; proveedor_nombre: string | null; inicio: string | null; fin: string | null; estatus: string;
          responsable_id: string | null; responsable_nombre: string | null; campana_id: string | null;
          presupuesto_estimado: number | null; moneda: string; gasto_real: number | null;
          requiere_inscripcion: boolean; inscripcion_cupo: number | null; inscripcion_limite: string | null;
          inscripcion_info: string | null; asistentes_esperados: number | null; asistentes_reales: number | null;
          notas_cierre: string | null; archivado_en: string | null; version: number; creado_en: string;
          creado_por: string | null; creado_por_nombre: string | null; modificado_en: string;
          modificado_por: string | null; modificado_por_nombre: string | null; sedes: Json;
          patrocinadores: string | null; materiales: string | null; cruces: Json; indicadores: Json;
        }[];
      };
      get_event_history: {
        Args: { p_evento_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          id: string; tipo: string; anterior: Json; nuevo: Json; motivo: string | null;
          cambiado_por: string | null; cambiado_por_nombre: string | null; cambiado_en: string; total_count: number;
        }[];
      };
      check_event_overlap: {
        Args: { p_evento_id: string | null; p_inicio: string; p_fin: string; p_sede_ids: string[] };
        Returns: { evento_id: string; nombre: string; estatus: string; inicio: string; fin: string; sede_id: string; sede_nombre: string }[];
      };
      create_event: {
        Args: { p_datos: Json; p_confirmar_cruce?: boolean };
        Returns: string;
      };
      update_event: {
        Args: { p_evento_id: string; p_expected_version: number; p_datos: Json; p_motivo?: string | null; p_confirmar_cruce?: boolean };
        Returns: number;
      };
      reschedule_event: {
        Args: { p_evento_id: string; p_expected_version: number; p_inicio: string; p_fin: string; p_motivo?: string | null; p_confirmar_cruce?: boolean };
        Returns: number;
      };
      transition_event_status: {
        Args: { p_evento_id: string; p_expected_version: number; p_estatus: string; p_motivo?: string | null; p_confirmar_cruce?: boolean };
        Returns: number;
      };
      save_event_closure: {
        Args: { p_evento_id: string; p_expected_version: number; p_asistentes_reales: number | null; p_gasto_real: number | null; p_notas_cierre: string | null };
        Returns: number;
      };
      archive_event: {
        Args: { p_evento_id: string; p_expected_version: number };
        Returns: number;
      };
      restore_event: {
        Args: { p_evento_id: string; p_expected_version: number };
        Returns: number;
      };
      create_inventory_location: {
        Args: { p_sede_id: string; p_nombre: string };
        Returns: string;
      };
      create_inventory_item: {
        Args: {
          p_categoria_id: string;
          p_nombre: string;
          p_especificaciones: string | null;
          p_tipo_control: string;
          p_codigo: string | null;
          p_cantidad: number | null;
          p_unidad_medida: string;
          p_ubicacion_id: string;
          p_condicion: string;
          p_atributos?: Json;
          p_observacion?: string | null;
          p_confirmar_duplicado?: boolean;
        };
        Returns: string;
      };
      update_inventory_item: {
        Args: {
          p_articulo_id: string;
          p_expected_version: number;
          p_categoria_id: string;
          p_nombre: string;
          p_especificaciones: string | null;
          p_codigo: string | null;
          p_unidad_medida: string;
          p_condicion: string;
          p_atributos?: Json;
        };
        Returns: number;
      };
      register_inventory_movement: {
        Args: {
          p_articulo_id: string;
          p_tipo: string;
          p_cantidad: number;
          p_expected_version: number;
          p_destino_ubicacion_id?: string | null;
          p_externo?: string | null;
          p_fecha_hora?: string | null;
          p_observacion?: string | null;
        };
        Returns: { movimiento_id: string; articulo_id: string; version: number; destino_articulo_id: string | null };
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
      set_publication_design_requirement: {
        Args: { p_publicacion_id: string; p_requiere_diseno: boolean };
        Returns: Database['public']['Tables']['publicaciones']['Row'];
      };
      set_publication_design_instructions: {
        Args: { p_publicacion_id: string; p_instrucciones: string | null };
        Returns: boolean;
      };
      reserve_publication_deliverable_upload: {
        Args: { p_actor_id: string; p_publication_id: string; p_file_name: string; p_mime_type: string; p_file_size: number; p_drive_file_count: number };
        Returns: string;
      };
      get_design_publication_history: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Database['public']['Tables']['publicaciones']['Row'][];
      };
      get_design_publication_comments: {
        Args: { p_ids: string[] };
        Returns: { id: string; publicacion_id: string; texto: string; tipo: string; creado_en: string }[];
      };
      get_publication_designer_names: {
        Args: { p_ids: string[] };
        Returns: { publicacion_id: string; disenador_id: string | null; full_name: string | null }[];
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
