import type { DesignRequestDetail } from '@/lib/designRequests';
import { adaptEvent, adaptInternal, adaptPublication } from '@/lib/designRequests';
import { DRIVE_FILE_RULES } from '@/lib/driveFileRules';

const deliverableUpload = {
  maxFiles: DRIVE_FILE_RULES.ENTREGABLES.maxFiles,
  maxBytes: DRIVE_FILE_RULES.ENTREGABLES.maxBytes,
  resumable: true,
  acceptedExtensions: Object.keys(DRIVE_FILE_RULES.ENTREGABLES.mimeByExtension),
};

type Common = { designerName?: string | null; createdAt?: string | null; history?: DesignRequestDetail['history']; correction?: DesignRequestDetail['correction']; canStart?: boolean; canUpload?: boolean; canDeliver?: boolean };
type SourceRow = Record<string, unknown>;

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function stringValues(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function latestCorrection(history: DesignRequestDetail['history'] = []) {
  const entry = [...history].reverse().find((item) => item.label === 'EN_CORRECCION' && item.note?.trim());
  return entry ? { text: entry.note!, at: entry.at } : null;
}

export function adaptPublicationDetail(row: SourceRow, channels: string[], opts: Common & { correction?: DesignRequestDetail['correction'] } = {}): DesignRequestDetail {
  const raw = row;
  const format = stringValue(raw.formato);
  const publicationDate = nullableString(raw.fecha_publicacion);
  const status = stringValue(raw.estatus);
  const designerId = nullableString(raw.disenador_id);
  const topics = Array.isArray(raw.temas) ? stringValues(raw.temas) : undefined;
  const priority = typeof raw.prioridad === 'number' ? raw.prioridad : Number(raw.prioridad);
  return {
    ...adaptPublication(raw, channels), context: {
      source: 'SOCIAL_MEDIA', format, channels, publication_date: publicationDate,
      ...(typeof raw.campana_nombre === 'string' ? { campaign: raw.campana_nombre } : {}),
      ...(topics ? { topics } : {}),
    },
    designer: designerId ? { id: designerId, name: opts.designerName ?? null } : null,
    created_at: nullableString(raw.created_at), usage_date: { label: 'Publicación', value: publicationDate },
    copy: { hook: stringValue(raw.hook_texto), body: stringValue(raw.body_texto), cta: stringValue(raw.cta_texto), hashtags: stringValues(raw.hashtags) },
    priority: ({ 1: 'HIGH', 2: 'NORMAL', 3: 'LOW' } as Record<number, 'HIGH' | 'NORMAL' | 'LOW'>)[priority] ?? null, correction: opts.correction ?? null,
    history: opts.history ?? [],
    capabilities: { canStart: !!opts.canStart && ['SOLICITADO', 'EN_CORRECCION'].includes(status), canUpload: !!opts.canUpload && status === 'EN_DISENO', canDeliver: !!opts.canDeliver && status === 'EN_DISENO', canReopen: !!opts.canStart && status === 'EN_CORRECCION', deliverLabel: 'Entregar a revisión', deliverHint: 'Disponible cuando termine la carga.', upload: opts.canUpload ? deliverableUpload : null },
  };
}

export function adaptInternalDetail(row: SourceRow, opts: Common = {}): DesignRequestDetail {
  const raw = row;
  const type = stringValue(raw.tipo);
  const status = stringValue(raw.diseno_estatus);
  const designerId = nullableString(raw.disenador_id);
  return {
    ...adaptInternal(raw), context: { source: 'INTERNAL', task_type: type, store: stringValue(raw.sede_nombre), quantity: typeof raw.cantidad === 'number' ? raw.cantidad : null, needed_by: nullableString(raw.fecha_requerida) },
    designer: designerId ? { id: designerId, name: opts.designerName ?? nullableString(raw.disenador_nombre) } : null,
    created_at: nullableString(raw.creado_en), usage_date: { label: 'Requerida en tienda', value: nullableString(raw.fecha_requerida) }, copy: null, priority: null,
    history: opts.history ?? [], correction: status === 'EN_CORRECCION' ? opts.correction ?? latestCorrection(opts.history) : null,
    capabilities: { canStart: !!opts.canStart && status === 'SOLICITADO', canUpload: !!opts.canUpload && status === 'EN_DISENO', canDeliver: !!opts.canDeliver && status === 'EN_DISENO', canReopen: !!opts.canStart && status === 'EN_CORRECCION', deliverLabel: 'Entregar a Interno', deliverHint: 'Disponible cuando termine la carga.', upload: opts.canUpload ? deliverableUpload : null },
  };
}

export function adaptEventDetail(row: SourceRow, opts: Common = {}): DesignRequestDetail {
  const raw = row;
  const base = adaptEvent(raw); const stores = (Array.isArray(raw.sedes) ? raw.sedes : []).map((store: unknown) => typeof store === 'string' ? store : store && typeof store === 'object' && 'nombre' in store ? String(store.nombre) : '').filter(Boolean);
  const status = stringValue(raw.diseno_estatus);
  const designerId = nullableString(raw.disenador_id);
  return {
    ...base, context: { source: 'EVENTS', event_name: stringValue(raw.nombre), stores, starts_at: nullableString(raw.inicio), ends_at: nullableString(raw.fin), formats: stringValues(raw.diseno_formatos) },
    designer: designerId ? { id: designerId, name: opts.designerName ?? nullableString(raw.disenador_nombre) } : null,
    created_at: nullableString(raw.creado_en), usage_date: { label: 'Evento', value: nullableString(raw.inicio) }, copy: null, priority: null,
    history: opts.history ?? [], correction: status === 'EN_CORRECCION' ? opts.correction ?? latestCorrection(opts.history) : null,
    capabilities: { canStart: !!opts.canStart && status === 'SOLICITADO', canUpload: !!opts.canUpload && status === 'EN_DISENO' && raw.estatus !== 'CANCELADO', canDeliver: !!opts.canDeliver && status === 'EN_DISENO' && raw.estatus !== 'CANCELADO', canReopen: !!opts.canStart && status === 'EN_CORRECCION' && raw.estatus !== 'CANCELADO', deliverLabel: 'Entregar a Eventos', deliverHint: 'Disponible cuando termine la carga.', upload: opts.canUpload ? deliverableUpload : null },
  };
}
