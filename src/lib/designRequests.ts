export type DesignSource = 'SOCIAL_MEDIA' | 'INTERNAL' | 'EVENTS';
export type DesignStatus = 'REQUESTED' | 'IN_PROGRESS' | 'NEEDS_CHANGES' | 'DELIVERED' | 'CANCELLED';

export type DesignRequest = {
  request_id: string; source: DesignSource; source_record_id: string; title: string;
  requested_by: string | null; requested_at: string | null; instructions: string;
  target_date: string | null; requested_outputs: { category: string; source_format_code: string; label: string; specification?: string | null }[];
  brief_files: unknown[]; design_status: DesignStatus; designer_id: string | null;
  started_at: string | null; delivered_at: string | null; delivery_files: unknown[];
  source_context: Record<string, unknown>;
};

export type SourceContext =
  | { source: 'SOCIAL_MEDIA'; format: string; channels: string[]; publication_date: string | null }
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
  history: { at: string; label: string; note?: string | null }[];
  capabilities: {
    canStart: boolean; canUpload: boolean; canDeliver: boolean; canReopen: boolean;
    deliverLabel: string; deliverHint?: string;
    upload: { maxFiles: number; maxBytes: number; resumable: boolean } | null;
  };
};

const sourceState = (value: string): DesignStatus => value === 'EN_DISENO' ? 'IN_PROGRESS' : value === 'EN_CORRECCION' ? 'NEEDS_CHANGES' : value === 'ENTREGADO' || value === 'EN_REVISION_CM' || value === 'PROGRAMADO' || value === 'PUBLICADO' || value === 'APROBADO' ? 'DELIVERED' : value === 'CANCELADO' ? 'CANCELLED' : 'REQUESTED';

export function adaptPublication(row: Record<string, any>, channels: string[] = []): DesignRequest {
  return {
    request_id: `SOCIAL_MEDIA:${row.id}`, source: 'SOCIAL_MEDIA', source_record_id: row.id, title: row.titulo,
    requested_by: row.creador_id ?? null, requested_at: row.fecha_solicitud_diseno ?? row.created_at ?? null,
    instructions: row.instrucciones_diseno ?? '', target_date: row.fecha_entrega_diseno_estimada ?? row.fecha_publicacion ?? null,
    requested_outputs: [{ category: 'SOCIAL_MEDIA', source_format_code: row.formato ?? 'OTHER', label: row.formato ?? 'Pieza' }, ...channels.map((x) => ({ category: 'CHANNEL', source_format_code: x, label: x }))],
    brief_files: row.drive_brief_file_count ? [{ count: row.drive_brief_file_count }] : [], design_status: sourceState(row.estatus),
    designer_id: row.disenador_id ?? null, started_at: row.estatus === 'EN_DISENO' ? row.updated_at ?? null : null,
    delivered_at: row.fecha_entrega_diseno_real ?? null, delivery_files: [],
    source_context: { format: row.formato, channels, publication_date: row.fecha_publicacion },
  };
}

export function adaptInternal(row: Record<string, any>): DesignRequest {
  return {
    request_id: `INTERNAL:${row.id}`, source: 'INTERNAL', source_record_id: row.id, title: row.titulo,
    requested_by: null, requested_at: row.diseno_solicitado_en ?? null, instructions: row.instrucciones_diseno ?? '',
    target_date: row.fecha_entrega_diseno ?? null,
    requested_outputs: [{ category: row.tipo === 'IMPRESION' ? 'PRINT' : 'OTHER', source_format_code: row.tipo, label: row.tipo }],
    brief_files: row.drive_brief_file_count ? [{ count: row.drive_brief_file_count }] : [], design_status: sourceState(row.diseno_estatus),
    designer_id: row.disenador_id ?? null, started_at: row.diseno_iniciado_en ?? null, delivered_at: row.diseno_entregado_en ?? null,
    delivery_files: [], source_context: { task_type: row.tipo, store_name: row.sede_nombre, quantity: row.cantidad },
  };
}

export function adaptEvent(row: Record<string, any>): DesignRequest {
  return {
    request_id: `EVENTS:${row.id}`, source: 'EVENTS', source_record_id: row.id, title: row.nombre,
    requested_by: row.creado_por ?? null, requested_at: row.diseno_solicitado_en ?? null, instructions: row.instrucciones_diseno ?? '',
    target_date: row.fecha_entrega_diseno ?? null,
    requested_outputs: (row.diseno_formatos ?? []).map((x: string) => ({ category: x === 'IMPRESION' ? 'PRINT' : 'DIGITAL', source_format_code: x, label: x === 'IMPRESION' ? 'Impresión' : 'Digital' })),
    brief_files: row.drive_brief_file_count ? [{ count: row.drive_brief_file_count }] : [], design_status: sourceState(row.diseno_estatus),
    designer_id: row.disenador_id ?? null, started_at: row.diseno_iniciado_en ?? null, delivered_at: row.diseno_entregado_en ?? null,
    delivery_files: [], source_context: { event_name: row.nombre, stores: row.sedes ?? [], start: row.inicio, end: row.fin },
  };
}

export function sortDesignRequests(rows: DesignRequest[]) {
  return rows.sort((a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999') || (a.requested_at ?? '').localeCompare(b.requested_at ?? ''));
}
