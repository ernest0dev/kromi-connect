
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_permissions": {
                  Row: {
                    "code": string,"created_at": string,"description": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string
                  }
                  Relationships: [

                  ]
                },"app_roles": {
                  Row: {
                    "code": string,"created_at": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"name"?: string
                  }
                  Relationships: [

                  ]
                },"campana_efemerides": {
                  Row: {
                    "campana_id": string,"created_at": string,"efemeride_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campana_id": string,"created_at"?: string,"efemeride_id": string
                  }
                  Update: {
                    "campana_id"?: string,"created_at"?: string,"efemeride_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campana_efemerides_campana_id_fkey"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campana_efemerides_efemeride_id_fkey"
      columns: ["efemeride_id"]
isOneToOne: false
      referencedRelation: "efemerides"
      referencedColumns: ["id"]
    }
                  ]
                },"campana_evaluaciones": {
                  Row: {
                    "alcance_total": number | null,"campana_id": string,"created_at": string | null,"id": string,"informe_cualitativo": string | null,"interacciones_totales": number | null,"observaciones": string | null,"presupuesto_ejecutado": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alcance_total"?: number | null,"campana_id": string,"created_at"?: string | null,"id"?: string,"informe_cualitativo"?: string | null,"interacciones_totales"?: number | null,"observaciones"?: string | null,"presupuesto_ejecutado"?: number | null
                  }
                  Update: {
                    "alcance_total"?: number | null,"campana_id"?: string,"created_at"?: string | null,"id"?: string,"informe_cualitativo"?: string | null,"interacciones_totales"?: number | null,"observaciones"?: string | null,"presupuesto_ejecutado"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "campana_evaluaciones_campana_id_fkey"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    }
                  ]
                },"campanas": {
                  Row: {
                    "activo": boolean | null,"created_at": string | null,"descripcion": string | null,"estatus": string,"estatus_pre_archivado": string | null,"fecha_fin": string,"fecha_inicio": string,"id": string,"nombre": string,"presupuesto": number | null,"tipo_campana": Database["public"]['Enums']["tipo_campana_enum"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean | null,"created_at"?: string | null,"descripcion"?: string | null,"estatus"?: string,"estatus_pre_archivado"?: string | null,"fecha_fin": string,"fecha_inicio": string,"id"?: string,"nombre": string,"presupuesto"?: number | null,"tipo_campana": Database["public"]['Enums']["tipo_campana_enum"]
                  }
                  Update: {
                    "activo"?: boolean | null,"created_at"?: string | null,"descripcion"?: string | null,"estatus"?: string,"estatus_pre_archivado"?: string | null,"fecha_fin"?: string,"fecha_inicio"?: string,"id"?: string,"nombre"?: string,"presupuesto"?: number | null,"tipo_campana"?: Database["public"]['Enums']["tipo_campana_enum"]
                  }
                  Relationships: [

                  ]
                },"catalogo_areas_solicitud": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"codigo": string,"creado_en": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo": string,"creado_en"?: string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo"?: string,"creado_en"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [

                  ]
                },"catalogo_departamentos_solicitud": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"codigo": string,"creado_en": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo": string,"creado_en"?: string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo"?: string,"creado_en"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [

                  ]
                },"catalogo_formatos_entregable": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"categoria": string,"codigo": string,"creado_en": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"categoria": string,"codigo": string,"creado_en"?: string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"categoria"?: string,"codigo"?: string,"creado_en"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [

                  ]
                },"catalogo_medios": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"codigo": string,"creado_en": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo": string,"creado_en"?: string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo"?: string,"creado_en"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [

                  ]
                },"catalogo_tipos_solicitud": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"codigo": string,"creado_en": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo": string,"creado_en"?: string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"codigo"?: string,"creado_en"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [

                  ]
                },"categorias_contenido": {
                  Row: {
                    "codigo": string,"created_at": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"created_at"?: string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "codigo"?: string,"created_at"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [

                  ]
                },"checklist_rodaje": {
                  Row: {
                    "area_tienda": string,"completado": boolean | null,"created_at": string | null,"id": string,"publicacion_id": string,"sucursal": Database["public"]['Enums']["sede_enum"],"toma_requerida": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_tienda": string,"completado"?: boolean | null,"created_at"?: string | null,"id"?: string,"publicacion_id": string,"sucursal": Database["public"]['Enums']["sede_enum"],"toma_requerida": string
                  }
                  Update: {
                    "area_tienda"?: string,"completado"?: boolean | null,"created_at"?: string | null,"id"?: string,"publicacion_id"?: string,"sucursal"?: Database["public"]['Enums']["sede_enum"],"toma_requerida"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_rodaje_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"design_solicitudes_historicas": {
                  Row: {
                    "area_raw": string | null,"completed_at": string | null,"department_raw": string | null,"design_quantity_raw": string | null,"designer_name_raw": string | null,"dimensions": string | null,"due_date": string | null,"id": number,"import_batch": string,"imported_at": string,"material": string | null,"medium_raw": string | null,"objective": string | null,"pieces_quantity_raw": string | null,"print_details_2": string | null,"print_request": string | null,"priority_raw": string | null,"publication_details_2": string | null,"publication_request": string | null,"raw_payload": NonNullable<Json>,"reference_url": string | null,"requester_email": string | null,"requester_name_raw": string | null,"review_reasons": (string)[],"review_required": boolean,"source_row_number": number,"source_timestamp": string | null,"status_raw": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_raw"?: string | null,"completed_at"?: string | null,"department_raw"?: string | null,"design_quantity_raw"?: string | null,"designer_name_raw"?: string | null,"dimensions"?: string | null,"due_date"?: string | null,"id"?: number,"import_batch": string,"imported_at"?: string,"material"?: string | null,"medium_raw"?: string | null,"objective"?: string | null,"pieces_quantity_raw"?: string | null,"print_details_2"?: string | null,"print_request"?: string | null,"priority_raw"?: string | null,"publication_details_2"?: string | null,"publication_request"?: string | null,"raw_payload": NonNullable<Json>,"reference_url"?: string | null,"requester_email"?: string | null,"requester_name_raw"?: string | null,"review_reasons"?: (string)[],"review_required"?: boolean,"source_row_number": number,"source_timestamp"?: string | null,"status_raw"?: string | null,"title": string
                  }
                  Update: {
                    "area_raw"?: string | null,"completed_at"?: string | null,"department_raw"?: string | null,"design_quantity_raw"?: string | null,"designer_name_raw"?: string | null,"dimensions"?: string | null,"due_date"?: string | null,"id"?: number,"import_batch"?: string,"imported_at"?: string,"material"?: string | null,"medium_raw"?: string | null,"objective"?: string | null,"pieces_quantity_raw"?: string | null,"print_details_2"?: string | null,"print_request"?: string | null,"priority_raw"?: string | null,"publication_details_2"?: string | null,"publication_request"?: string | null,"raw_payload"?: NonNullable<Json>,"reference_url"?: string | null,"requester_email"?: string | null,"requester_name_raw"?: string | null,"review_reasons"?: (string)[],"review_required"?: boolean,"source_row_number"?: number,"source_timestamp"?: string | null,"status_raw"?: string | null,"title"?: string
                  }
                  Relationships: [

                  ]
                },"efemerides": {
                  Row: {
                    "anio": number,"created_at": string,"descripcion": string | null,"fecha_fin": string,"fecha_inicio": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anio": number,"created_at"?: string,"descripcion"?: string | null,"fecha_fin": string,"fecha_inicio": string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "anio"?: number,"created_at"?: string,"descripcion"?: string | null,"fecha_fin"?: string,"fecha_inicio"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [

                  ]
                },"evento_drive_uploads": {
                  Row: {
                    "actor_id": string,"carpeta": string,"completed_at": string | null,"created_at": string,"drive_file_id": string | null,"evento_id": string,"expires_at": string,"file_name": string,"file_size": number,"id": string,"mime_type": string,"session_uri": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"carpeta": string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"evento_id": string,"expires_at"?: string,"file_name": string,"file_size": number,"id"?: string,"mime_type": string,"session_uri"?: string | null,"status"?: string
                  }
                  Update: {
                    "actor_id"?: string,"carpeta"?: string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"evento_id"?: string,"expires_at"?: string,"file_name"?: string,"file_size"?: number,"id"?: string,"mime_type"?: string,"session_uri"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_drive_uploads_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    }
                  ]
                },"evento_historial": {
                  Row: {
                    "anterior": NonNullable<Json>,"cambiado_en": string,"cambiado_por": string | null,"evento_id": string,"id": string,"motivo": string | null,"nuevo": NonNullable<Json>,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anterior": NonNullable<Json>,"cambiado_en"?: string,"cambiado_por"?: string | null,"evento_id": string,"id"?: string,"motivo"?: string | null,"nuevo": NonNullable<Json>,"tipo": string
                  }
                  Update: {
                    "anterior"?: NonNullable<Json>,"cambiado_en"?: string,"cambiado_por"?: string | null,"evento_id"?: string,"id"?: string,"motivo"?: string | null,"nuevo"?: NonNullable<Json>,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_historial_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    }
                  ]
                },"evento_sedes": {
                  Row: {
                    "evento_id": string,"sede_id": string,"zona": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"sede_id": string,"zona"?: string | null
                  }
                  Update: {
                    "evento_id"?: string,"sede_id"?: string,"zona"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_sedes_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evento_sedes_sede_id_fkey"
      columns: ["sede_id"]
isOneToOne: false
      referencedRelation: "inventario_sedes"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos": {
                  Row: {
                    "archivado_en": string | null,"archivado_por": string | null,"asistentes_esperados": number | null,"asistentes_reales": number | null,"campana_id": string | null,"creado_en": string,"creado_por": string | null,"descripcion": string | null,"disenador_id": string | null,"diseno_entregado_en": string | null,"diseno_estatus": string | null,"diseno_formatos": (string)[],"diseno_iniciado_en": string | null,"diseno_solicitado_en": string | null,"drive_brief_checked_at": string | null,"drive_brief_file_count": number,"drive_brief_folder_id": string | null,"drive_deliverables_folder_id": string | null,"drive_folder_id": string | null,"drive_folder_url": string | null,"estatus": string,"fecha_entrega_diseno": string | null,"fin": string | null,"gasto_real": number | null,"id": string,"inicio": string | null,"inscripcion_cupo": number | null,"inscripcion_info": string | null,"inscripcion_limite": string | null,"instrucciones_diseno": string | null,"materiales": string | null,"modificado_en": string,"modificado_por": string | null,"moneda": string,"nombre": string,"notas_cierre": string | null,"origen": string,"patrocinadores": string | null,"presupuesto_estimado": number | null,"proveedor_nombre": string | null,"requiere_diseno": boolean,"requiere_inscripcion": boolean,"responsable_id": string | null,"tipo": string,"tipo_otro": string | null,"version": number,"events_flags": Json | null
                  }
                  ComputedFields: "events_flags"
                  Insert: {
                    "archivado_en"?: string | null,"archivado_por"?: string | null,"asistentes_esperados"?: number | null,"asistentes_reales"?: number | null,"campana_id"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"disenador_id"?: string | null,"diseno_entregado_en"?: string | null,"diseno_estatus"?: string | null,"diseno_formatos"?: (string)[],"diseno_iniciado_en"?: string | null,"diseno_solicitado_en"?: string | null,"drive_brief_checked_at"?: string | null,"drive_brief_file_count"?: number,"drive_brief_folder_id"?: string | null,"drive_deliverables_folder_id"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"estatus"?: string,"fecha_entrega_diseno"?: string | null,"fin"?: string | null,"gasto_real"?: number | null,"id"?: string,"inicio"?: string | null,"inscripcion_cupo"?: number | null,"inscripcion_info"?: string | null,"inscripcion_limite"?: string | null,"instrucciones_diseno"?: string | null,"materiales"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"moneda"?: string,"nombre": string,"notas_cierre"?: string | null,"origen": string,"patrocinadores"?: string | null,"presupuesto_estimado"?: number | null,"proveedor_nombre"?: string | null,"requiere_diseno"?: boolean,"requiere_inscripcion"?: boolean,"responsable_id"?: string | null,"tipo": string,"tipo_otro"?: string | null,"version"?: number
                  }
                  Update: {
                    "archivado_en"?: string | null,"archivado_por"?: string | null,"asistentes_esperados"?: number | null,"asistentes_reales"?: number | null,"campana_id"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"disenador_id"?: string | null,"diseno_entregado_en"?: string | null,"diseno_estatus"?: string | null,"diseno_formatos"?: (string)[],"diseno_iniciado_en"?: string | null,"diseno_solicitado_en"?: string | null,"drive_brief_checked_at"?: string | null,"drive_brief_file_count"?: number,"drive_brief_folder_id"?: string | null,"drive_deliverables_folder_id"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"estatus"?: string,"fecha_entrega_diseno"?: string | null,"fin"?: string | null,"gasto_real"?: number | null,"id"?: string,"inicio"?: string | null,"inscripcion_cupo"?: number | null,"inscripcion_info"?: string | null,"inscripcion_limite"?: string | null,"instrucciones_diseno"?: string | null,"materiales"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"moneda"?: string,"nombre"?: string,"notas_cierre"?: string | null,"origen"?: string,"patrocinadores"?: string | null,"presupuesto_estimado"?: number | null,"proveedor_nombre"?: string | null,"requiere_diseno"?: boolean,"requiere_inscripcion"?: boolean,"responsable_id"?: string | null,"tipo"?: string,"tipo_otro"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_campana_id_fkey"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    }
                  ]
                },"general_design_cancellations": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"request_id": string,"requester_id": string,"review_note": string | null,"reviewed_at": string | null,"reviewer_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"request_id": string,"requester_id": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"request_id"?: string,"requester_id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "general_design_cancellations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "general_design_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"general_design_request_history": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"detail": NonNullable<Json>,"id": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"request_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "general_design_request_history_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "general_design_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"general_design_request_uploads": {
                  Row: {
                    "actor_id": string,"category": string,"completed_at": string | null,"created_at": string,"drive_file_id": string | null,"drive_web_url": string | null,"file_name": string,"file_size": number,"id": string,"mime_type": string,"request_id": string,"session_uri": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"category": string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"drive_web_url"?: string | null,"file_name": string,"file_size": number,"id"?: string,"mime_type": string,"request_id": string,"session_uri"?: string | null,"status"?: string
                  }
                  Update: {
                    "actor_id"?: string,"category"?: string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"drive_web_url"?: string | null,"file_name"?: string,"file_size"?: number,"id"?: string,"mime_type"?: string,"request_id"?: string,"session_uri"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "general_design_request_uploads_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "general_design_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"general_design_requests": {
                  Row: {
                    "additional_specifications": string | null,"categories": (string)[],"client_submission_key": string,"created_at": string,"delivered_at": string | null,"department": string,"design_type": string,"design_type_other": string | null,"designer_id": string | null,"drive_error": string | null,"drive_folder_id": string | null,"drive_folder_url": string | null,"drive_status": string,"id": string,"instructions": string,"priority": string,"requester_id": string,"requester_role": string,"required_date": string,"scopes": (string)[],"started_at": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "additional_specifications"?: string | null,"categories"?: (string)[],"client_submission_key"?: string,"created_at"?: string,"delivered_at"?: string | null,"department"?: string,"design_type": string,"design_type_other"?: string | null,"designer_id"?: string | null,"drive_error"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"drive_status"?: string,"id"?: string,"instructions": string,"priority"?: string,"requester_id": string,"requester_role": string,"required_date": string,"scopes"?: (string)[],"started_at"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "additional_specifications"?: string | null,"categories"?: (string)[],"client_submission_key"?: string,"created_at"?: string,"delivered_at"?: string | null,"department"?: string,"design_type"?: string,"design_type_other"?: string | null,"designer_id"?: string | null,"drive_error"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"drive_status"?: string,"id"?: string,"instructions"?: string,"priority"?: string,"requester_id"?: string,"requester_role"?: string,"required_date"?: string,"scopes"?: (string)[],"started_at"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"inventario_articulos": {
                  Row: {
                    "atributos": NonNullable<Json>,"cantidad": number,"categoria_id": string,"codigo": string | null,"condicion": string,"creado_en": string,"creado_por": string | null,"especificaciones": string | null,"id": string,"modificado_en": string,"modificado_por": string | null,"nombre": string,"sede_id": string,"tipo_control": string,"ubicacion_id": string,"unidad_medida": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "atributos"?: NonNullable<Json>,"cantidad"?: number,"categoria_id": string,"codigo"?: string | null,"condicion"?: string,"creado_en"?: string,"creado_por"?: string | null,"especificaciones"?: string | null,"id"?: string,"modificado_en"?: string,"modificado_por"?: string | null,"nombre": string,"sede_id": string,"tipo_control": string,"ubicacion_id": string,"unidad_medida"?: string,"version"?: number
                  }
                  Update: {
                    "atributos"?: NonNullable<Json>,"cantidad"?: number,"categoria_id"?: string,"codigo"?: string | null,"condicion"?: string,"creado_en"?: string,"creado_por"?: string | null,"especificaciones"?: string | null,"id"?: string,"modificado_en"?: string,"modificado_por"?: string | null,"nombre"?: string,"sede_id"?: string,"tipo_control"?: string,"ubicacion_id"?: string,"unidad_medida"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventario_articulos_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "inventario_categorias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_articulos_ubicacion_fkey"
      columns: ["ubicacion_id","sede_id"]
isOneToOne: false
      referencedRelation: "inventario_ubicaciones"
      referencedColumns: ["id","sede_id"]
    }
                  ]
                },"inventario_categorias": {
                  Row: {
                    "activa": boolean,"created_at": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"created_at"?: string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "activa"?: boolean,"created_at"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [

                  ]
                },"inventario_movimientos": {
                  Row: {
                    "articulo_id": string,"cantidad": number,"corrige_movimiento_id": string | null,"destino_articulo_id": string | null,"destino_externo": string | null,"destino_sede_id": string | null,"destino_ubicacion_id": string | null,"estado": string,"fecha_hora": string,"id": string,"observacion": string | null,"origen_externo": string | null,"origen_sede_id": string | null,"origen_ubicacion_id": string | null,"registrado_en": string,"registrado_por": string | null,"saldo_destino": number | null,"saldo_resultante": number,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "articulo_id": string,"cantidad": number,"corrige_movimiento_id"?: string | null,"destino_articulo_id"?: string | null,"destino_externo"?: string | null,"destino_sede_id"?: string | null,"destino_ubicacion_id"?: string | null,"estado"?: string,"fecha_hora"?: string,"id"?: string,"observacion"?: string | null,"origen_externo"?: string | null,"origen_sede_id"?: string | null,"origen_ubicacion_id"?: string | null,"registrado_en"?: string,"registrado_por"?: string | null,"saldo_destino"?: number | null,"saldo_resultante": number,"tipo": string
                  }
                  Update: {
                    "articulo_id"?: string,"cantidad"?: number,"corrige_movimiento_id"?: string | null,"destino_articulo_id"?: string | null,"destino_externo"?: string | null,"destino_sede_id"?: string | null,"destino_ubicacion_id"?: string | null,"estado"?: string,"fecha_hora"?: string,"id"?: string,"observacion"?: string | null,"origen_externo"?: string | null,"origen_sede_id"?: string | null,"origen_ubicacion_id"?: string | null,"registrado_en"?: string,"registrado_por"?: string | null,"saldo_destino"?: number | null,"saldo_resultante"?: number,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventario_movimientos_articulo_id_fkey"
      columns: ["articulo_id"]
isOneToOne: false
      referencedRelation: "inventario_articulos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_movimientos_corrige_movimiento_id_fkey"
      columns: ["corrige_movimiento_id"]
isOneToOne: false
      referencedRelation: "inventario_movimientos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_movimientos_destino_articulo_id_fkey"
      columns: ["destino_articulo_id"]
isOneToOne: false
      referencedRelation: "inventario_articulos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_movimientos_destino_sede_id_fkey"
      columns: ["destino_sede_id"]
isOneToOne: false
      referencedRelation: "inventario_sedes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_movimientos_destino_ubicacion_id_fkey"
      columns: ["destino_ubicacion_id"]
isOneToOne: false
      referencedRelation: "inventario_ubicaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_movimientos_origen_sede_id_fkey"
      columns: ["origen_sede_id"]
isOneToOne: false
      referencedRelation: "inventario_sedes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_movimientos_origen_ubicacion_id_fkey"
      columns: ["origen_ubicacion_id"]
isOneToOne: false
      referencedRelation: "inventario_ubicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"inventario_premios": {
                  Row: {
                    "campana_id": string | null,"cantidad_entregada": number | null,"cantidad_recibida": number | null,"created_at": string | null,"estado_premio": string | null,"id": string,"nombre_premio": string,"proveedor_nombre": string | null,"solicitud_id": string | null,"sucursal_ubicacion": Database["public"]['Enums']["sede_enum"]
                  }
                  ComputedFields: never
                  Insert: {
                    "campana_id"?: string | null,"cantidad_entregada"?: number | null,"cantidad_recibida"?: number | null,"created_at"?: string | null,"estado_premio"?: string | null,"id"?: string,"nombre_premio": string,"proveedor_nombre"?: string | null,"solicitud_id"?: string | null,"sucursal_ubicacion": Database["public"]['Enums']["sede_enum"]
                  }
                  Update: {
                    "campana_id"?: string | null,"cantidad_entregada"?: number | null,"cantidad_recibida"?: number | null,"created_at"?: string | null,"estado_premio"?: string | null,"id"?: string,"nombre_premio"?: string,"proveedor_nombre"?: string | null,"solicitud_id"?: string | null,"sucursal_ubicacion"?: Database["public"]['Enums']["sede_enum"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventario_premios_campana_id_fkey"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventario_premios_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "solicitudes_terceros"
      referencedColumns: ["id"]
    }
                  ]
                },"inventario_sedes": {
                  Row: {
                    "activa": boolean,"codigo": string,"created_at": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"codigo": string,"created_at"?: string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activa"?: boolean,"codigo"?: string,"created_at"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [

                  ]
                },"inventario_ubicaciones": {
                  Row: {
                    "activa": boolean,"created_at": string,"created_by": string | null,"id": string,"nombre": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nombre": string,"sede_id": string
                  }
                  Update: {
                    "activa"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nombre"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventario_ubicaciones_sede_id_fkey"
      columns: ["sede_id"]
isOneToOne: false
      referencedRelation: "inventario_sedes"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_import_batches": {
                  Row: {
                    "batch_key": string,"imported_at": string,"imported_rows": number,"source_name": string,"source_rows": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_key": string,"imported_at"?: string,"imported_rows": number,"source_name": string,"source_rows": number
                  }
                  Update: {
                    "batch_key"?: string,"imported_at"?: string,"imported_rows"?: number,"source_name"?: string,"source_rows"?: number
                  }
                  Relationships: [

                  ]
                },"pendiente_drive_uploads": {
                  Row: {
                    "actor_id": string,"carpeta": string,"completed_at": string | null,"created_at": string,"drive_file_id": string | null,"expires_at": string,"file_name": string,"file_size": number,"id": string,"mime_type": string,"pendiente_id": string,"session_uri": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"carpeta": string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"expires_at"?: string,"file_name": string,"file_size": number,"id"?: string,"mime_type": string,"pendiente_id": string,"session_uri"?: string | null,"status"?: string
                  }
                  Update: {
                    "actor_id"?: string,"carpeta"?: string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"expires_at"?: string,"file_name"?: string,"file_size"?: number,"id"?: string,"mime_type"?: string,"pendiente_id"?: string,"session_uri"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pendiente_drive_uploads_pendiente_id_fkey"
      columns: ["pendiente_id"]
isOneToOne: false
      referencedRelation: "pendientes_tienda"
      referencedColumns: ["id"]
    }
                  ]
                },"pendiente_tienda_historial": {
                  Row: {
                    "anterior": NonNullable<Json>,"cambiado_en": string,"cambiado_por": string | null,"id": string,"motivo": string | null,"nuevo": NonNullable<Json>,"pendiente_id": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anterior"?: NonNullable<Json>,"cambiado_en"?: string,"cambiado_por"?: string | null,"id"?: string,"motivo"?: string | null,"nuevo"?: NonNullable<Json>,"pendiente_id": string,"tipo": string
                  }
                  Update: {
                    "anterior"?: NonNullable<Json>,"cambiado_en"?: string,"cambiado_por"?: string | null,"id"?: string,"motivo"?: string | null,"nuevo"?: NonNullable<Json>,"pendiente_id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pendiente_tienda_historial_pendiente_id_fkey"
      columns: ["pendiente_id"]
isOneToOne: false
      referencedRelation: "pendientes_tienda"
      referencedColumns: ["id"]
    }
                  ]
                },"pendientes_tienda": {
                  Row: {
                    "archivado_en": string | null,"cantidad": number | null,"creado_en": string,"creado_por": string,"detalle": string | null,"disenador_id": string | null,"diseno_entregado_en": string | null,"diseno_estatus": string | null,"diseno_iniciado_en": string | null,"diseno_solicitado_en": string | null,"drive_brief_checked_at": string | null,"drive_brief_file_count": number,"drive_brief_folder_id": string | null,"drive_deliverables_folder_id": string | null,"drive_folder_id": string | null,"drive_folder_url": string | null,"enlace_referencia": string | null,"entregado_en": string | null,"estatus": string,"fecha_entrega_diseno": string | null,"fecha_requerida": string | null,"id": string,"instrucciones_diseno": string | null,"modificado_en": string,"modificado_por": string | null,"requiere_diseno": boolean,"sede_id": string,"tipo": string,"titulo": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archivado_en"?: string | null,"cantidad"?: number | null,"creado_en"?: string,"creado_por": string,"detalle"?: string | null,"disenador_id"?: string | null,"diseno_entregado_en"?: string | null,"diseno_estatus"?: string | null,"diseno_iniciado_en"?: string | null,"diseno_solicitado_en"?: string | null,"drive_brief_checked_at"?: string | null,"drive_brief_file_count"?: number,"drive_brief_folder_id"?: string | null,"drive_deliverables_folder_id"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"enlace_referencia"?: string | null,"entregado_en"?: string | null,"estatus"?: string,"fecha_entrega_diseno"?: string | null,"fecha_requerida"?: string | null,"id"?: string,"instrucciones_diseno"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"requiere_diseno"?: boolean,"sede_id": string,"tipo": string,"titulo": string,"version"?: number
                  }
                  Update: {
                    "archivado_en"?: string | null,"cantidad"?: number | null,"creado_en"?: string,"creado_por"?: string,"detalle"?: string | null,"disenador_id"?: string | null,"diseno_entregado_en"?: string | null,"diseno_estatus"?: string | null,"diseno_iniciado_en"?: string | null,"diseno_solicitado_en"?: string | null,"drive_brief_checked_at"?: string | null,"drive_brief_file_count"?: number,"drive_brief_folder_id"?: string | null,"drive_deliverables_folder_id"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"enlace_referencia"?: string | null,"entregado_en"?: string | null,"estatus"?: string,"fecha_entrega_diseno"?: string | null,"fecha_requerida"?: string | null,"id"?: string,"instrucciones_diseno"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"requiere_diseno"?: boolean,"sede_id"?: string,"tipo"?: string,"titulo"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pendientes_tienda_sede_id_fkey"
      columns: ["sede_id"]
isOneToOne: false
      referencedRelation: "inventario_sedes"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"role_code": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"role_code"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"role_code"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_role_code_fkey"
      columns: ["role_code"]
isOneToOne: false
      referencedRelation: "app_roles"
      referencedColumns: ["code"]
    }
                  ]
                },"publicacion_canales": {
                  Row: {
                    "canal": Database["public"]['Enums']["canal_enum"],"estado_publicacion": string | null,"id": string,"publicacion_id": string,"social_account_id": string | null,"url_publicacion": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "canal": Database["public"]['Enums']["canal_enum"],"estado_publicacion"?: string | null,"id"?: string,"publicacion_id": string,"social_account_id"?: string | null,"url_publicacion"?: string | null
                  }
                  Update: {
                    "canal"?: Database["public"]['Enums']["canal_enum"],"estado_publicacion"?: string | null,"id"?: string,"publicacion_id"?: string,"social_account_id"?: string | null,"url_publicacion"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "publicacion_canales_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publicacion_canales_social_account_id_fkey"
      columns: ["social_account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"publicacion_categorias": {
                  Row: {
                    "categoria_id": string,"created_at": string,"publicacion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_id": string,"created_at"?: string,"publicacion_id": string
                  }
                  Update: {
                    "categoria_id"?: string,"created_at"?: string,"publicacion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publicacion_categorias_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias_contenido"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publicacion_categorias_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"publicacion_comentarios": {
                  Row: {
                    "autor_id": string | null,"creado_en": string,"id": string,"publicacion_id": string,"texto": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id"?: string | null,"creado_en"?: string,"id"?: string,"publicacion_id": string,"texto": string,"tipo"?: string
                  }
                  Update: {
                    "autor_id"?: string | null,"creado_en"?: string,"id"?: string,"publicacion_id"?: string,"texto"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publicacion_comentarios_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"publicacion_drive_uploads": {
                  Row: {
                    "actor_id": string,"carpeta": string,"completed_at": string | null,"created_at": string,"drive_file_id": string | null,"expires_at": string,"file_name": string,"file_size": number,"id": string,"mime_type": string,"publicacion_id": string,"session_uri": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"carpeta"?: string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"expires_at"?: string,"file_name": string,"file_size": number,"id"?: string,"mime_type": string,"publicacion_id": string,"session_uri"?: string | null,"status"?: string
                  }
                  Update: {
                    "actor_id"?: string,"carpeta"?: string,"completed_at"?: string | null,"created_at"?: string,"drive_file_id"?: string | null,"expires_at"?: string,"file_name"?: string,"file_size"?: number,"id"?: string,"mime_type"?: string,"publicacion_id"?: string,"session_uri"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publicacion_drive_uploads_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"publicacion_estatus_historial": {
                  Row: {
                    "cambiado_en": string,"cambiado_por": string | null,"estatus_anterior": Database["public"]['Enums']["estatus_enum"] | null,"estatus_nuevo": Database["public"]['Enums']["estatus_enum"],"id": string,"motivo": string | null,"publicacion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cambiado_en"?: string,"cambiado_por"?: string | null,"estatus_anterior"?: Database["public"]['Enums']["estatus_enum"] | null,"estatus_nuevo": Database["public"]['Enums']["estatus_enum"],"id"?: string,"motivo"?: string | null,"publicacion_id": string
                  }
                  Update: {
                    "cambiado_en"?: string,"cambiado_por"?: string | null,"estatus_anterior"?: Database["public"]['Enums']["estatus_enum"] | null,"estatus_nuevo"?: Database["public"]['Enums']["estatus_enum"],"id"?: string,"motivo"?: string | null,"publicacion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publicacion_estatus_historial_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"publicaciones": {
                  Row: {
                    "body_texto": string | null,"campana_id": string | null,"creador_id": string | null,"created_at": string | null,"cta_texto": string | null,"deleted_at": string | null,"disenador_id": string | null,"drive_brief_checked_at": string | null,"drive_brief_file_count": number,"drive_brief_folder_id": string | null,"drive_cleanup_attempted_at": string | null,"drive_cleanup_error": string | null,"drive_cleanup_status": string,"drive_deleted_at": string | null,"drive_deliverables_folder_id": string | null,"drive_folder_id": string | null,"drive_folder_url": string | null,"drive_preserved_at": string | null,"estatus": Database["public"]['Enums']["estatus_enum"],"fecha_aprobacion_gerencia": string | null,"fecha_entrega_diseno_estimada": string | null,"fecha_entrega_diseno_real": string | null,"fecha_limite_brief": string | null,"fecha_publicacion": string,"fecha_rodaje": string | null,"fecha_solicitud_diseno": string | null,"formato": Database["public"]['Enums']["formato_enum"],"hashtags": (string)[] | null,"hook_texto": string | null,"hora_publicacion": string | null,"id": string,"instrucciones_diseno": string | null,"linea_contenido": string | null,"prioridad": number,"requiere_diseno": boolean,"requiere_rodaje": boolean,"sedes": (Database["public"]['Enums']["sede_enum"])[],"titulo": string,"updated_at": string | null,"version_copy": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_texto"?: string | null,"campana_id"?: string | null,"creador_id"?: string | null,"created_at"?: string | null,"cta_texto"?: string | null,"deleted_at"?: string | null,"disenador_id"?: string | null,"drive_brief_checked_at"?: string | null,"drive_brief_file_count"?: number,"drive_brief_folder_id"?: string | null,"drive_cleanup_attempted_at"?: string | null,"drive_cleanup_error"?: string | null,"drive_cleanup_status"?: string,"drive_deleted_at"?: string | null,"drive_deliverables_folder_id"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"drive_preserved_at"?: string | null,"estatus"?: Database["public"]['Enums']["estatus_enum"],"fecha_aprobacion_gerencia"?: string | null,"fecha_entrega_diseno_estimada"?: string | null,"fecha_entrega_diseno_real"?: string | null,"fecha_limite_brief"?: string | null,"fecha_publicacion": string,"fecha_rodaje"?: string | null,"fecha_solicitud_diseno"?: string | null,"formato": Database["public"]['Enums']["formato_enum"],"hashtags"?: (string)[] | null,"hook_texto"?: string | null,"hora_publicacion"?: string | null,"id"?: string,"instrucciones_diseno"?: string | null,"linea_contenido"?: string | null,"prioridad"?: number,"requiere_diseno"?: boolean,"requiere_rodaje"?: boolean,"sedes"?: (Database["public"]['Enums']["sede_enum"])[],"titulo": string,"updated_at"?: string | null,"version_copy"?: number | null
                  }
                  Update: {
                    "body_texto"?: string | null,"campana_id"?: string | null,"creador_id"?: string | null,"created_at"?: string | null,"cta_texto"?: string | null,"deleted_at"?: string | null,"disenador_id"?: string | null,"drive_brief_checked_at"?: string | null,"drive_brief_file_count"?: number,"drive_brief_folder_id"?: string | null,"drive_cleanup_attempted_at"?: string | null,"drive_cleanup_error"?: string | null,"drive_cleanup_status"?: string,"drive_deleted_at"?: string | null,"drive_deliverables_folder_id"?: string | null,"drive_folder_id"?: string | null,"drive_folder_url"?: string | null,"drive_preserved_at"?: string | null,"estatus"?: Database["public"]['Enums']["estatus_enum"],"fecha_aprobacion_gerencia"?: string | null,"fecha_entrega_diseno_estimada"?: string | null,"fecha_entrega_diseno_real"?: string | null,"fecha_limite_brief"?: string | null,"fecha_publicacion"?: string,"fecha_rodaje"?: string | null,"fecha_solicitud_diseno"?: string | null,"formato"?: Database["public"]['Enums']["formato_enum"],"hashtags"?: (string)[] | null,"hook_texto"?: string | null,"hora_publicacion"?: string | null,"id"?: string,"instrucciones_diseno"?: string | null,"linea_contenido"?: string | null,"prioridad"?: number,"requiere_diseno"?: boolean,"requiere_rodaje"?: boolean,"sedes"?: (Database["public"]['Enums']["sede_enum"])[],"titulo"?: string,"updated_at"?: string | null,"version_copy"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "publicaciones_campana_id_fkey"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    }
                  ]
                },"reporte_atencion_cliente": {
                  Row: {
                    "accion_tomada": string | null,"canal": Database["public"]['Enums']["canal_enum"],"categoria": string | null,"created_at": string | null,"detalle_comentario": string | null,"fecha_semana": string,"id": string,"status": string | null,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accion_tomada"?: string | null,"canal": Database["public"]['Enums']["canal_enum"],"categoria"?: string | null,"created_at"?: string | null,"detalle_comentario"?: string | null,"fecha_semana": string,"id"?: string,"status"?: string | null,"tipo": string
                  }
                  Update: {
                    "accion_tomada"?: string | null,"canal"?: Database["public"]['Enums']["canal_enum"],"categoria"?: string | null,"created_at"?: string | null,"detalle_comentario"?: string | null,"fecha_semana"?: string,"id"?: string,"status"?: string | null,"tipo"?: string
                  }
                  Relationships: [

                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"permission_code": string,"role_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"permission_code": string,"role_code": string
                  }
                  Update: {
                    "created_at"?: string,"permission_code"?: string,"role_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_code_fkey"
      columns: ["permission_code"]
isOneToOne: false
      referencedRelation: "app_permissions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "role_permissions_role_code_fkey"
      columns: ["role_code"]
isOneToOne: false
      referencedRelation: "app_roles"
      referencedColumns: ["code"]
    }
                  ]
                },"social_accounts": {
                  Row: {
                    "active": boolean,"created_at": string,"display_name": string,"handle": string,"id": string,"platform": Database["public"]['Enums']["canal_enum"]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"display_name": string,"handle": string,"id"?: string,"platform": Database["public"]['Enums']["canal_enum"]
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"display_name"?: string,"handle"?: string,"id"?: string,"platform"?: Database["public"]['Enums']["canal_enum"]
                  }
                  Relationships: [

                  ]
                },"solicitud_diseno_entregables": {
                  Row: {
                    "alcance_texto": string | null,"campo_origen": string | null,"cantidad_formatos": number | null,"cantidad_piezas": number | null,"categoria": string | null,"completado_en": string | null,"creado_en": string,"creado_por": string | null,"datos_adicionales": NonNullable<Json>,"estado": string,"fecha_objetivo": string | null,"formato_id": string | null,"formato_original": string | null,"id": string,"material": string | null,"medidas": string | null,"medio_id": string | null,"medio_original": string | null,"modificado_en": string,"modificado_por": string | null,"orden": number,"pieza": string,"solicitud_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alcance_texto"?: string | null,"campo_origen"?: string | null,"cantidad_formatos"?: number | null,"cantidad_piezas"?: number | null,"categoria"?: string | null,"completado_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"datos_adicionales"?: NonNullable<Json>,"estado": string,"fecha_objetivo"?: string | null,"formato_id"?: string | null,"formato_original"?: string | null,"id"?: string,"material"?: string | null,"medidas"?: string | null,"medio_id"?: string | null,"medio_original"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"orden": number,"pieza": string,"solicitud_id": string,"version"?: number
                  }
                  Update: {
                    "alcance_texto"?: string | null,"campo_origen"?: string | null,"cantidad_formatos"?: number | null,"cantidad_piezas"?: number | null,"categoria"?: string | null,"completado_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"datos_adicionales"?: NonNullable<Json>,"estado"?: string,"fecha_objetivo"?: string | null,"formato_id"?: string | null,"formato_original"?: string | null,"id"?: string,"material"?: string | null,"medidas"?: string | null,"medio_id"?: string | null,"medio_original"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"orden"?: number,"pieza"?: string,"solicitud_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitud_diseno_entregables_formato_id_fkey"
      columns: ["formato_id"]
isOneToOne: false
      referencedRelation: "catalogo_formatos_entregable"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_diseno_entregables_medio_id_fkey"
      columns: ["medio_id"]
isOneToOne: false
      referencedRelation: "catalogo_medios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_diseno_entregables_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "solicitudes_diseno"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitud_diseno_historial": {
                  Row: {
                    "anterior": NonNullable<Json>,"cambiado_en": string,"cambiado_por": string | null,"entregable_id": string | null,"id": string,"motivo": string | null,"nuevo": NonNullable<Json>,"solicitud_id": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anterior"?: NonNullable<Json>,"cambiado_en"?: string,"cambiado_por"?: string | null,"entregable_id"?: string | null,"id"?: string,"motivo"?: string | null,"nuevo"?: NonNullable<Json>,"solicitud_id": string,"tipo": string
                  }
                  Update: {
                    "anterior"?: NonNullable<Json>,"cambiado_en"?: string,"cambiado_por"?: string | null,"entregable_id"?: string | null,"id"?: string,"motivo"?: string | null,"nuevo"?: NonNullable<Json>,"solicitud_id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitud_diseno_historial_entregable_id_fkey"
      columns: ["entregable_id"]
isOneToOne: false
      referencedRelation: "solicitud_diseno_entregables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_diseno_historial_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "solicitudes_diseno"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitud_diseno_importacion_filas": {
                  Row: {
                    "advertencias": NonNullable<Json>,"creado_en": string,"datos_originales": NonNullable<Json>,"errores": NonNullable<Json>,"fila_origen": number,"hoja": string,"huella": string,"id": string,"lote_id": string,"resultado": string,"resultado_previo_reversion": string | null,"solicitud_id": string | null,"solicitud_id_revertida": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "advertencias"?: NonNullable<Json>,"creado_en"?: string,"datos_originales": NonNullable<Json>,"errores"?: NonNullable<Json>,"fila_origen": number,"hoja": string,"huella": string,"id"?: string,"lote_id": string,"resultado": string,"resultado_previo_reversion"?: string | null,"solicitud_id"?: string | null,"solicitud_id_revertida"?: string | null
                  }
                  Update: {
                    "advertencias"?: NonNullable<Json>,"creado_en"?: string,"datos_originales"?: NonNullable<Json>,"errores"?: NonNullable<Json>,"fila_origen"?: number,"hoja"?: string,"huella"?: string,"id"?: string,"lote_id"?: string,"resultado"?: string,"resultado_previo_reversion"?: string | null,"solicitud_id"?: string | null,"solicitud_id_revertida"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitud_diseno_importacion_filas_lote_id_fkey"
      columns: ["lote_id"]
isOneToOne: false
      referencedRelation: "solicitud_diseno_importaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_diseno_importacion_filas_solicitud_fk"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "solicitudes_diseno"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitud_diseno_importaciones": {
                  Row: {
                    "archivo_nombre": string,"archivo_sha256": string,"clave_lote": string,"estado": string,"filas_origen": number,"finalizado_en": string | null,"hoja": string,"id": string,"iniciado_en": string,"iniciado_por": string | null,"intento": number,"modo": string,"resumen": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo_nombre": string,"archivo_sha256": string,"clave_lote": string,"estado": string,"filas_origen": number,"finalizado_en"?: string | null,"hoja": string,"id"?: string,"iniciado_en"?: string,"iniciado_por"?: string | null,"intento": number,"modo": string,"resumen"?: NonNullable<Json>
                  }
                  Update: {
                    "archivo_nombre"?: string,"archivo_sha256"?: string,"clave_lote"?: string,"estado"?: string,"filas_origen"?: number,"finalizado_en"?: string | null,"hoja"?: string,"id"?: string,"iniciado_en"?: string,"iniciado_por"?: string | null,"intento"?: number,"modo"?: string,"resumen"?: NonNullable<Json>
                  }
                  Relationships: [

                  ]
                },"solicitudes_diseno": {
                  Row: {
                    "alcance_original": string | null,"area_id": string | null,"area_original": string | null,"creado_en": string,"creado_por": string | null,"departamento_id": string | null,"departamento_original": string | null,"ejecutor_historico_nombre": string | null,"ejecutor_historico_usuario_id": string | null,"estado": string,"estado_historico_original": string | null,"fecha_objetivo": string | null,"fecha_objetivo_original": string | null,"fecha_termino_historica": string | null,"fecha_termino_original": string | null,"id": string,"importacion_fila_id": string | null,"modificado_en": string,"modificado_por": string | null,"motivo_cierre": string | null,"motivos_revision": (string)[],"objetivo": string | null,"origen": string,"prioridad": string | null,"prioridad_original": string | null,"referencia_manual": string | null,"referencias_originales": string | null,"referencias_urls": (string)[],"requiere_revision": boolean,"responsable_actual_id": string | null,"solicitada_en_original": string | null,"solicitante_nombre_original": string | null,"solicitante_usuario_id": string | null,"tipo_id": string | null,"titulo": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alcance_original"?: string | null,"area_id"?: string | null,"area_original"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"departamento_id"?: string | null,"departamento_original"?: string | null,"ejecutor_historico_nombre"?: string | null,"ejecutor_historico_usuario_id"?: string | null,"estado": string,"estado_historico_original"?: string | null,"fecha_objetivo"?: string | null,"fecha_objetivo_original"?: string | null,"fecha_termino_historica"?: string | null,"fecha_termino_original"?: string | null,"id"?: string,"importacion_fila_id"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"motivo_cierre"?: string | null,"motivos_revision"?: (string)[],"objetivo"?: string | null,"origen": string,"prioridad"?: string | null,"prioridad_original"?: string | null,"referencia_manual"?: string | null,"referencias_originales"?: string | null,"referencias_urls"?: (string)[],"requiere_revision"?: boolean,"responsable_actual_id"?: string | null,"solicitada_en_original"?: string | null,"solicitante_nombre_original"?: string | null,"solicitante_usuario_id"?: string | null,"tipo_id"?: string | null,"titulo": string,"version"?: number
                  }
                  Update: {
                    "alcance_original"?: string | null,"area_id"?: string | null,"area_original"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"departamento_id"?: string | null,"departamento_original"?: string | null,"ejecutor_historico_nombre"?: string | null,"ejecutor_historico_usuario_id"?: string | null,"estado"?: string,"estado_historico_original"?: string | null,"fecha_objetivo"?: string | null,"fecha_objetivo_original"?: string | null,"fecha_termino_historica"?: string | null,"fecha_termino_original"?: string | null,"id"?: string,"importacion_fila_id"?: string | null,"modificado_en"?: string,"modificado_por"?: string | null,"motivo_cierre"?: string | null,"motivos_revision"?: (string)[],"objetivo"?: string | null,"origen"?: string,"prioridad"?: string | null,"prioridad_original"?: string | null,"referencia_manual"?: string | null,"referencias_originales"?: string | null,"referencias_urls"?: (string)[],"requiere_revision"?: boolean,"responsable_actual_id"?: string | null,"solicitada_en_original"?: string | null,"solicitante_nombre_original"?: string | null,"solicitante_usuario_id"?: string | null,"tipo_id"?: string | null,"titulo"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitudes_diseno_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "catalogo_areas_solicitud"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitudes_diseno_departamento_id_fkey"
      columns: ["departamento_id"]
isOneToOne: false
      referencedRelation: "catalogo_departamentos_solicitud"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitudes_diseno_importacion_fila_id_fkey"
      columns: ["importacion_fila_id"]
isOneToOne: true
      referencedRelation: "solicitud_diseno_importacion_filas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitudes_diseno_tipo_id_fkey"
      columns: ["tipo_id"]
isOneToOne: false
      referencedRelation: "catalogo_tipos_solicitud"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitudes_terceros": {
                  Row: {
                    "created_at": string | null,"departamento_emisor": Database["public"]['Enums']["departamento_enum"],"descripcion": string | null,"estatus_solicitud": string | null,"id": string,"materiales_adjuntos_url": (string)[] | null,"publicacion_id": string | null,"tipo_solicitud": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"departamento_emisor": Database["public"]['Enums']["departamento_enum"],"descripcion"?: string | null,"estatus_solicitud"?: string | null,"id"?: string,"materiales_adjuntos_url"?: (string)[] | null,"publicacion_id"?: string | null,"tipo_solicitud": string
                  }
                  Update: {
                    "created_at"?: string | null,"departamento_emisor"?: Database["public"]['Enums']["departamento_enum"],"descripcion"?: string | null,"estatus_solicitud"?: string | null,"id"?: string,"materiales_adjuntos_url"?: (string)[] | null,"publicacion_id"?: string | null,"tipo_solicitud"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitudes_terceros_publicacion_id_fkey"
      columns: ["publicacion_id"]
isOneToOne: false
      referencedRelation: "publicaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"user_social_accounts": {
                  Row: {
                    "assigned_at": string,"social_account_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"social_account_id": string,"user_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"social_account_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_social_accounts_social_account_id_fkey"
      columns: ["social_account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_solicitud_diseno_entregable":
{ Args: { "p_data": Json,"p_solicitud_id": string }; Returns: string
                           },
"archive_event":
{ Args: { "p_evento_id": string,"p_expected_version": number }; Returns: number
                           },
"archive_publication":
{ Args: { "p_publicacion_id": string }; Returns: boolean
                           },
"archive_store_task":
{ Args: { "p_id": string,"p_version": number }; Returns: {
              "archivado_en": string | null,
"cantidad": number | null,
"creado_en": string,
"creado_por": string,
"detalle": string | null,
"disenador_id": string | null,
"diseno_entregado_en": string | null,
"diseno_estatus": string | null,
"diseno_iniciado_en": string | null,
"diseno_solicitado_en": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"enlace_referencia": string | null,
"entregado_en": string | null,
"estatus": string,
"fecha_entrega_diseno": string | null,
"fecha_requerida": string | null,
"id": string,
"instrucciones_diseno": string | null,
"modificado_en": string,
"modificado_por": string | null,
"requiere_diseno": boolean,
"sede_id": string,
"tipo": string,
"titulo": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "pendientes_tienda"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_manage_access":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"check_event_overlap":
{ Args: { "p_evento_id": string,"p_fin": string,"p_inicio": string,"p_sede_ids": (string)[] }; Returns: {
              "estatus": string,"evento_id": string,"fin": string,"inicio": string,"nombre": string,"sede_id": string,"sede_nombre": string
            }[]
                           },
"claim_expired_publication_purges":
{ Args: Record<PropertyKey, never>; Returns: {
              "drive_folder_id": string,"drive_folder_url": string,"id": string
            }[]
                           },
"create_event":
{ Args: { "p_confirmar_cruce"?: boolean,"p_datos": Json }; Returns: string
                           },
"create_event_with_design":
{ Args: { "p_confirmar_cruce"?: boolean,"p_datos": Json }; Returns: string
                           },
"create_inventory_item":
{ Args: { "p_atributos"?: Json,"p_cantidad": number,"p_categoria_id": string,"p_codigo": string,"p_condicion": string,"p_confirmar_duplicado"?: boolean,"p_especificaciones": string,"p_nombre": string,"p_observacion"?: string,"p_tipo_control": string,"p_ubicacion_id": string,"p_unidad_medida": string }; Returns: string
                           },
"create_inventory_location":
{ Args: { "p_nombre": string,"p_sede_id": string }; Returns: string
                           },
"create_publicacion_with_relations":
{ Args: { "p_body_texto": string,"p_campana_id": string,"p_categoria_ids": (string)[],"p_cta_texto": string,"p_drive_folder_id": string,"p_drive_folder_url": string,"p_fecha_limite_brief": string,"p_fecha_publicacion": string,"p_formato": Database["public"]['Enums']["formato_enum"],"p_hashtags": (string)[],"p_hook_texto": string,"p_social_account_ids": (string)[],"p_titulo": string }; Returns: Json
                           },
"create_solicitud_diseno":
{ Args: { "p_data": Json }; Returns: string
                           },
"create_store_tasks":
{ Args: { "p_data": Json,"p_sede_ids": (string)[] }; Returns: {
              "archivado_en": string | null,
"cantidad": number | null,
"creado_en": string,
"creado_por": string,
"detalle": string | null,
"disenador_id": string | null,
"diseno_entregado_en": string | null,
"diseno_estatus": string | null,
"diseno_iniciado_en": string | null,
"diseno_solicitado_en": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"enlace_referencia": string | null,
"entregado_en": string | null,
"estatus": string,
"fecha_entrega_diseno": string | null,
"fecha_requerida": string | null,
"id": string,
"instrucciones_diseno": string | null,
"modificado_en": string,
"modificado_por": string | null,
"requiere_diseno": boolean,
"sede_id": string,
"tipo": string,
"titulo": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "pendientes_tienda"
        isOneToOne: false
        isSetofReturn: true
      } },
"design_can_see_publication":
{ Args: { "p_id": string }; Returns: boolean
                           },
"design_deliver_event_request":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"design_deliver_internal_request":
{ Args: { "p_pendiente_id": string }; Returns: undefined
                           },
"design_reopen_event_request":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"design_reopen_internal_request":
{ Args: { "p_pendiente_id": string }; Returns: undefined
                           },
"design_solicitudes_require":
{ Args: { "p_permission": string }; Returns: undefined
                           },
"design_start_event_request":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"design_start_internal_request":
{ Args: { "p_pendiente_id": string }; Returns: undefined
                           },
"events_assert_ready":
{ Args: { "p_check_future": boolean,"p_fin": string,"p_inicio": string,"p_responsable_id": string }; Returns: undefined
                           },
"events_find_overlaps":
{ Args: { "p_evento_id": string,"p_fin": string,"p_inicio": string,"p_sede_ids": (string)[] }; Returns: {
              "estatus": string,"evento_id": string,"fin": string,"inicio": string,"nombre": string,"sede_id": string,"sede_nombre": string
            }[]
                           },
"events_flags":
{ Args: { "e": Omit<Database["public"]['Tables']["eventos"]['Row'], Database["public"]['Tables']["eventos"]['ComputedFields']> }; Returns: Json
                           },
"events_normalize":
{ Args: { "p_datos": Json }; Returns: Json
                           },
"events_raise_if_overlap":
{ Args: { "p_confirmar": boolean,"p_evento_id": string,"p_fin": string,"p_inicio": string,"p_sede_ids": (string)[] }; Returns: undefined
                           },
"events_require":
{ Args: { "p_permission": string }; Returns: undefined
                           },
"events_sede_names":
{ Args: { "p_ids": (string)[] }; Returns: Json
                           },
"get_design_event_history":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: {
              "disenador_id": string,"diseno_entregado_en": string,"diseno_estatus": string,"diseno_solicitado_en": string,"fecha_entrega_diseno": string,"id": string,"nombre": string
            }[]
                           },
"get_design_event_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "disenador_id": string,"diseno_entregado_en": string,"diseno_estatus": string,"diseno_formatos": (string)[],"diseno_iniciado_en": string,"diseno_solicitado_en": string,"drive_brief_file_count": number,"drive_brief_folder_id": string,"drive_deliverables_folder_id": string,"drive_folder_id": string,"fecha_entrega_diseno": string,"fin": string,"id": string,"inicio": string,"instrucciones_diseno": string,"nombre": string,"sedes": Json
            }[]
                           },
"get_design_event_request":
{ Args: { "p_evento_id": string }; Returns: {
              "creado_en": string,"creado_por": string,"disenador_id": string,"disenador_nombre": string,"diseno_entregado_en": string,"diseno_estatus": string,"diseno_formatos": (string)[],"diseno_iniciado_en": string,"diseno_solicitado_en": string,"drive_brief_file_count": number,"drive_brief_folder_id": string,"drive_deliverables_folder_id": string,"drive_folder_id": string,"estatus": string,"fecha_entrega_diseno": string,"fin": string,"id": string,"inicio": string,"instrucciones_diseno": string,"nombre": string,"sedes": Json
            }[]
                           },
"get_design_event_timeline":
{ Args: { "p_id": string }; Returns: {
              "at": string,"label": string,"note": string
            }[]
                           },
"get_design_internal_history":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: {
              "disenador_id": string,"diseno_entregado_en": string,"diseno_estatus": string,"diseno_solicitado_en": string,"estatus_pendiente": string,"id": string,"sede_nombre": string,"tipo": string,"titulo": string,"total_count": number
            }[]
                           },
"get_design_internal_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "cantidad": number,"disenador_id": string,"diseno_estatus": string,"diseno_iniciado_en": string,"diseno_solicitado_en": string,"drive_brief_folder_id": string,"drive_deliverables_folder_id": string,"drive_folder_id": string,"fecha_entrega_diseno": string,"id": string,"instrucciones_diseno": string,"sede_nombre": string,"tipo": string,"titulo": string
            }[]
                           },
"get_design_internal_request":
{ Args: { "p_pendiente_id": string }; Returns: {
              "cantidad": number,"creado_en": string,"disenador_id": string,"disenador_nombre": string,"diseno_entregado_en": string,"diseno_estatus": string,"diseno_iniciado_en": string,"diseno_solicitado_en": string,"drive_brief_folder_id": string,"drive_deliverables_folder_id": string,"drive_folder_id": string,"fecha_entrega_diseno": string,"fecha_requerida": string,"id": string,"instrucciones_diseno": string,"sede_nombre": string,"tipo": string,"titulo": string
            }[]
                           },
"get_design_internal_timeline":
{ Args: { "p_id": string }; Returns: {
              "at": string,"label": string,"note": string
            }[]
                           },
"get_design_publication_channels":
{ Args: { "p_ids": (string)[] }; Returns: {
              "canal": string,"publicacion_id": string
            }[]
                           },
"get_design_publication_comments":
{ Args: { "p_ids": (string)[] }; Returns: {
              "creado_en": string,"id": string,"publicacion_id": string,"texto": string,"tipo": string
            }[]
                           },
"get_design_publication_history":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: {
              "body_texto": string | null,
"campana_id": string | null,
"creador_id": string | null,
"created_at": string | null,
"cta_texto": string | null,
"deleted_at": string | null,
"disenador_id": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_cleanup_attempted_at": string | null,
"drive_cleanup_error": string | null,
"drive_cleanup_status": string,
"drive_deleted_at": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"drive_preserved_at": string | null,
"estatus": Database["public"]['Enums']["estatus_enum"],
"fecha_aprobacion_gerencia": string | null,
"fecha_entrega_diseno_estimada": string | null,
"fecha_entrega_diseno_real": string | null,
"fecha_limite_brief": string | null,
"fecha_publicacion": string,
"fecha_rodaje": string | null,
"fecha_solicitud_diseno": string | null,
"formato": Database["public"]['Enums']["formato_enum"],
"hashtags": (string)[] | null,
"hook_texto": string | null,
"hora_publicacion": string | null,
"id": string,
"instrucciones_diseno": string | null,
"linea_contenido": string | null,
"prioridad": number,
"requiere_diseno": boolean,
"requiere_rodaje": boolean,
"sedes": (Database["public"]['Enums']["sede_enum"])[],
"titulo": string,
"updated_at": string | null,
"version_copy": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "publicaciones"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_design_publication_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "body_texto": string | null,
"campana_id": string | null,
"creador_id": string | null,
"created_at": string | null,
"cta_texto": string | null,
"deleted_at": string | null,
"disenador_id": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_cleanup_attempted_at": string | null,
"drive_cleanup_error": string | null,
"drive_cleanup_status": string,
"drive_deleted_at": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"drive_preserved_at": string | null,
"estatus": Database["public"]['Enums']["estatus_enum"],
"fecha_aprobacion_gerencia": string | null,
"fecha_entrega_diseno_estimada": string | null,
"fecha_entrega_diseno_real": string | null,
"fecha_limite_brief": string | null,
"fecha_publicacion": string,
"fecha_rodaje": string | null,
"fecha_solicitud_diseno": string | null,
"formato": Database["public"]['Enums']["formato_enum"],
"hashtags": (string)[] | null,
"hook_texto": string | null,
"hora_publicacion": string | null,
"id": string,
"instrucciones_diseno": string | null,
"linea_contenido": string | null,
"prioridad": number,
"requiere_diseno": boolean,
"requiere_rodaje": boolean,
"sedes": (Database["public"]['Enums']["sede_enum"])[],
"titulo": string,
"updated_at": string | null,
"version_copy": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "publicaciones"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_design_publication_request":
{ Args: { "p_id": string }; Returns: {
              "body_texto": string | null,
"campana_id": string | null,
"creador_id": string | null,
"created_at": string | null,
"cta_texto": string | null,
"deleted_at": string | null,
"disenador_id": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_cleanup_attempted_at": string | null,
"drive_cleanup_error": string | null,
"drive_cleanup_status": string,
"drive_deleted_at": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"drive_preserved_at": string | null,
"estatus": Database["public"]['Enums']["estatus_enum"],
"fecha_aprobacion_gerencia": string | null,
"fecha_entrega_diseno_estimada": string | null,
"fecha_entrega_diseno_real": string | null,
"fecha_limite_brief": string | null,
"fecha_publicacion": string,
"fecha_rodaje": string | null,
"fecha_solicitud_diseno": string | null,
"formato": Database["public"]['Enums']["formato_enum"],
"hashtags": (string)[] | null,
"hook_texto": string | null,
"hora_publicacion": string | null,
"id": string,
"instrucciones_diseno": string | null,
"linea_contenido": string | null,
"prioridad": number,
"requiere_diseno": boolean,
"requiere_rodaje": boolean,
"sedes": (Database["public"]['Enums']["sede_enum"])[],
"titulo": string,
"updated_at": string | null,
"version_copy": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "publicaciones"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_design_publication_timeline":
{ Args: { "p_id": string }; Returns: {
              "at": string,"label": string,"note": string
            }[]
                           },
"get_event":
{ Args: { "p_evento_id": string }; Returns: {
              "archivado_en": string,"asistentes_esperados": number,"asistentes_reales": number,"campana_id": string,"creado_en": string,"creado_por": string,"creado_por_nombre": string,"cruces": Json,"descripcion": string,"estatus": string,"fin": string,"gasto_real": number,"id": string,"indicadores": Json,"inicio": string,"inscripcion_cupo": number,"inscripcion_info": string,"inscripcion_limite": string,"materiales": string,"modificado_en": string,"modificado_por": string,"modificado_por_nombre": string,"moneda": string,"nombre": string,"notas_cierre": string,"origen": string,"patrocinadores": string,"presupuesto_estimado": number,"proveedor_nombre": string,"requiere_inscripcion": boolean,"responsable_id": string,"responsable_nombre": string,"sedes": Json,"tipo": string,"tipo_otro": string,"version": number
            }[]
                           },
"get_event_design_data":
{ Args: { "p_evento_id": string }; Returns: {
              "disenador_id": string,"disenador_nombre": string,"diseno_entregado_en": string,"diseno_estatus": string,"diseno_formatos": (string)[],"diseno_iniciado_en": string,"diseno_solicitado_en": string,"drive_brief_file_count": number,"drive_brief_folder_id": string,"drive_deliverables_folder_id": string,"drive_folder_id": string,"fecha_entrega_diseno": string,"instrucciones_diseno": string,"requiere_diseno": boolean
            }[]
                           },
"get_event_history":
{ Args: { "p_evento_id": string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "anterior": Json,"cambiado_en": string,"cambiado_por": string,"cambiado_por_nombre": string,"id": string,"motivo": string,"nuevo": Json,"tipo": string,"total_count": number
            }[]
                           },
"get_inventory_item_activity":
{ Args: { "p_articulo_id": string,"p_limit"?: number,"p_offset"?: number,"p_tipo"?: string }; Returns: {
              "cantidad": number,"corrige_movimiento_id": string,"delta": number,"destino_externo": string,"destino_sede_nombre": string,"destino_ubicacion_nombre": string,"estado": string,"fecha_hora": string,"id": string,"observacion": string,"origen_externo": string,"origen_sede_nombre": string,"origen_ubicacion_nombre": string,"registrado_en": string,"registrado_por": string,"registrado_por_nombre": string,"saldo": number,"tipo": string,"total_count": number
            }[]
                           },
"get_inventory_sede_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "sede_id": string,"total": number
            }[]
                           },
"get_pendiente_designer_names":
{ Args: { "p_ids": (string)[] }; Returns: {
              "full_name": string,"user_id": string
            }[]
                           },
"get_publication_designer_names":
{ Args: { "p_ids": (string)[] }; Returns: {
              "disenador_id": string,"full_name": string,"publicacion_id": string
            }[]
                           },
"get_store_task":
{ Args: { "p_id": string }; Returns: Json
                           },
"has_permission":
{ Args: { "required_permission": string }; Returns: boolean
                           },
"has_role":
{ Args: { "required_role": string }; Returns: boolean
                           },
"import_solicitud_diseno_fila":
{ Args: { "p_advertencias": Json,"p_datos_originales": Json,"p_entregables": Json,"p_errores": Json,"p_fila_origen": number,"p_huella": string,"p_lote_id": string,"p_resultado": string,"p_solicitud": Json }; Returns: Json
                           },
"internal_require":
{ Args: { "p_permission": string }; Returns: undefined
                           },
"inventory_add_to_stock_row":
{ Args: { "p_actor": string,"p_cantidad": number,"p_sede_id": string,"p_source": Omit<Database["public"]['Tables']["inventario_articulos"]['Row'], Database["public"]['Tables']["inventario_articulos"]['ComputedFields']>,"p_ubicacion_id": string }; Returns: {
              "atributos": NonNullable<Json>,
"cantidad": number,
"categoria_id": string,
"codigo": string | null,
"condicion": string,
"creado_en": string,
"creado_por": string | null,
"especificaciones": string | null,
"id": string,
"modificado_en": string,
"modificado_por": string | null,
"nombre": string,
"sede_id": string,
"tipo_control": string,
"ubicacion_id": string,
"unidad_medida": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "inventario_articulos"
        isOneToOne: true
        isSetofReturn: false
      } },
"inventory_require":
{ Args: { "p_permission": string }; Returns: undefined
                           },
"list_event_campaigns":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"nombre": string
            }[]
                           },
"list_event_responsables":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_name": string,"user_id": string
            }[]
                           },
"list_events":
{ Args: { "p_archivados"?: boolean,"p_desde"?: string,"p_dir"?: string,"p_estatus"?: string,"p_hasta"?: string,"p_limit"?: number,"p_offset"?: number,"p_origen"?: string,"p_responsable_id"?: string,"p_search"?: string,"p_sede_id"?: string,"p_tipo"?: string }; Returns: {
              "archivado_en": string,"con_patrocinio": boolean,"estatus": string,"fin": string,"hay_cruce": boolean,"id": string,"indicadores": Json,"inicio": string,"moneda": string,"nombre": string,"origen": string,"presupuesto_estimado": number,"proveedor_nombre": string,"requiere_inscripcion": boolean,"responsable_id": string,"responsable_nombre": string,"sedes": Json,"tiene_materiales": boolean,"tipo": string,"tipo_otro": string,"total_count": number,"version": number
            }[]
                           },
"list_internal_stores":
{ Args: Record<PropertyKey, never>; Returns: {
              "codigo": string,"id": string,"nombre": string
            }[]
                           },
"list_inventory_items":
{ Args: { "p_articulo_id"?: string,"p_categoria_id"?: string,"p_condicion"?: string,"p_dir"?: string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_sede_id"?: string,"p_sort"?: string,"p_tipo_control"?: string,"p_ubicacion_id"?: string }; Returns: {
              "atributos": Json,"cantidad": number,"categoria_id": string,"categoria_nombre": string,"codigo": string,"condicion": string,"creado_en": string,"creado_por": string,"creado_por_nombre": string,"especificaciones": string,"id": string,"modificado_en": string,"modificado_por": string,"modificado_por_nombre": string,"nombre": string,"sede_id": string,"sede_nombre": string,"tipo_control": string,"total_count": number,"ubicacion_id": string,"ubicacion_nombre": string,"unidad_medida": string,"version": number
            }[]
                           },
"list_solicitud_diseno_responsables":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_name": string,"user_id": string
            }[]
                           },
"list_store_tasks":
{ Args: { "p_archived"?: boolean,"p_estatus"?: string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_sede_id"?: string,"p_tipo"?: string }; Returns: {
              "archivado_en": string,"cantidad": number,"creado_en": string,"detalle": string,"diseno_estatus": string,"drive_brief_file_count": number,"enlace_referencia": string,"estatus": string,"fecha_entrega_diseno": string,"fecha_requerida": string,"id": string,"instrucciones_diseno": string,"requiere_diseno": boolean,"sede_id": string,"sede_nombre": string,"tipo": string,"titulo": string,"total_count": number,"version": number
            }[]
                           },
"publicacion_acceso_cuentas":
{ Args: { "p_id": string }; Returns: {
              "asignadas": number,"puede_editar": boolean,"total": number
            }[]
                           },
"register_inventory_movement":
{ Args: { "p_articulo_id": string,"p_cantidad": number,"p_destino_ubicacion_id"?: string,"p_expected_version": number,"p_externo"?: string,"p_fecha_hora"?: string,"p_observacion"?: string,"p_tipo": string }; Returns: Json
                           },
"replace_publicacion_categorias":
{ Args: { "p_categoria_ids": (string)[],"p_publicacion_id": string }; Returns: undefined
                           },
"request_event_design_correction":
{ Args: { "p_evento_id": string,"p_reason": string }; Returns: undefined
                           },
"request_evento_to_design":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"request_pendiente_design_correction":
{ Args: { "p_pendiente_id": string,"p_reason": string }; Returns: undefined
                           },
"request_pendiente_to_design":
{ Args: { "p_actor_id": string,"p_pendiente_id": string }; Returns: undefined
                           },
"request_publication_to_design":
{ Args: { "p_actor_id": string,"p_publication_id": string }; Returns: {
              "body_texto": string | null,
"campana_id": string | null,
"creador_id": string | null,
"created_at": string | null,
"cta_texto": string | null,
"deleted_at": string | null,
"disenador_id": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_cleanup_attempted_at": string | null,
"drive_cleanup_error": string | null,
"drive_cleanup_status": string,
"drive_deleted_at": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"drive_preserved_at": string | null,
"estatus": Database["public"]['Enums']["estatus_enum"],
"fecha_aprobacion_gerencia": string | null,
"fecha_entrega_diseno_estimada": string | null,
"fecha_entrega_diseno_real": string | null,
"fecha_limite_brief": string | null,
"fecha_publicacion": string,
"fecha_rodaje": string | null,
"fecha_solicitud_diseno": string | null,
"formato": Database["public"]['Enums']["formato_enum"],
"hashtags": (string)[] | null,
"hook_texto": string | null,
"hora_publicacion": string | null,
"id": string,
"instrucciones_diseno": string | null,
"linea_contenido": string | null,
"prioridad": number,
"requiere_diseno": boolean,
"requiere_rodaje": boolean,
"sedes": (Database["public"]['Enums']["sede_enum"])[],
"titulo": string,
"updated_at": string | null,
"version_copy": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "publicaciones"
        isOneToOne: true
        isSetofReturn: false
      } },
"reschedule_event":
{ Args: { "p_confirmar_cruce"?: boolean,"p_evento_id": string,"p_expected_version": number,"p_fin": string,"p_inicio": string,"p_motivo"?: string }; Returns: number
                           },
"reserve_evento_brief_upload":
{ Args: { "p_actor_id": string,"p_evento_id": string,"p_file_name": string,"p_file_size": number,"p_mime_type": string }; Returns: string
                           },
"reserve_evento_deliverable_upload":
{ Args: { "p_actor_id": string,"p_evento_id": string,"p_file_name": string,"p_file_size": number,"p_mime_type": string }; Returns: string
                           },
"reserve_pendiente_brief_upload":
{ Args: { "p_actor_id": string,"p_file_name": string,"p_file_size": number,"p_mime_type": string,"p_pendiente_id": string }; Returns: string
                           },
"reserve_pendiente_deliverable_upload":
{ Args: { "p_actor_id": string,"p_file_name": string,"p_file_size": number,"p_mime_type": string,"p_pendiente_id": string }; Returns: string
                           },
"reserve_publication_brief_upload":
{ Args: { "p_actor_id": string,"p_file_name": string,"p_file_size": number,"p_mime_type": string,"p_publication_id": string }; Returns: string
                           },
"reserve_publication_deliverable_upload":
{ Args: { "p_actor_id": string,"p_drive_file_count": number,"p_file_name": string,"p_file_size": number,"p_mime_type": string,"p_publication_id": string }; Returns: string
                           },
"restore_archived_publication":
{ Args: { "p_publicacion_id": string }; Returns: boolean
                           },
"restore_event":
{ Args: { "p_evento_id": string,"p_expected_version": number }; Returns: number
                           },
"restore_store_task":
{ Args: { "p_id": string,"p_version": number }; Returns: {
              "archivado_en": string | null,
"cantidad": number | null,
"creado_en": string,
"creado_por": string,
"detalle": string | null,
"disenador_id": string | null,
"diseno_entregado_en": string | null,
"diseno_estatus": string | null,
"diseno_iniciado_en": string | null,
"diseno_solicitado_en": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"enlace_referencia": string | null,
"entregado_en": string | null,
"estatus": string,
"fecha_entrega_diseno": string | null,
"fecha_requerida": string | null,
"id": string,
"instrucciones_diseno": string | null,
"modificado_en": string,
"modificado_por": string | null,
"requiere_diseno": boolean,
"sede_id": string,
"tipo": string,
"titulo": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "pendientes_tienda"
        isOneToOne: true
        isSetofReturn: false
      } },
"retract_evento_design_request":
{ Args: { "p_evento_id": string,"p_expected_version": number }; Returns: number
                           },
"retract_pendiente_design_request":
{ Args: { "p_pendiente_id": string,"p_version": number }; Returns: undefined
                           },
"revert_solicitud_diseno_importacion":
{ Args: { "p_lote_id": string }; Returns: Json
                           },
"save_campaign_with_efemerides":
{ Args: { "p_campana_id": string,"p_confirmar_desvinculacion": boolean,"p_descripcion": string,"p_efemeride_ids": (string)[],"p_fecha_fin": string,"p_fecha_inicio": string,"p_nombre": string,"p_presupuesto": number,"p_tipo_campana": Database["public"]['Enums']["tipo_campana_enum"] }; Returns: string
                           },
"save_event_closure":
{ Args: { "p_asistentes_reales": number,"p_evento_id": string,"p_expected_version": number,"p_gasto_real": number,"p_notas_cierre": string }; Returns: number
                           },
"save_event_design_config":
{ Args: { "p_evento_id": string,"p_expected_version": number,"p_fecha": string,"p_formatos": (string)[],"p_instrucciones": string,"p_requiere": boolean }; Returns: number
                           },
"set_publication_design_instructions":
{ Args: { "p_instrucciones": string,"p_publicacion_id": string }; Returns: boolean
                           },
"set_publication_design_requirement":
{ Args: { "p_publicacion_id": string,"p_requiere_diseno": boolean }; Returns: {
              "body_texto": string | null,
"campana_id": string | null,
"creador_id": string | null,
"created_at": string | null,
"cta_texto": string | null,
"deleted_at": string | null,
"disenador_id": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_cleanup_attempted_at": string | null,
"drive_cleanup_error": string | null,
"drive_cleanup_status": string,
"drive_deleted_at": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"drive_preserved_at": string | null,
"estatus": Database["public"]['Enums']["estatus_enum"],
"fecha_aprobacion_gerencia": string | null,
"fecha_entrega_diseno_estimada": string | null,
"fecha_entrega_diseno_real": string | null,
"fecha_limite_brief": string | null,
"fecha_publicacion": string,
"fecha_rodaje": string | null,
"fecha_solicitud_diseno": string | null,
"formato": Database["public"]['Enums']["formato_enum"],
"hashtags": (string)[] | null,
"hook_texto": string | null,
"hora_publicacion": string | null,
"id": string,
"instrucciones_diseno": string | null,
"linea_contenido": string | null,
"prioridad": number,
"requiere_diseno": boolean,
"requiere_rodaje": boolean,
"sedes": (Database["public"]['Enums']["sede_enum"])[],
"titulo": string,
"updated_at": string | null,
"version_copy": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "publicaciones"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_publication_hour":
{ Args: { "p_hora_publicacion": string,"p_publicacion_id": string }; Returns: boolean
                           },
"set_publication_production":
{ Args: { "p_fecha_rodaje": string,"p_prioridad": number,"p_publicacion_id": string,"p_requiere_rodaje": boolean,"p_sedes": (Database["public"]['Enums']["sede_enum"])[] }; Returns: boolean
                           },
"set_solicitud_diseno_responsable":
{ Args: { "p_expected_version": number,"p_id": string,"p_responsable_id": string }; Returns: number
                           },
"sync_event_statuses":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"sync_evento_drive_brief":
{ Args: { "p_brief_folder_id": string,"p_deliverables_folder_id": string,"p_drive_folder_id": string,"p_drive_folder_url": string,"p_evento_id": string,"p_file_count": number }; Returns: undefined
                           },
"sync_pendiente_drive_brief":
{ Args: { "p_brief_folder_id": string,"p_deliverables_folder_id": string,"p_file_count": number,"p_pendiente_id": string }; Returns: undefined
                           },
"sync_publication_drive_brief":
{ Args: { "p_brief_folder_id": string,"p_deliverables_folder_id": string,"p_file_count": number,"p_publication_id": string }; Returns: undefined
                           },
"transition_event_status":
{ Args: { "p_confirmar_cruce"?: boolean,"p_estatus": string,"p_evento_id": string,"p_expected_version": number,"p_motivo"?: string }; Returns: number
                           },
"transition_publicacion_status":
{ Args: { "p_estatus_nuevo": Database["public"]['Enums']["estatus_enum"],"p_motivo"?: string,"p_publicacion_id": string }; Returns: {
              "body_texto": string | null,
"campana_id": string | null,
"creador_id": string | null,
"created_at": string | null,
"cta_texto": string | null,
"deleted_at": string | null,
"disenador_id": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_cleanup_attempted_at": string | null,
"drive_cleanup_error": string | null,
"drive_cleanup_status": string,
"drive_deleted_at": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"drive_preserved_at": string | null,
"estatus": Database["public"]['Enums']["estatus_enum"],
"fecha_aprobacion_gerencia": string | null,
"fecha_entrega_diseno_estimada": string | null,
"fecha_entrega_diseno_real": string | null,
"fecha_limite_brief": string | null,
"fecha_publicacion": string,
"fecha_rodaje": string | null,
"fecha_solicitud_diseno": string | null,
"formato": Database["public"]['Enums']["formato_enum"],
"hashtags": (string)[] | null,
"hook_texto": string | null,
"hora_publicacion": string | null,
"id": string,
"instrucciones_diseno": string | null,
"linea_contenido": string | null,
"prioridad": number,
"requiere_diseno": boolean,
"requiere_rodaje": boolean,
"sedes": (Database["public"]['Enums']["sede_enum"])[],
"titulo": string,
"updated_at": string | null,
"version_copy": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "publicaciones"
        isOneToOne: true
        isSetofReturn: false
      } },
"transition_solicitud_diseno":
{ Args: { "p_estado": string,"p_expected_version": number,"p_id": string,"p_motivo"?: string }; Returns: number
                           },
"transition_solicitud_diseno_entregable":
{ Args: { "p_estado": string,"p_expected_version": number,"p_id": string,"p_motivo"?: string }; Returns: number
                           },
"transition_store_task_status":
{ Args: { "p_estatus": string,"p_id": string,"p_motivo"?: string,"p_version": number }; Returns: {
              "archivado_en": string | null,
"cantidad": number | null,
"creado_en": string,
"creado_por": string,
"detalle": string | null,
"disenador_id": string | null,
"diseno_entregado_en": string | null,
"diseno_estatus": string | null,
"diseno_iniciado_en": string | null,
"diseno_solicitado_en": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"enlace_referencia": string | null,
"entregado_en": string | null,
"estatus": string,
"fecha_entrega_diseno": string | null,
"fecha_requerida": string | null,
"id": string,
"instrucciones_diseno": string | null,
"modificado_en": string,
"modificado_por": string | null,
"requiere_diseno": boolean,
"sede_id": string,
"tipo": string,
"titulo": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "pendientes_tienda"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_event":
{ Args: { "p_confirmar_cruce"?: boolean,"p_datos": Json,"p_evento_id": string,"p_expected_version": number,"p_motivo"?: string }; Returns: number
                           },
"update_event_with_design":
{ Args: { "p_confirmar_cruce"?: boolean,"p_datos": Json,"p_evento_id": string,"p_expected_version": number,"p_motivo"?: string }; Returns: number
                           },
"update_inventory_item":
{ Args: { "p_articulo_id": string,"p_atributos"?: Json,"p_categoria_id": string,"p_codigo": string,"p_condicion": string,"p_especificaciones": string,"p_expected_version": number,"p_nombre": string,"p_unidad_medida": string }; Returns: number
                           },
"update_publicacion_with_relations":
{ Args: { "p_body_texto": string,"p_campana_id": string,"p_categoria_ids": (string)[],"p_cta_texto": string,"p_estatus": Database["public"]['Enums']["estatus_enum"],"p_fecha_aprobacion_gerencia": string,"p_fecha_entrega_diseno_estimada": string,"p_fecha_entrega_diseno_real": string,"p_fecha_limite_brief": string,"p_fecha_publicacion": string,"p_fecha_solicitud_diseno": string,"p_formato": Database["public"]['Enums']["formato_enum"],"p_hashtags": (string)[],"p_hook_texto": string,"p_publicacion_id": string,"p_social_account_ids": (string)[],"p_titulo": string }; Returns: Json
                           },
"update_solicitud_diseno":
{ Args: { "p_data": Json,"p_expected_version": number,"p_id": string }; Returns: number
                           },
"update_store_task":
{ Args: { "p_data": Json,"p_id": string,"p_version": number }; Returns: {
              "archivado_en": string | null,
"cantidad": number | null,
"creado_en": string,
"creado_por": string,
"detalle": string | null,
"disenador_id": string | null,
"diseno_entregado_en": string | null,
"diseno_estatus": string | null,
"diseno_iniciado_en": string | null,
"diseno_solicitado_en": string | null,
"drive_brief_checked_at": string | null,
"drive_brief_file_count": number,
"drive_brief_folder_id": string | null,
"drive_deliverables_folder_id": string | null,
"drive_folder_id": string | null,
"drive_folder_url": string | null,
"enlace_referencia": string | null,
"entregado_en": string | null,
"estatus": string,
"fecha_entrega_diseno": string | null,
"fecha_requerida": string | null,
"id": string,
"instrucciones_diseno": string | null,
"modificado_en": string,
"modificado_por": string | null,
"requiere_diseno": boolean,
"sede_id": string,
"tipo": string,
"titulo": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "pendientes_tienda"
        isOneToOne: true
        isSetofReturn: false
      } },
"user_has_all_publication_accounts":
{ Args: { "p_publicacion_id": string }; Returns: boolean
                           },
"user_has_any_publication_account":
{ Args: { "p_publicacion_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "canal_enum": "INSTAGRAM"|"TIKTOK"|"YOUTUBE_SHORTS"|"FACEBOOK"|"YOUTUBE","departamento_enum": "COMPRAS"|"SELECCION"|"PROVEEDOR"|"GERENCIA"|"EVENTOS","estatus_enum": "PENDIENTE_BRIEF"|"EN_RODAJE"|"EN_DISENO"|"EN_REVISION_CM"|"RECHAZADO_DISENO"|"PENDIENTE_APROBACION_GERENCIA"|"APROBADO"|"PROGRAMADO"|"PUBLICADO"|"SOLICITADO"|"EN_CORRECCION"|"CANCELADO"|"INCOMPLETO","formato_enum": "CARRUSEL"|"POST"|"REEL"|"STORY","sede_enum": "PREBO"|"MANONGO","tipo_campana_enum": "TEMPORADA"|"EVENTO"|"EFEMERIDE"|"LANZAMIENTO"|"OFERTA_PUNTUAL"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "canal_enum": ["INSTAGRAM", "TIKTOK", "YOUTUBE_SHORTS", "FACEBOOK", "YOUTUBE"],"departamento_enum": ["COMPRAS", "SELECCION", "PROVEEDOR", "GERENCIA", "EVENTOS"],"estatus_enum": ["PENDIENTE_BRIEF", "EN_RODAJE", "EN_DISENO", "EN_REVISION_CM", "RECHAZADO_DISENO", "PENDIENTE_APROBACION_GERENCIA", "APROBADO", "PROGRAMADO", "PUBLICADO", "SOLICITADO", "EN_CORRECCION", "CANCELADO", "INCOMPLETO"],"formato_enum": ["CARRUSEL", "POST", "REEL", "STORY"],"sede_enum": ["PREBO", "MANONGO"],"tipo_campana_enum": ["TEMPORADA", "EVENTO", "EFEMERIDE", "LANZAMIENTO", "OFERTA_PUNTUAL"]
          }
        }
} as const
