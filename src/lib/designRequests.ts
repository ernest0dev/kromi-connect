export type DesignSource = 'SOCIAL_MEDIA' | 'INTERNAL' | 'EVENTS' | 'GENERAL';
export type DesignStatus = 'REQUESTED' | 'IN_PROGRESS' | 'NEEDS_CHANGES' | 'DELIVERED' | 'CANCELLED';

export type DesignRequest = {
  request_id: string; source: DesignSource; source_record_id: string; title: string;
  requested_by: string | null; requested_at: string | null; instructions: string;
  target_date: string | null; requested_outputs: { category: string; source_format_code: string; label: string; specification?: string | null }[];
  brief_files: unknown[]; design_status: DesignStatus; designer_id: string | null;
  started_at: string | null; delivered_at: string | null; delivery_files: unknown[];
  source_context: Record<string, unknown>;
  designer_name?: string | null;
  usage_date?: { label: string; value: string | null } | null;
  cancellation_reason?: string | null;
  source_status?: string | null;
  history_at?: string | null;
};

export type SourceContext =
  | { source: 'SOCIAL_MEDIA'; format: string; channels: string[]; publication_date: string | null; campaign?: string | null; topics?: string[] }
  | { source: 'INTERNAL'; task_type: string; store: string; quantity: number | null; needed_by: string | null }
  | { source: 'EVENTS'; event_name: string; stores: string[]; starts_at: string | null; ends_at: string | null; formats: string[] };

export type DesignRequestDetail = DesignRequest & {
  context: SourceContext;
  designer: { id: string; name: string | null } | null;
  created_at: string | null;
  usage_date: { label: string; value: string | null } | null;
  copy: { hook?: string; body?: string; cta?: string; hashtags?: string[] } | null;
  priority: 'HIGH' | 'NORMAL' | 'LOW' | null;
  correction: { text: string; at: string } | null;
  history: { at: string; label: string; note?: string | null; actor_name?: string | null }[];
  capabilities: {
    canStart: boolean; canUpload: boolean; canDeliver: boolean; canReopen: boolean;
    deliverLabel: string; deliverHint?: string;
    upload: { maxFiles: number; maxBytes: number; resumable: boolean; acceptedExtensions: string[] } | null;
  };
};

const sourceState = (value: string): DesignStatus => value === 'EN_DISENO' ? 'IN_PROGRESS' : value === 'EN_CORRECCION' ? 'NEEDS_CHANGES' : value === 'ENTREGADO' || value === 'EN_REVISION_CM' || value === 'PROGRAMADO' || value === 'PUBLICADO' || value === 'APROBADO' ? 'DELIVERED' : value === 'CANCELADO' ? 'CANCELLED' : 'REQUESTED';

function requiredString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`El campo ${key} de la solicitud de Diseño no es válido.`);
  return value;
}

function optionalString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`El campo ${key} de la solicitud de Diseño no es válido.`);
  return value;
}

export function adaptPublication(row: Record<string, unknown>, channels: string[] = []): DesignRequest {
  const id = requiredString(row, 'id');
  const status = requiredString(row, 'estatus');
  const format = optionalString(row, 'formato') ?? 'OTHER';
  const publicationDate = optionalString(row, 'fecha_publicacion');
  const targetDate = optionalString(row, 'fecha_entrega_diseno_estimada') ?? publicationDate;
  return {
    request_id: `SOCIAL_MEDIA:${id}`, source: 'SOCIAL_MEDIA', source_record_id: id, title: requiredString(row, 'titulo'),
    requested_by: optionalString(row, 'creador_id'), requested_at: optionalString(row, 'fecha_solicitud_diseno') ?? optionalString(row, 'created_at'),
    instructions: optionalString(row, 'instrucciones_diseno') ?? '', target_date: targetDate,
    requested_outputs: [{ category: 'SOCIAL_MEDIA', source_format_code: format, label: format === 'OTHER' ? 'Pieza' : format }],
    brief_files: row.drive_brief_file_count ? [{ count: row.drive_brief_file_count }] : [], design_status: sourceState(status),
    designer_id: optionalString(row, 'disenador_id'), started_at: status === 'EN_DISENO' ? optionalString(row, 'updated_at') : null,
    delivered_at: optionalString(row, 'fecha_entrega_diseno_real'), delivery_files: [],
    usage_date: { label: 'Publica', value: publicationDate },
    source_status: status,
    history_at: optionalString(row, 'updated_at'),
    source_context: { format, channels, publication_date: publicationDate },
  };
}

