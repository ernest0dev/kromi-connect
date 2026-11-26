import 'server-only';
import {
  type DesignActor,
  type DesignHistoryEntry,
  type DesignPendingUpload,
  type DesignRequestCapabilities,
  type DesignRequestDetailModel,
  type DesignRequestError,
  type DesignRequestFile,
  type DesignRequestListFilters,
  type DesignRequestModel,
  type DesignRequestSource,
  type DesignUploadInput,
  type DesignUploadReservation,
  type Result,
} from '@/lib/design-contract';
import { authorizeAction, getAuthContext } from '@/lib/auth/dal';
import { DRIVE_FILE_RULES, getDriveFileRule } from '@/lib/driveFileRules';
import {
  createDriveResumableSession,
  ensurePublicacionDriveFolders,
  findDriveUploadedFile,
  listDriveFolderFiles,
  revokeDriveResumableSession,
} from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import type { Database } from '@/types/database.types';

export type EventsDesignFilters = {
  formats?: readonly string[];
  eventStatuses?: readonly string[];
  stores?: readonly string[];
};

type QueueRow = Database['public']['Functions']['get_design_event_queue']['Returns'][number];
type DetailRow = Database['public']['Functions']['get_design_event_request']['Returns'][number];
type TimelineRow = Database['public']['Functions']['get_design_event_timeline']['Returns'][number];
type EventRequest = DesignRequestModel<'EVENTS'>;
type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
type Authorization = { context: AuthContext } | { error: Result<never> };
type CurrentEvent = { context: AuthContext; detail: DetailRow; lifecycle: Pick<Database['public']['Tables']['eventos']['Row'], 'estatus' | 'archivado_en' | 'drive_folder_id' | 'drive_brief_folder_id' | 'drive_deliverables_folder_id'> } | { error: Result<never> };
type Permission = Parameters<typeof authorizeAction>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function success<T>(value: T): Result<T> { return { ok: true, value }; }
function failure<T = never>(code: DesignRequestError['code'], message: string, sourceCode?: string): Result<T> {
  return { ok: false, error: { code, message, ...(sourceCode ? { sourceCode } : {}) } };
}

function classifyError(error: { code?: string; message?: string } | null | undefined): DesignRequestError['code'] {
  if (error?.code === '42501' || /permission|forbidden|permiso|autoriz/i.test(error?.message ?? '')) return 'FORBIDDEN';
  if (error?.code === '23505' || error?.code === '40001' || error?.code === 'PT409') return 'CONFLICT';
  if (error?.code === '22023' || error?.code === 'P0001') return 'INVALID_STATE';
  if (error?.code?.startsWith('08') || /timeout|unavailable|network|fetch|connection/i.test(error?.message ?? '')) return 'UNAVAILABLE';
  return 'SOURCE_ERROR';
}

async function authorize(actor: DesignActor, permissions: readonly Permission[]): Promise<Authorization> {
  let context: AuthContext | null = null;
  for (const permission of permissions) {
    const access = await authorizeAction(permission);
    if (!access.context || access.error) return { error: failure('FORBIDDEN', access.error ?? 'No tienes permiso para realizar esta acción.') };
    if (access.context.user.id !== actor.id) return { error: failure('FORBIDDEN', 'El actor no coincide con la sesión autenticada.') };
    if (context && context.user.id !== access.context.user.id) return { error: failure('FORBIDDEN', 'La sesión autenticada cambió durante la autorización.') };
    context = access.context;
  }
  return context ? { context } : { error: failure('FORBIDDEN', 'No se pudo autenticar la sesión.') };
}

function normalizeStatus(value: string): EventRequest['status'] {
  if (value === 'EN_DISENO') return 'IN_PROGRESS';
  if (value === 'EN_CORRECCION') return 'NEEDS_CHANGES';
  if (value === 'ENTREGADO') return 'DELIVERED';
  if (value === 'CANCELADO') return 'CANCELLED';
  return 'REQUESTED';
}

