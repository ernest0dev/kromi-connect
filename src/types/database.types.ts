import type { Database as GeneratedDatabase } from './database.generated';

export type {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated';
export { Constants } from './database.generated';

type RpcArgumentOverrides = {
  check_event_overlap: { p_evento_id: string | null };
  create_publicacion_with_relations: {
    p_body_texto: string | null;
    p_campana_id: string | null;
    p_cta_texto: string | null;
    p_drive_folder_id: string | null;
    p_drive_folder_url: string | null;
    p_fecha_limite_brief: string | null;
    p_hashtags: string[] | null;
    p_hook_texto: string | null;
  };
  events_find_overlaps: { p_evento_id: string | null };
  events_raise_if_overlap: { p_evento_id: string | null };
  save_campaign_with_efemerides: {
    p_campana_id: string | null;
    p_descripcion: string | null;
    p_presupuesto: number | null;
  };
  save_event_closure: {
    p_asistentes_reales: number | null;
    p_gasto_real: number | null;
  };
  set_publication_hour: { p_hora_publicacion: string | null };
  set_publication_production: { p_fecha_rodaje: string | null };
  set_solicitud_diseno_responsable: { p_responsable_id: string | null };
  sync_evento_drive_brief: {
    p_drive_folder_id: string | null;
    p_drive_folder_url: string | null;
  };
  update_publicacion_with_relations: {
    p_body_texto: string | null;
    p_campana_id: string | null;
    p_cta_texto: string | null;
    p_fecha_aprobacion_gerencia: string | null;
    p_fecha_entrega_diseno_estimada: string | null;
    p_fecha_entrega_diseno_real: string | null;
    p_fecha_limite_brief: string | null;
    p_fecha_solicitud_diseno: string | null;
    p_hashtags: string[] | null;
    p_hook_texto: string | null;
  };
};

type OverrideFunctionArgs<TFunction, TArgsOverride extends object> =
  TFunction extends { Args: infer TArgs }
    ? Omit<TFunction, 'Args'> & {
        Args: Omit<TArgs, keyof TArgsOverride> & TArgsOverride;
      }
    : TFunction;

type CompatibleFunctions<TFunctions> = {
  [TFunctionName in keyof TFunctions]: TFunctionName extends keyof RpcArgumentOverrides
    ? OverrideFunctionArgs<
        TFunctions[TFunctionName],
        RpcArgumentOverrides[TFunctionName]
      >
    : TFunctions[TFunctionName];
};

type GeneratedPublicSchema = GeneratedDatabase['public'];

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedPublicSchema, 'Functions'> & {
    Functions: CompatibleFunctions<GeneratedPublicSchema['Functions']>;
  };
};