export function adaptInternal(row: Record<string, unknown>): DesignRequest {
  const id = requiredString(row, 'id');
  const status = requiredString(row, 'diseno_estatus');
  const type = requiredString(row, 'tipo');
  const usageDate = optionalString(row, 'fecha_requerida');
  return {
    request_id: `INTERNAL:${id}`, source: 'INTERNAL', source_record_id: id, title: requiredString(row, 'titulo'),
    requested_by: null, requested_at: optionalString(row, 'diseno_solicitado_en'), instructions: optionalString(row, 'instrucciones_diseno') ?? '',
    target_date: optionalString(row, 'fecha_entrega_diseno'),
    requested_outputs: [{ category: type === 'IMPRESION' ? 'PRINT' : 'OTHER', source_format_code: type, label: type }],
    brief_files: row.drive_brief_file_count ? [{ count: row.drive_brief_file_count }] : [], design_status: sourceState(status),
    designer_id: optionalString(row, 'disenador_id'), started_at: optionalString(row, 'diseno_iniciado_en'), delivered_at: optionalString(row, 'diseno_entregado_en'),
    delivery_files: [], usage_date: { label: 'Requerida en tienda', value: usageDate },
    source_status: optionalString(row, 'estatus_pendiente'),
    source_context: { task_type: type, store_name: optionalString(row, 'sede_nombre'), quantity: row.cantidad },
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function adaptEvent(row: Record<string, unknown>): DesignRequest {
  const id = requiredString(row, 'id');
  const status = requiredString(row, 'diseno_estatus');
  const formats = stringArray(row.diseno_formatos);
  const eventDate = optionalString(row, 'inicio');
  return {
    request_id: `EVENTS:${id}`, source: 'EVENTS', source_record_id: id, title: requiredString(row, 'nombre'),
    requested_by: optionalString(row, 'creado_por'), requested_at: optionalString(row, 'diseno_solicitado_en'), instructions: optionalString(row, 'instrucciones_diseno') ?? '',
    target_date: optionalString(row, 'fecha_entrega_diseno'),
    requested_outputs: formats.map((format) => ({ category: format === 'IMPRESION' ? 'PRINT' : 'DIGITAL', source_format_code: format, label: format === 'IMPRESION' ? 'Impresión' : 'Digital' })),
    brief_files: row.drive_brief_file_count ? [{ count: row.drive_brief_file_count }] : [], design_status: sourceState(status),
    designer_id: optionalString(row, 'disenador_id'), started_at: optionalString(row, 'diseno_iniciado_en'), delivered_at: optionalString(row, 'diseno_entregado_en'),
    delivery_files: [], usage_date: { label: 'Evento', value: eventDate },
    source_context: { event_name: requiredString(row, 'nombre'), stores: row.sedes ?? [], start: eventDate, end: optionalString(row, 'fin') },
  };
}

export function adaptGeneralRequest(row: Record<string, unknown>): DesignRequest {
  const id = requiredString(row, 'id');
  const status = requiredString(row, 'status');
  const type = requiredString(row, 'design_type');
  const types = type === 'BOTH' ? ['DIGITAL', 'PRINT'] : [type];
  return {
    request_id: `GENERAL:${id}`, source: 'GENERAL', source_record_id: id,
    title: requiredString(row, 'title'), requested_by: optionalString(row, 'requester_id'),
    requested_at: optionalString(row, 'created_at'), instructions: optionalString(row, 'instructions') ?? '',
    target_date: optionalString(row, 'required_date'),
    requested_outputs: types.map((value) => ({ category: value === 'PRINT' ? 'PRINT' : 'DIGITAL', source_format_code: value, label: value === 'PRINT' ? 'Impreso' : value === 'OTHER' ? optionalString(row, 'design_type_other') ?? 'Otro' : 'Digital' })),
    brief_files: [], design_status: status === 'EN_DISENO' ? 'IN_PROGRESS' : status === 'EN_CORRECCION' ? 'NEEDS_CHANGES' : status === 'ENTREGADA' ? 'DELIVERED' : status === 'CANCELADA' ? 'CANCELLED' : 'REQUESTED',
    designer_id: optionalString(row, 'designer_id'), started_at: optionalString(row, 'started_at'), delivered_at: optionalString(row, 'delivered_at'), delivery_files: [],
    source_context: { department: optionalString(row, 'department'), categories: stringArray(row.categories), scopes: stringArray(row.scopes), requester_role: optionalString(row, 'requester_role'), priority: optionalString(row, 'priority') },
    usage_date: { label: 'Requerida', value: optionalString(row, 'required_date') },
    source_status: status,
    history_at: optionalString(row, 'updated_at'),
  };
}

export function sortDesignRequests(rows: DesignRequest[]) {
  return rows.sort((a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999') || (a.requested_at ?? '').localeCompare(b.requested_at ?? ''));
}