function storesFromJson(value: QueueRow['sedes']): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const name = 'nombre' in item ? item.nombre : undefined;
    return typeof name === 'string' && name.trim() ? [name.trim()] : [];
  });
}

function formatsFromRow(formats: readonly string[] | null): string[] {
  return (formats ?? []).filter((format) => typeof format === 'string' && format.trim().length > 0);
}

function outputLabel(format: string): string {
  return format === 'DIGITAL' ? 'Digital' : format === 'IMPRESION' ? 'Impresión' : format;
}

function mapEvent(row: QueueRow | DetailRow, queueEventStatus?: string | null): EventRequest {
  const formats = formatsFromRow(row.diseno_formatos);
  const stores = storesFromJson(row.sedes);
  return {
    id: `EVENTS:${row.id}`,
    source: 'EVENTS',
    sourceRecordId: row.id,
    title: row.nombre,
    requesterId: 'creado_por' in row ? row.creado_por : null,
    requestedAt: row.diseno_solicitado_en,
    instructions: row.instrucciones_diseno ?? '',
    targetDate: row.fecha_entrega_diseno,
    requestedOutputs: formats.map((format) => ({ category: 'EVENTS', sourceFormatCode: format, label: outputLabel(format) })),
    status: normalizeStatus(row.diseno_estatus),
    sourceStatus: row.diseno_estatus,
    designerId: row.disenador_id,
    startedAt: row.diseno_iniciado_en,
    deliveredAt: row.diseno_entregado_en,
    priority: null,
    updatedAt: null,
    sourceData: {
      eventName: row.nombre,
      stores,
      startsAt: row.inicio,
      endsAt: row.fin,
      formats,
      eventStatus: queueEventStatus ?? ('estatus' in row ? row.estatus : null),
    },
  };
}

function mapTimeline(row: TimelineRow): DesignHistoryEntry {
  return { at: row.at, label: row.label, note: row.note };
}

async function loadCurrent(eventId: string, actor: DesignActor, permissions: readonly Permission[]): Promise<CurrentEvent> {
  if (!UUID.test(eventId)) return { error: failure('INVALID_INPUT', 'El identificador del evento no es válido.') };
  const access = await authorize(actor, permissions);
  if ('error' in access) return access;
  const { data, error } = await access.context.supabase.rpc('get_design_event_request', { p_evento_id: eventId });
  if (error) return { error: failure(classifyError(error), 'No se pudo consultar la solicitud.', error.code) };
  const detail = data?.[0];
  if (!detail) return { error: failure('NOT_FOUND', 'No se encontró la solicitud de Diseño.') };
  // This privileged read is intentionally after read and operation authorization.
  const { data: lifecycle, error: lifecycleError } = await getSupabaseAdmin().from('eventos')
    .select('estatus,archivado_en,drive_folder_id,drive_brief_folder_id,drive_deliverables_folder_id')
    .eq('id', eventId).maybeSingle();
  if (lifecycleError) return { error: failure(classifyError(lifecycleError), 'No se pudo verificar el estado actual del evento.', lifecycleError.code) };
  if (!lifecycle) return { error: failure('NOT_FOUND', 'No se encontró el evento.') };
  return { context: access.context, detail, lifecycle };
}

function activeEvent(current: Extract<CurrentEvent, { context: AuthContext }>): boolean {
  return current.lifecycle.estatus !== 'CANCELADO' && current.lifecycle.archivado_en === null;
}

async function ensureEventFolders(current: Extract<CurrentEvent, { context: AuthContext }>) {
  const rootId = current.lifecycle.drive_folder_id ?? current.detail.drive_folder_id;
  if (!rootId) throw new Error('El evento no tiene carpeta de Drive.');
  if (current.lifecycle.drive_brief_folder_id && current.lifecycle.drive_deliverables_folder_id) {
    return { briefId: current.lifecycle.drive_brief_folder_id, deliverablesId: current.lifecycle.drive_deliverables_folder_id };
  }
  const folders = await ensurePublicacionDriveFolders(rootId);
  const { data, error } = await getSupabaseAdmin().from('eventos').update({
    drive_folder_id: rootId,
    drive_brief_folder_id: folders.brief.id,
    drive_deliverables_folder_id: folders.deliverables.id,
  }).eq('id', current.detail.id).is('archivado_en', null).select('id').maybeSingle();
  if (error || !data) throw new Error('No se pudieron guardar las carpetas de Drive.');
  return { briefId: folders.brief.id, deliverablesId: folders.deliverables.id };
}

