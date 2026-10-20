import type { DesignRequestDetail } from '@/lib/designRequests';
import { adaptEvent, adaptInternal, adaptPublication } from '@/lib/designRequests';

type Common = { designerName?: string | null; createdAt?: string | null; history?: DesignRequestDetail['history']; canStart?: boolean; canUpload?: boolean; canDeliver?: boolean };
type SourceRow = Record<string, unknown>;

export function adaptPublicationDetail(row: SourceRow, channels: string[], opts: Common & { correction?: DesignRequestDetail['correction'] } = {}): DesignRequestDetail {
  const raw = row as Parameters<typeof adaptPublication>[0];
  const format = raw.formato ?? '';
  return {
    ...adaptPublication(raw, channels), context: { source: 'SOCIAL_MEDIA', format, channels, publication_date: raw.fecha_publicacion ?? null },
    designer: raw.disenador_id ? { id: raw.disenador_id, name: opts.designerName ?? null } : null,
    created_at: raw.created_at ?? null, usage_date: { label: 'Publicación', value: raw.fecha_publicacion ?? null },
    copy: format === 'STORY' ? null : { hook: raw.hook_texto ?? '', body: raw.body_texto ?? '', cta: raw.cta_texto ?? '', hashtags: raw.hashtags ?? [] },
    priority: ['HIGH', 'NORMAL', 'LOW'].includes(raw.prioridad) ? raw.prioridad : null, correction: opts.correction ?? null,
    history: opts.history ?? [],
    capabilities: { canStart: !!opts.canStart && ['SOLICITADO', 'EN_CORRECCION'].includes(raw.estatus), canUpload: !!opts.canUpload && raw.estatus === 'EN_DISENO', canDeliver: !!opts.canDeliver && raw.estatus === 'EN_DISENO', canReopen: !!opts.canStart && raw.estatus === 'EN_CORRECCION', deliverLabel: 'Entregar a revisión', deliverHint: 'La pieza debe incluir un archivo nuevo en este ciclo.', upload: opts.canUpload ? { maxFiles: 20, maxBytes: 524288000, resumable: true } : null },
  };
}

export function adaptInternalDetail(row: SourceRow, opts: Common = {}): DesignRequestDetail {
  const raw = row as Parameters<typeof adaptInternal>[0];
  return {
    ...adaptInternal(raw), context: { source: 'INTERNAL', task_type: raw.tipo, store: raw.sede_nombre, quantity: raw.cantidad ?? null, needed_by: raw.fecha_requerida ?? null },
    designer: raw.disenador_id ? { id: raw.disenador_id, name: opts.designerName ?? raw.disenador_nombre ?? null } : null,
    created_at: raw.creado_en ?? null, usage_date: { label: 'Requerida en tienda', value: raw.fecha_requerida ?? null }, copy: null, priority: null, correction: null,
    history: opts.history ?? [], capabilities: { canStart: !!opts.canStart && raw.diseno_estatus === 'SOLICITADO', canUpload: !!opts.canUpload && raw.diseno_estatus === 'EN_DISENO', canDeliver: !!opts.canDeliver && raw.diseno_estatus === 'EN_DISENO', canReopen: false, deliverLabel: 'Entregar a Interno', upload: opts.canUpload ? { maxFiles: 20, maxBytes: 524288000, resumable: true } : null },
  };
}

export function adaptEventDetail(row: SourceRow, opts: Common = {}): DesignRequestDetail {
  const raw = row as Parameters<typeof adaptEvent>[0];
  const base = adaptEvent(raw); const stores = (Array.isArray(raw.sedes) ? raw.sedes : []).map((store: unknown) => typeof store === 'string' ? store : store && typeof store === 'object' && 'nombre' in store ? String(store.nombre) : '').filter(Boolean);
  return {
    ...base, context: { source: 'EVENTS', event_name: raw.nombre, stores, starts_at: raw.inicio ?? null, ends_at: raw.fin ?? null, formats: raw.diseno_formatos ?? [] },
    designer: raw.disenador_id ? { id: raw.disenador_id, name: opts.designerName ?? raw.disenador_nombre ?? null } : null,
    created_at: raw.creado_en ?? null, usage_date: { label: 'Evento', value: raw.inicio ?? null }, copy: null, priority: null, correction: null,
    history: opts.history ?? [], capabilities: { canStart: !!opts.canStart && raw.diseno_estatus === 'SOLICITADO', canUpload: !!opts.canUpload && raw.diseno_estatus === 'EN_DISENO' && raw.estatus !== 'CANCELADO', canDeliver: !!opts.canDeliver && raw.diseno_estatus === 'EN_DISENO' && raw.estatus !== 'CANCELADO', canReopen: false, deliverLabel: 'Entregar a Eventos', upload: opts.canUpload ? { maxFiles: 20, maxBytes: 524288000, resumable: true } : null },
  };
}