async function canDeliver(current: Extract<CurrentEvent, { context: AuthContext }>): Promise<Result<boolean>> {
  if (!activeEvent(current) || current.detail.diseno_estatus !== 'EN_DISENO' || !current.detail.diseno_iniciado_en) return success(false);
  const { data, error } = await getSupabaseAdmin().from('evento_drive_uploads')
    .select('id').eq('evento_id', current.detail.id).eq('carpeta', 'ENTREGABLES').eq('status', 'COMPLETE')
    .gt('completed_at', current.detail.diseno_iniciado_en).limit(1);
  if (error) return failure(classifyError(error), 'No se pudo comprobar el ciclo de entregables.', error.code);
  return success((data ?? []).length > 0);
}

function matchesCommonFilters(request: EventRequest, filters: DesignRequestListFilters<EventsDesignFilters>): boolean {
  const search = filters.search?.trim().toLocaleLowerCase();
  const sourceFilters = filters.sourceSpecific;
  if (filters.statuses?.length && !filters.statuses.includes(request.status)) return false;
  if (filters.designerId !== undefined && request.designerId !== filters.designerId) return false;
  if (filters.targetDateFrom && (!request.targetDate || request.targetDate < filters.targetDateFrom)) return false;
  if (filters.targetDateTo && (!request.targetDate || request.targetDate > filters.targetDateTo)) return false;
  if (search && !`${request.title} ${request.instructions} ${request.sourceData.stores.join(' ')} ${request.sourceData.formats.join(' ')}`.toLocaleLowerCase().includes(search)) return false;
  const lower = (values: readonly string[] | undefined) => values?.map((value) => value.toLocaleLowerCase());
  const formats = lower(sourceFilters?.formats);
  const stores = lower(sourceFilters?.stores);
  const eventStatuses = lower(sourceFilters?.eventStatuses);
  if (formats?.length && !request.sourceData.formats.some((format) => formats.includes(format.toLocaleLowerCase()))) return false;
  if (stores?.length && !request.sourceData.stores.some((store) => stores.includes(store.toLocaleLowerCase()))) return false;
  if (eventStatuses?.length && (!request.sourceData.eventStatus || !eventStatuses.includes(request.sourceData.eventStatus.toLocaleLowerCase()))) return false;
  return true;
}

async function transition(
  eventId: string,
  actor: DesignActor,
  permission: 'design.requests.start' | 'design.requests.deliver',
  operation: 'start' | 'reopen' | 'deliver',
): Promise<Result<void>> {
  const current = await loadCurrent(eventId, actor, ['design.requests.read', permission]);
  if ('error' in current) return current.error;
  const status = current.detail.diseno_estatus;
  if (!activeEvent(current)) return failure('INVALID_STATE', 'El evento está cancelado o archivado.');
  if (operation === 'start' && (status !== 'SOLICITADO' || current.lifecycle.estatus === 'CANCELADO')) return failure('INVALID_STATE', 'La solicitud ya no está disponible para iniciar.');
  if (operation === 'reopen' && (status !== 'EN_CORRECCION' || ['CANCELADO', 'TERMINADO'].includes(current.lifecycle.estatus))) return failure('INVALID_STATE', 'La solicitud ya no está pendiente de corrección.');
  if (operation === 'deliver') {
    if (status !== 'EN_DISENO' || !current.detail.diseno_iniciado_en) return failure('INVALID_STATE', 'La solicitud no está en diseño.');
    const eligible = await canDeliver(current);
    if (!eligible.ok) return eligible;
    if (!eligible.value) return failure('INVALID_STATE', 'Se requiere un entregable completado durante el ciclo actual de Diseño.');
  }
  const rpc = operation === 'start' ? 'design_start_event_request' : operation === 'reopen' ? 'design_reopen_event_request' : 'design_deliver_event_request';
  const { error } = await current.context.supabase.rpc(rpc, { p_evento_id: eventId });
  if (error) return failure(classifyError(error), 'No se pudo actualizar la solicitud.', error.code);
  // These source RPCs return void; successful null is their success signal.
  return success(undefined);
}

const source: DesignRequestSource<'EVENTS', EventsDesignFilters> = {
  source: 'EVENTS',

  async list(filters: DesignRequestListFilters<EventsDesignFilters>, actor) {
    const access = await authorize(actor, ['design.requests.read']);
    if ('error' in access) return access.error;
    const { data, error } = await access.context.supabase.rpc('get_design_event_queue');
    if (error) return failure(classifyError(error), 'No se pudo cargar la cola de eventos.', error.code);
    const rows = data ?? [];
    if (!rows.length) return success([]);
    const { data: lifecycle, error: lifecycleError } = await getSupabaseAdmin().from('eventos').select('id,estatus').in('id', rows.map((row) => row.id));
    if (lifecycleError) return failure(classifyError(lifecycleError), 'No se pudieron cargar los estados de los eventos.', lifecycleError.code);
    const eventStatusById = new Map((lifecycle ?? []).map((row) => [row.id, row.estatus]));
    return success(rows.map((row) => mapEvent(row, eventStatusById.get(row.id) ?? null)).filter((request) => matchesCommonFilters(request, filters)));
  },

  async getDetail(id, actor): Promise<Result<DesignRequestDetailModel<'EVENTS'>>> {
    const current = await loadCurrent(id, actor, ['design.requests.read']);
    if ('error' in current) return current.error;
    const { data, error } = await current.context.supabase.rpc('get_design_event_timeline', { p_id: id });
    if (error) return failure(classifyError(error), 'No se pudo cargar el historial del evento.', error.code);
    const history = (data ?? []).map(mapTimeline);
    const correction = [...history].reverse().find((entry) => entry.label === 'EN_CORRECCION' && entry.note);
    const row = current.detail;
    return success({
      ...mapEvent(row),
      createdAt: row.creado_en,
      designer: row.disenador_id ? { id: row.disenador_id, name: row.disenador_nombre } : null,
      usageDate: { label: 'Evento', value: row.inicio },
      copy: null,
      correction: correction?.note ? { text: correction.note, at: correction.at } : null,
      history,
    });
  },

  async capabilities(request, actor): Promise<Result<DesignRequestCapabilities>> {
    const permissions = await authorize(actor, ['design.requests.read']);
    if ('error' in permissions) return permissions.error;
    const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read']);
    if ('error' in current) return current.error;
    const [startAccess, uploadAccess, deliverAccess] = await Promise.all([
      authorize(actor, ['design.requests.start']), authorize(actor, ['design.requests.upload']), authorize(actor, ['design.requests.deliver']),
    ]);
    const canStart = !('error' in startAccess);
    const canUpload = !('error' in uploadAccess) && current.detail.diseno_estatus === 'EN_DISENO' && activeEvent(current);
    const canDeliverPermission = !('error' in deliverAccess);
    const status = current.detail.diseno_estatus;
    const eligible = canDeliverPermission ? await canDeliver(current) : success(false);
    if (!eligible.ok) return eligible;
    return success({
      start: canStart && status === 'SOLICITADO' && activeEvent(current),
      reopen: canStart && status === 'EN_CORRECCION' && activeEvent(current) && !['CANCELADO', 'TERMINADO'].includes(current.lifecycle.estatus),
      deliver: canDeliverPermission && eligible.value,
      fileAccess: {
        BRIEF: { readCompletedFiles: true, readPendingUploads: false },
        DELIVERABLE: { readCompletedFiles: true, readPendingUploads: canUpload },
      },
      uploads: {
        DELIVERABLE: {
          reserve: canUpload, finalize: canUpload, resumable: canUpload, cancellable: canUpload,
          maxFiles: DRIVE_FILE_RULES.ENTREGABLES.maxFiles,
          maxBytes: DRIVE_FILE_RULES.ENTREGABLES.maxBytes,
          acceptedMimeTypes: Object.values(DRIVE_FILE_RULES.ENTREGABLES.mimeByExtension),
        },
      },
    });
  },

  async start(request, actor) { return transition(request.sourceRecordId, actor, 'design.requests.start', 'start'); },
  async reopen(request, actor) { return transition(request.sourceRecordId, actor, 'design.requests.start', 'reopen'); },
  async deliver(request, actor) { return transition(request.sourceRecordId, actor, 'design.requests.deliver', 'deliver'); },

  async deliverEligibility(request, actor) {
    const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read', 'design.requests.deliver']);
    if ('error' in current) return current.error;
    const eligible = await canDeliver(current);
    if (!eligible.ok) return eligible;
    return success({ eligible: eligible.value, reason: eligible.value ? null : { code: 'INVALID_STATE', message: 'Se requiere un entregable completado durante el ciclo actual de Diseño.' } });
  },

  uploads: {
    supportedKinds: ['DELIVERABLE'],

    async reserveUpload(kind, request, actor, input: DesignUploadInput): Promise<Result<DesignUploadReservation>> {
      if (kind !== 'DELIVERABLE') return failure('INVALID_INPUT', 'Events solo admite cargas de entregables en Diseño.');
      const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read', 'design.requests.upload']);
      if ('error' in current) return current.error;
      if (current.detail.diseno_estatus !== 'EN_DISENO' || !activeEvent(current)) return failure('INVALID_STATE', 'La solicitud no está disponible para cargar entregables.');
      const rule = getDriveFileRule('ENTREGABLES', input.fileName);
      if (!rule || input.fileName.trim().length < 1 || input.fileName.length > 180 || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > rule.maxBytes || (input.mimeType && input.mimeType !== rule.mimeType)) return failure('UPLOAD_REJECTED', 'El nombre, formato o tamaño del archivo no está permitido.');
      try {
        const folders = await ensureEventFolders(current);
        const admin = getSupabaseAdmin();
        const { data: uploadId, error } = await admin.rpc('reserve_evento_deliverable_upload', {
          p_actor_id: current.context.user.id, p_evento_id: current.detail.id, p_file_name: input.fileName,
          p_mime_type: rule.mimeType, p_file_size: input.size,
        });
        if (error || !uploadId) return failure(error ? classifyError(error) : 'CONFLICT', 'No se pudo reservar el entregable.', error?.code);
        let sessionUri: string;
        try {
          sessionUri = await createDriveResumableSession({ folderId: folders.deliverablesId, uploadId, name: input.fileName, mimeType: rule.mimeType, size: input.size });
        } catch (cause) {
          await admin.from('evento_drive_uploads').update({ status: 'CANCELLED' }).eq('id', uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES').eq('status', 'RESERVING');
          return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'Drive no pudo iniciar la carga.');
        }
        const { data: saved, error: saveError } = await admin.from('evento_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' })
          .eq('id', uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES')
          .eq('status', 'RESERVING').gt('expires_at', new Date().toISOString()).select('id,expires_at').maybeSingle();
        if (saveError || !saved || !Number.isFinite(Date.parse(saved.expires_at)) || Date.parse(saved.expires_at) <= Date.now()) {
          const revoked = await revokeDriveResumableSession(sessionUri).catch(() => false);
          await admin.from('evento_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : { session_uri: sessionUri }) })
            .eq('id', uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES').in('status', ['RESERVING', 'UPLOADING']);
          return failure('CONFLICT', 'No se pudo guardar una sesión válida para la reserva.', saveError?.code);
        }
        return success({ uploadId, fileName: input.fileName, mimeType: rule.mimeType, size: input.size, transfer: { url: sessionUri, resumable: true, expiresAt: saved.expires_at } });
      } catch (cause) {
        return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.');
      }
    },

    async finalizeUpload(kind, request, actor, input) {
      if (kind !== 'DELIVERABLE' || !UUID.test(input.uploadId)) return failure('INVALID_INPUT', 'Carga de entregable no válida.');
      const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read', 'design.requests.upload']);
      if ('error' in current) return current.error;
      if (current.detail.diseno_estatus !== 'EN_DISENO' || !current.detail.diseno_iniciado_en || !activeEvent(current)) return failure('INVALID_STATE', 'El evento ya no admite entregables.');
      const admin = getSupabaseAdmin();
      const { data: upload, error } = await admin.from('evento_drive_uploads').select('*').eq('id', input.uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES').maybeSingle();
      if (error) return failure(classifyError(error), 'No se pudo consultar la carga.', error.code);
      if (!upload) return failure('NOT_FOUND', 'No se encontró la carga de entregable.');
      if (upload.status !== 'UPLOADING' || Date.parse(upload.expires_at) <= Date.now()) return failure('CONFLICT', 'La carga ya no está pendiente o venció.');
      try {
        const folders = await ensureEventFolders(current);
        const file = await findDriveUploadedFile(folders.deliverablesId, input.uploadId);
        if (!file || file.size !== Number(upload.file_size) || file.name !== upload.file_name || file.mimeType !== upload.mime_type) return failure('CONFLICT', 'Drive todavía no confirma los metadatos esperados del archivo.');
        const { data: completed, error: finalizeError } = await admin.rpc('finalize_evento_deliverable_upload', {
          p_upload_id: input.uploadId, p_evento_id: current.detail.id, p_actor_id: current.context.user.id, p_drive_file_id: file.id,
        });
        if (finalizeError) return failure(classifyError(finalizeError), 'No se pudo confirmar la carga.', finalizeError.code);
        if (!completed?.includes(input.uploadId)) return failure('CONFLICT', 'El evento o la reserva cambiaron antes de confirmar la carga.');
        return success({ id: file.id, kind, fileName: file.name, mimeType: file.mimeType, size: file.size, url: file.webViewLink, createdAt: file.createdTime || null });
      } catch (cause) {
        return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'No se pudo confirmar el archivo.');
      }
    },

    async resumeUpload(kind, request, actor, uploadId) {
      if (kind !== 'DELIVERABLE' || !UUID.test(uploadId)) return failure('INVALID_INPUT', 'Carga de entregable no válida.');
      const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read', 'design.requests.upload']);
      if ('error' in current) return current.error;
      if (current.detail.diseno_estatus !== 'EN_DISENO' || !activeEvent(current)) return failure('INVALID_STATE', 'El evento ya no permite reanudar cargas.');
      const { data: upload, error } = await getSupabaseAdmin().from('evento_drive_uploads').select('*')
        .eq('id', uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES').maybeSingle();
      if (error) return failure(classifyError(error), 'No se pudo consultar la carga.', error.code);
      if (!upload) return failure('NOT_FOUND', 'No se encontró una carga operable.');
      if (upload.status !== 'UPLOADING' || !upload.session_uri || Date.parse(upload.expires_at) <= Date.now()) return failure('INVALID_STATE', 'La sesión venció o ya no puede reanudarse.');
      return success({ uploadId, fileName: upload.file_name, mimeType: upload.mime_type, size: Number(upload.file_size), transfer: { url: upload.session_uri, resumable: true, expiresAt: upload.expires_at } });
    },

    async cancelUpload(kind, request, actor, uploadId) {
      if (kind !== 'DELIVERABLE' || !UUID.test(uploadId)) return failure('INVALID_INPUT', 'Carga de entregable no válida.');
      const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read', 'design.requests.upload']);
      if ('error' in current) return current.error;
      if (current.detail.diseno_estatus !== 'EN_DISENO' || !activeEvent(current)) return failure('INVALID_STATE', 'El evento ya no permite cancelar cargas.');
      const admin = getSupabaseAdmin();
      const { data: upload, error } = await admin.from('evento_drive_uploads').select('id,session_uri,status,expires_at')
        .eq('id', uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES').maybeSingle();
      if (error) return failure(classifyError(error), 'No se pudo consultar la carga.', error.code);
      if (!upload) return failure('NOT_FOUND', 'No se encontró una carga operable.');
      if (!['UPLOADING', 'CANCEL_PENDING'].includes(upload.status) || Date.parse(upload.expires_at) <= Date.now()) return failure('CONFLICT', 'La reserva ya fue completada o venció.');
      const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
      const { data: updated, error: updateError } = await admin.from('evento_drive_uploads')
        .update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : {}) })
        .eq('id', uploadId).eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id).eq('carpeta', 'ENTREGABLES')
        .in('status', ['UPLOADING', 'CANCEL_PENDING']).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
      if (updateError) return failure(classifyError(updateError), 'No se pudo cancelar la carga.', updateError.code);
      if (!updated) return failure('CONFLICT', 'La carga cambió de estado y no se pudo cancelar.');
      return revoked ? success(undefined) : failure('UNAVAILABLE', 'No se pudo revocar la sesión; se conserva como CANCEL_PENDING.');
    },

    async listFiles(kind, request, actor): Promise<Result<readonly DesignRequestFile[]>> {
      if (kind !== 'BRIEF' && kind !== 'DELIVERABLE') return failure('INVALID_INPUT', 'Tipo de archivo no compatible.');
      const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read']);
      if ('error' in current) return current.error;
      const folderId = kind === 'BRIEF' ? current.lifecycle.drive_brief_folder_id ?? current.detail.drive_brief_folder_id : current.lifecycle.drive_deliverables_folder_id ?? current.detail.drive_deliverables_folder_id;
      if (!folderId) return success([]);
      try {
        const files = await listDriveFolderFiles(folderId);
        return success(files.map((file) => ({ id: file.id, kind, fileName: file.name, mimeType: file.mimeType, size: file.size, url: file.webViewLink, createdAt: file.createdTime || null })));
      } catch (cause) {
        return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'No se pudieron consultar los archivos.');
      }
    },

    async listPendingUploads(kind, request, actor): Promise<Result<readonly DesignPendingUpload[]>> {
      if (kind !== 'DELIVERABLE') {
        const read = await authorize(actor, ['design.requests.read']);
        if ('error' in read) return read.error;
        return success([]);
      }
      const current = await loadCurrent(request.sourceRecordId, actor, ['design.requests.read', 'design.requests.upload']);
      if ('error' in current) return current.error;
      if (current.detail.diseno_estatus !== 'EN_DISENO' || !activeEvent(current)) return success([]);
      const { data, error } = await getSupabaseAdmin().from('evento_drive_uploads')
        .select('id,file_name,mime_type,file_size,status,expires_at').eq('evento_id', current.detail.id).eq('actor_id', current.context.user.id)
        .eq('carpeta', 'ENTREGABLES').in('status', ['RESERVING', 'UPLOADING', 'CANCEL_PENDING']).gt('expires_at', new Date().toISOString());
      if (error) return failure(classifyError(error), 'No se pudieron consultar las cargas pendientes.', error.code);
      return success((data ?? []).map((item) => ({
        id: item.id, kind: 'DELIVERABLE', fileName: item.file_name, mimeType: item.mime_type, size: Number(item.file_size),
        status: item.status === 'CANCEL_PENDING' ? 'CANCEL_PENDING' : item.status === 'RESERVING' ? 'RESERVING' : 'UPLOADING', expiresAt: item.expires_at,
      })));
    },
  },
};

export { mapEvent as mapEventsDesignRequest };
export default source;
