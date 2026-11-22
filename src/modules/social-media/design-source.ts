import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  countDriveFolderFiles,
  createDriveResumableSession,
  ensurePublicacionDriveFolders,
  findDriveUploadedFile,
  listDriveFolderFiles,
  revokeDriveResumableSession,
} from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import type { Database } from '@/types/database.types';

export type SocialMediaDesignFilters = {
  channels?: readonly string[];
  formats?: readonly string[];
};

type PublicationRow = Database['public']['Functions']['get_design_publication_queue']['Returns'][number];
type DetailRow = Database['public']['Functions']['get_design_publication_request']['Returns'][number];
type TimelineRow = Database['public']['Functions']['get_design_publication_timeline']['Returns'][number];
type CommentRow = Database['public']['Functions']['get_design_publication_comments']['Returns'][number];
type ChannelRow = Database['public']['Functions']['get_design_publication_channels']['Returns'][number];
type DesignerRow = Database['public']['Functions']['get_publication_designer_names']['Returns'][number];
type SocialRequest = DesignRequestModel<'SOCIAL_MEDIA'>;
type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
type Authorization = { context: AuthContext } | { error: Result<never> };
type LoadedPublication = { context: AuthContext; publication: DetailRow } | { error: Result<never> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function success<T>(value: T): Result<T> { return { ok: true, value }; }
function failure<T = never>(code: DesignRequestError['code'], message: string, sourceCode?: string): Result<T> {
  return { ok: false, error: { code, message, ...(sourceCode ? { sourceCode } : {}) } };
}

function classifyError(error: { code?: string; message?: string } | null | undefined): DesignRequestError['code'] {
  if (error?.code === '42501' || /permission|forbidden|permiso|autoriz|solo dise/i.test(error?.message ?? '')) return 'FORBIDDEN';
  if (error?.code === '23505' || error?.code === '40001') return 'CONFLICT';
  if (error?.code?.startsWith('08') || /timeout|unavailable|network|fetch|connection/i.test(error?.message ?? '')) return 'UNAVAILABLE';
  return 'SOURCE_ERROR';
}

function classifyReservationError(error: { code?: string; message?: string } | null | undefined): DesignRequestError['code'] {
  const message = error?.message?.toLocaleLowerCase() ?? '';
  if (message.includes('solo dise')) return 'FORBIDDEN';
  if (message.includes('solicitud no') && message.includes('activa')) return 'INVALID_STATE';
  if (message.includes('20 archivos') || message.includes('reservadas')) return 'CONFLICT';
  if (message.includes('pesa hasta') || message.includes('tama')) return 'UPLOAD_REJECTED';
  if (message.includes('conteo')) return 'INVALID_INPUT';
  return classifyError(error);
}

function normalizeStatus(value: string): SocialRequest['status'] {
  if (value === 'EN_DISENO') return 'IN_PROGRESS';
  if (value === 'EN_CORRECCION' || value === 'RECHAZADO_DISENO') return 'NEEDS_CHANGES';
  if (['EN_REVISION_CM', 'APROBADO', 'PROGRAMADO', 'PUBLICADO', 'ENTREGADO'].includes(value)) return 'DELIVERED';
  if (value === 'CANCELADO') return 'CANCELLED';
  return 'REQUESTED';
}

function normalizePriority(value: number | null): SocialRequest['priority'] {
  if (value === 1) return 'HIGH';
  if (value === 2) return 'NORMAL';
  if (value === 3) return 'LOW';
  return null;
}

export function mapSocialMediaPublication(
  row: PublicationRow | DetailRow,
  channels: readonly string[] = [],
  campaignName: string | null = null,
): SocialRequest {
  const format = row.formato;
  const publicationDate = row.fecha_publicacion;
  return {
    id: `SOCIAL_MEDIA:${row.id}`,
    source: 'SOCIAL_MEDIA',
    sourceRecordId: row.id,
    title: row.titulo,
    requesterId: row.creador_id,
    requestedAt: row.fecha_solicitud_diseno ?? row.created_at,
    instructions: row.instrucciones_diseno ?? '',
    targetDate: row.fecha_entrega_diseno_estimada ?? publicationDate,
    requestedOutputs: [{ category: 'SOCIAL_MEDIA', sourceFormatCode: format, label: format }],
    status: normalizeStatus(row.estatus),
    sourceStatus: row.estatus,
    designerId: row.disenador_id,
    startedAt: row.estatus === 'EN_DISENO' ? row.updated_at : null,
    deliveredAt: row.fecha_entrega_diseno_real,
    priority: normalizePriority(row.prioridad),
    updatedAt: row.updated_at,
    sourceData: {
      format,
      channels: [...channels],
      publicationDate,
      ...(campaignName !== null ? { campaignName } : {}),
    },
  };
}

function timelineEntry(row: TimelineRow): DesignHistoryEntry {
  return { at: row.at, label: row.label, note: row.note };
}

function priorityFromRow(row: DetailRow) { return normalizePriority(row.prioridad); }

async function authorize(actor: DesignActor, permission: Parameters<typeof authorizeAction>[0]): Promise<Authorization> {
  const access = await authorizeAction(permission);
  if (access.error || !access.context) return { error: failure(permission === 'design.requests.read' ? 'FORBIDDEN' : 'FORBIDDEN', access.error ?? 'No tienes permiso para realizar esta acción.') } as const;
  if (access.context.user.id !== actor.id) return { error: failure('FORBIDDEN', 'El actor no coincide con la sesión autenticada.') } as const;
  return { context: access.context } as const;
}

async function authorizePublicationRead(actor: DesignActor, permission: Parameters<typeof authorizeAction>[0]): Promise<Authorization> {
  const access = await authorize(actor, permission);
  if ('error' in access) return access;
  // The existing publication RPCs enforce this legacy source permission internally.
  const publicationRead = await authorize(actor, 'design.posts.read');
  if ('error' in publicationRead) return publicationRead;
  return access;
}

async function loadPublication(id: string, actor: DesignActor, permission: 'design.requests.read' | 'design.posts.upload' | 'design.posts.start' | 'design.posts.deliver'): Promise<LoadedPublication> {
  if (!UUID.test(id)) return { error: failure('INVALID_INPUT', 'El identificador de publicación no es válido.') } as const;
  const authorized = await authorizePublicationRead(actor, permission);
  if ('error' in authorized) return { error: authorized.error };
  const { data, error } = await authorized.context.supabase.rpc('get_design_publication_request', { p_id: id });
  if (error) return { error: failure(classifyError(error), 'No se pudo consultar la solicitud.', error.code) } as const;
  const publication = data?.[0];
  if (!publication) return { error: failure('NOT_FOUND', 'No se encontró la solicitud de Diseño.') } as const;
  return { context: authorized.context, publication } as const;
}

async function campaignNames(supabase: SupabaseClient<Database>, rows: readonly PublicationRow[]) {
  const ids = [...new Set(rows.map((row) => row.campana_id).filter((id): id is string => !!id))];
  if (!ids.length) return new Map<string, string>();
  try {
    const { data, error } = await supabase.from('campanas').select('id,nombre').in('id', ids);
    if (error) return new Map<string, string>();
    return new Map((data ?? []).map((row) => [row.id, row.nombre]));
  } catch {
    return new Map<string, string>();
  }
}

function rowHasStatus(row: SocialRequest, statuses: readonly SocialRequest['status'][] | undefined) {
  return !statuses?.length || statuses.includes(row.status);
}

async function foldersFor(publication: Pick<DetailRow, 'id' | 'drive_folder_id' | 'drive_brief_folder_id' | 'drive_deliverables_folder_id'>) {
  if (!publication.drive_folder_id) throw new Error('La publicación no tiene carpeta raíz de Drive.');
  if (publication.drive_brief_folder_id && publication.drive_deliverables_folder_id) {
    return { briefId: publication.drive_brief_folder_id, deliverablesId: publication.drive_deliverables_folder_id };
  }
  const folders = await ensurePublicacionDriveFolders(publication.drive_folder_id);
  const { error } = await getSupabaseAdmin().from('publicaciones').update({
    drive_brief_folder_id: folders.brief.id,
    drive_deliverables_folder_id: folders.deliverables.id,
  }).eq('id', publication.id);
  if (error) throw new Error('No se pudieron guardar las carpetas de Drive.');
  return { briefId: folders.brief.id, deliverablesId: folders.deliverables.id };
}

async function deliveryEligibility(id: string, actor: DesignActor): Promise<Result<boolean>> {
  const loaded = await loadPublication(id, actor, 'design.posts.deliver');
  if ('error' in loaded) return loaded.error;
  if (loaded.publication.estatus !== 'EN_DISENO') return success(false);
  if (!loaded.publication.drive_folder_id) return failure('INVALID_STATE', 'Esta publicación no tiene carpeta de Drive.');
  try {
    const dirs = await foldersFor(loaded.publication);
    const [files, cycle] = await Promise.all([
      listDriveFolderFiles(dirs.deliverablesId),
      getSupabaseAdmin().from('publicacion_estatus_historial').select('cambiado_en').eq('publicacion_id', id).eq('estatus_nuevo', 'EN_DISENO').order('cambiado_en', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (cycle.error) return failure(classifyError(cycle.error), 'No se pudo consultar el ciclo de Diseño.', cycle.error.code);
    const cycleStart = cycle.data?.cambiado_en;
    const ready = cycleStart
      ? files.some((file) => !!file.createdTime && Date.parse(file.createdTime) > Date.parse(cycleStart))
      : files.length > 0;
    return success(ready);
  } catch {
    return failure('UNAVAILABLE', 'No se pudo verificar Entregables en Drive.');
  }
}

async function transition(id: string, actor: DesignActor, permission: 'design.posts.start' | 'design.posts.deliver', status: 'EN_DISENO' | 'EN_REVISION_CM'): Promise<Result<void>> {
  const loaded = await loadPublication(id, actor, permission);
  if ('error' in loaded) return loaded.error;
  if (status === 'EN_DISENO' && !['SOLICITADO', 'EN_CORRECCION'].includes(loaded.publication.estatus)) return failure('INVALID_STATE', 'La solicitud ya no está disponible para iniciar o reabrir.');
  if (status === 'EN_REVISION_CM') {
    const eligible = await deliveryEligibility(id, actor);
    if (!eligible.ok) return eligible;
    if (!eligible.value) return failure('INVALID_STATE', 'Sube un archivo nuevo a Entregables después de iniciar el ciclo actual.');
  }
  const { data, error } = await loaded.context.supabase.rpc('transition_publicacion_status', {
    p_publicacion_id: id,
    p_estatus_nuevo: status,
    p_motivo: undefined,
  });
  if (error) {
    const stateConflict = error.code === 'P0001'
      && error.message?.toLocaleLowerCase().includes('transici')
      && error.message.toLocaleLowerCase().includes('permitida');
    return failure(stateConflict ? 'CONFLICT' : classifyError(error), 'No se pudo cambiar el estado de la publicación.', error.code);
  }
  if (!data || data.id !== id || data.estatus !== status) {
    return failure('CONFLICT', 'La publicación cambió de estado antes de completar la operación.');
  }
  return success(undefined);
}

const source: DesignRequestSource<'SOCIAL_MEDIA', SocialMediaDesignFilters> = {
  source: 'SOCIAL_MEDIA',

  async list(filters: DesignRequestListFilters<SocialMediaDesignFilters>, actor) {
    const authorized = await authorizePublicationRead(actor, 'design.requests.read');
    if ('error' in authorized) return authorized.error;
    const { data: rows, error } = await authorized.context.supabase.rpc('get_design_publication_queue');
    if (error) return failure(classifyError(error), 'No se pudo cargar la cola de publicaciones.', error.code);
    const publications = rows ?? [];
    if (!publications.length) return success([]);
    const ids = publications.map((row) => row.id);
    const [channelResult, designerResult, campaignMap] = await Promise.all([
      authorized.context.supabase.rpc('get_design_publication_channels', { p_ids: ids }),
      authorized.context.supabase.rpc('get_publication_designer_names', { p_ids: ids }),
      campaignNames(authorized.context.supabase, publications),
    ]);
    if (channelResult.error) return failure(classifyError(channelResult.error), 'No se pudieron cargar los canales.', channelResult.error.code);
    if (designerResult.error) return failure(classifyError(designerResult.error), 'No se pudieron cargar los diseñadores.', designerResult.error.code);
    const channelRows: ChannelRow[] = channelResult.data ?? [];
    const designers: DesignerRow[] = designerResult.data ?? [];
    const channelsById = new Map<string, string[]>();
    for (const channel of channelRows) channelsById.set(channel.publicacion_id, [...(channelsById.get(channel.publicacion_id) ?? []), channel.canal]);
    const requests = publications.map((row) => ({
      ...mapSocialMediaPublication(row, channelsById.get(row.id) ?? [], row.campana_id ? campaignMap.get(row.campana_id) ?? null : null),
      designerId: designers.find((designer) => designer.publicacion_id === row.id)?.disenador_id ?? row.disenador_id,
    }));
    const search = filters.search?.trim().toLocaleLowerCase();
    const wantedChannels = filters.sourceSpecific?.channels?.map((value) => value.toLocaleLowerCase());
    const wantedFormats = filters.sourceSpecific?.formats?.map((value) => value.toLocaleLowerCase());
    const filtered = requests.filter((request) => {
      if (!rowHasStatus(request, filters.statuses)) return false;
      if (filters.designerId !== undefined && request.designerId !== filters.designerId) return false;
      if (filters.targetDateFrom && (!request.targetDate || request.targetDate < filters.targetDateFrom)) return false;
      if (filters.targetDateTo && (!request.targetDate || request.targetDate > filters.targetDateTo)) return false;
      if (search && !`${request.title} ${request.instructions} ${request.sourceData.format} ${request.sourceData.channels.join(' ')}`.toLocaleLowerCase().includes(search)) return false;
      if (wantedChannels?.length && !request.sourceData.channels.some((channel) => wantedChannels.includes(channel.toLocaleLowerCase()))) return false;
      if (wantedFormats?.length && !wantedFormats.includes(request.sourceData.format.toLocaleLowerCase())) return false;
      return true;
    });
    return success(filtered);
  },

  async getDetail(id, actor): Promise<Result<DesignRequestDetailModel<'SOCIAL_MEDIA'>>> {
    const loaded = await loadPublication(id, actor, 'design.requests.read');
    if ('error' in loaded) return loaded.error;
    const [{ data: comments, error: commentsError }, { data: history, error: historyError }, { data: names, error: namesError }, { data: channels, error: channelsError }] = await Promise.all([
      loaded.context.supabase.rpc('get_design_publication_comments', { p_ids: [id] }),
      loaded.context.supabase.rpc('get_design_publication_timeline', { p_id: id }),
      loaded.context.supabase.rpc('get_publication_designer_names', { p_ids: [id] }),
      loaded.context.supabase.rpc('get_design_publication_channels', { p_ids: [id] }),
    ]);
    const rpcError = commentsError ?? historyError ?? namesError ?? channelsError;
    if (rpcError) return failure(classifyError(rpcError), 'No se pudo cargar el detalle de la solicitud.', rpcError.code);
    const campaignMap = await campaignNames(loaded.context.supabase, [loaded.publication]);
    const row = loaded.publication;
    const historyEntries = (history ?? []).map(timelineEntry);
    const correction: CommentRow | undefined = [...(comments ?? [])].filter((comment) => comment.tipo === 'CORRECCION').sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0];
    const designer = (names ?? []).find((item) => item.publicacion_id === id);
    const base = mapSocialMediaPublication(row, (channels ?? []).map((item) => item.canal), row.campana_id ? campaignMap.get(row.campana_id) ?? null : null);
    return success({
      ...base,
      createdAt: row.created_at,
      designer: row.disenador_id ? { id: row.disenador_id, name: designer?.full_name ?? null } : null,
      usageDate: { label: 'Publicación', value: row.fecha_publicacion },
      copy: { hook: row.hook_texto ?? '', body: row.body_texto ?? '', cta: row.cta_texto ?? '', hashtags: row.hashtags ?? [] },
      correction: correction ? { text: correction.texto, at: correction.creado_en } : historyEntries.slice().reverse().find((entry) => entry.label === 'EN_CORRECCION' && entry.note) ? {
        text: historyEntries.slice().reverse().find((entry) => entry.label === 'EN_CORRECCION' && entry.note)!.note ?? '',
        at: historyEntries.slice().reverse().find((entry) => entry.label === 'EN_CORRECCION' && entry.note)!.at,
      } : null,
      history: historyEntries,
      priority: priorityFromRow(row),
    });
  },

  async capabilities(request, actor): Promise<Result<DesignRequestCapabilities>> {
    const readAccess = await authorizePublicationRead(actor, 'design.requests.read');
    if ('error' in readAccess) return readAccess.error;
    const startAccess = await authorizeAction('design.posts.start');
    const uploadAccess = await authorizeAction('design.posts.upload');
    const deliverAccess = await authorizeAction('design.posts.deliver');
    const currentResult = await readAccess.context.supabase.rpc('get_design_publication_request', { p_id: request.sourceRecordId });
    if (currentResult.error) return failure(classifyError(currentResult.error), 'No se pudo actualizar el estado de la solicitud.', currentResult.error.code);
    const current = currentResult.data?.[0];
    if (!current) return failure('NOT_FOUND', 'No se encontró la solicitud de Diseño.');
    const inWorkCycle = current.estatus === 'EN_DISENO';
    const canStart = !!startAccess.context && startAccess.context.user.id === actor.id;
    const canUpload = !!uploadAccess.context && uploadAccess.context.user.id === actor.id && inWorkCycle;
    const canDeliver = !!deliverAccess.context && deliverAccess.context.user.id === actor.id && inWorkCycle;
    const start = canStart && current.estatus === 'SOLICITADO';
    const reopen = canStart && current.estatus === 'EN_CORRECCION';
    const eligible = canDeliver ? await deliveryEligibility(request.sourceRecordId, actor) : success(false);
    if (!eligible.ok && eligible.error.code !== 'FORBIDDEN') return eligible;
    return success({
      start,
      reopen,
      deliver: canDeliver && eligible.ok && eligible.value,
      fileAccess: {
        BRIEF: { readCompletedFiles: true, readPendingUploads: false },
        DELIVERABLE: { readCompletedFiles: true, readPendingUploads: canUpload },
      },
      uploads: {
        DELIVERABLE: {
          reserve: canUpload,
          finalize: canUpload,
          resumable: canUpload,
          cancellable: canUpload,
          maxFiles: DRIVE_FILE_RULES.ENTREGABLES.maxFiles,
          maxBytes: DRIVE_FILE_RULES.ENTREGABLES.maxBytes,
          acceptedMimeTypes: Object.values(DRIVE_FILE_RULES.ENTREGABLES.mimeByExtension),
        },
      },
    });
  },

  async start(request, actor) { return transition(request.sourceRecordId, actor, 'design.posts.start', 'EN_DISENO'); },
  async reopen(request, actor) { return transition(request.sourceRecordId, actor, 'design.posts.start', 'EN_DISENO'); },
  async deliver(request, actor) { return transition(request.sourceRecordId, actor, 'design.posts.deliver', 'EN_REVISION_CM'); },
  async deliverEligibility(request, actor) {
    const result = await deliveryEligibility(request.sourceRecordId, actor);
    if (!result.ok) return result;
    return success({ eligible: result.value, reason: result.value ? null : { code: 'INVALID_STATE', message: 'Se requiere un entregable creado durante el ciclo actual de Diseño.' } });
  },

  uploads: {
    supportedKinds: ['DELIVERABLE'],
    async reserveUpload(kind, request, actor, input: DesignUploadInput): Promise<Result<DesignUploadReservation>> {
      if (kind !== 'DELIVERABLE') return failure('INVALID_INPUT', 'Social Media solo admite cargas de entregables en Diseño.');
      const loaded = await loadPublication(request.sourceRecordId, actor, 'design.posts.upload');
      if ('error' in loaded) return loaded.error;
      if (loaded.publication.estatus !== 'EN_DISENO') return failure('INVALID_STATE', 'La solicitud no está en el ciclo de trabajo de Diseño.');
      const rule = getDriveFileRule('ENTREGABLES', input.fileName);
      if (!rule) return failure('UPLOAD_REJECTED', 'El formato de archivo no está permitido.');
      if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > rule.maxBytes) return failure('UPLOAD_REJECTED', 'El tamaño del archivo supera el límite permitido.');
      if (input.mimeType && input.mimeType !== rule.mimeType) return failure('UPLOAD_REJECTED', 'El tipo MIME no coincide con la extensión del archivo.');
      try {
        const dirs = await foldersFor(loaded.publication);
        const count = await countDriveFolderFiles(dirs.deliverablesId);
        const admin = getSupabaseAdmin();
        const { data: uploadId, error } = await admin.rpc('reserve_publication_deliverable_upload', {
          p_actor_id: loaded.context.user.id,
          p_publication_id: loaded.publication.id,
          p_file_name: input.fileName,
          p_mime_type: rule.mimeType,
          p_file_size: input.size,
          p_drive_file_count: Math.min(count, DRIVE_FILE_RULES.ENTREGABLES.maxFiles),
        });
        if (error || !uploadId) return failure(error ? classifyReservationError(error) : 'CONFLICT', 'No se pudo reservar el entregable.', error?.code);
        let sessionUri: string;
        try {
          sessionUri = await createDriveResumableSession({ folderId: dirs.deliverablesId, uploadId, name: input.fileName, mimeType: rule.mimeType, size: input.size });
        } catch (cause) {
          await admin.from('publicacion_drive_uploads').update({ status: 'CANCELLED' }).eq('id', uploadId).eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES');
          return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'Drive no pudo iniciar la carga.');
        }
        const { data: savedUpload, error: updateError } = await admin.from('publicacion_drive_uploads').update({ session_uri: sessionUri, status: 'UPLOADING' }).eq('id', uploadId).eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES').eq('status', 'RESERVING').select('id,expires_at').maybeSingle();
        if (updateError || !savedUpload) {
          const revoked = await revokeDriveResumableSession(sessionUri).catch(() => false);
          await admin.from('publicacion_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : { session_uri: sessionUri }) }).eq('id', uploadId).eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES').in('status', ['RESERVING', 'UPLOADING']);
          return failure('CONFLICT', 'No se pudo guardar la sesión segura de carga.', updateError?.code);
        }
        if (!Number.isFinite(Date.parse(savedUpload.expires_at)) || Date.parse(savedUpload.expires_at) <= Date.now()) {
          const revoked = await revokeDriveResumableSession(sessionUri).catch(() => false);
          await admin.from('publicacion_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : { session_uri: sessionUri }) }).eq('id', uploadId).eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES').eq('status', 'UPLOADING');
          return failure('CONFLICT', 'La reserva expiró antes de completar su sesión.');
        }
        return success({ uploadId, fileName: input.fileName, mimeType: rule.mimeType, size: input.size, transfer: { url: sessionUri, resumable: true, expiresAt: savedUpload.expires_at } });
      } catch (cause) {
        return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.');
      }
    },

    async finalizeUpload(kind, request, actor, input) {
      if (kind !== 'DELIVERABLE' || !UUID.test(input.uploadId)) return failure('INVALID_INPUT', 'Carga de entregable no válida.');
      const loaded = await loadPublication(request.sourceRecordId, actor, 'design.posts.upload');
      if ('error' in loaded) return loaded.error;
      if (loaded.publication.estatus !== 'EN_DISENO') return failure('INVALID_STATE', 'La solicitud ya no está en Diseño.');
      const admin = getSupabaseAdmin();
      const { data: upload, error } = await admin.from('publicacion_drive_uploads').select('*').eq('id', input.uploadId).eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES').maybeSingle();
      if (error) return failure(classifyError(error), 'No se pudo consultar la carga.', error.code);
      if (!upload) return failure('NOT_FOUND', 'No se encontró la carga de entregable.');
      if (upload.status !== 'UPLOADING' || Date.parse(upload.expires_at) <= Date.now()) return failure('CONFLICT', 'La carga ya no está pendiente o venció.');
      try {
        const dirs = await foldersFor(loaded.publication);
        let file = await findDriveUploadedFile(dirs.deliverablesId, input.uploadId).catch(() => null);
        for (let attempt = 0; (!file || file.size !== Number(upload.file_size)) && attempt < 5; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          file = await findDriveUploadedFile(dirs.deliverablesId, input.uploadId).catch(() => null);
        }
        if (!file || file.size !== Number(upload.file_size) || file.name !== upload.file_name || file.mimeType !== upload.mime_type) return failure('CONFLICT', 'Drive todavía no confirma los metadatos esperados del archivo.');
        const { data: completedIds, error: finalizeError } = await admin.rpc('finalize_publication_deliverable_upload', {
          p_upload_id: input.uploadId,
          p_publication_id: loaded.publication.id,
          p_actor_id: loaded.context.user.id,
          p_drive_file_id: file.id,
        });
        if (finalizeError) return failure(classifyError(finalizeError), 'No se pudo confirmar la carga.', finalizeError.code);
        if (!completedIds?.includes(input.uploadId)) return failure('CONFLICT', 'La carga cambió de estado antes de confirmarse.');
        return success({ id: file.id, kind, fileName: file.name, mimeType: file.mimeType, size: file.size, url: file.webViewLink, createdAt: file.createdTime });
      } catch (cause) {
        return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'No se pudo confirmar el archivo.');
      }
    },

    async resumeUpload(kind, request, actor, uploadId) {
      if (kind !== 'DELIVERABLE' || !UUID.test(uploadId)) return failure('INVALID_INPUT', 'Carga de entregable no válida.');
      const loaded = await loadPublication(request.sourceRecordId, actor, 'design.posts.upload');
      if ('error' in loaded) return loaded.error;
      if (loaded.publication.estatus !== 'EN_DISENO') return failure('INVALID_STATE', 'La solicitud ya no permite cargar entregables.');
      const admin = getSupabaseAdmin();
      const { data: upload, error } = await admin.from('publicacion_drive_uploads').select('*').eq('id', uploadId).eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES').maybeSingle();
      if (error) return failure(classifyError(error), 'No se pudo consultar la carga.', error.code);
      if (!upload) return failure('NOT_FOUND', 'No se encontró la carga.');
      if (upload.status !== 'UPLOADING' || !upload.session_uri || Date.parse(upload.expires_at) <= Date.now()) return failure('INVALID_STATE', 'La sesión venció o ya no se puede reanudar.');
      return success({ uploadId, fileName: upload.file_name, mimeType: upload.mime_type, size: Number(upload.file_size), transfer: { url: upload.session_uri, resumable: true, expiresAt: upload.expires_at } });
    },

    async cancelUpload(kind, request, actor, uploadId) {
      if (kind !== 'DELIVERABLE' || !UUID.test(uploadId)) return failure('INVALID_INPUT', 'Carga de entregable no válida.');
      const authorized = await authorize(actor, 'design.posts.upload');
      if ('error' in authorized) return authorized.error;
      const admin = getSupabaseAdmin();
      const { data: upload, error } = await admin.from('publicacion_drive_uploads').select('id,publicacion_id,actor_id,session_uri').eq('id', uploadId).eq('publicacion_id', request.sourceRecordId).eq('actor_id', authorized.context.user.id).eq('carpeta', 'ENTREGABLES').maybeSingle();
      if (error) return failure(classifyError(error), 'No se pudo consultar la carga.', error.code);
      if (!upload) return failure('NOT_FOUND', 'No se encontró una carga operable.');
      const current = await loadPublication(request.sourceRecordId, actor, 'design.posts.upload');
      if ('error' in current) return current.error;
      if (current.publication.estatus !== 'EN_DISENO') return failure('INVALID_STATE', 'La solicitud ya no permite cancelar una carga.');
      const revoked = upload.session_uri ? await revokeDriveResumableSession(upload.session_uri).catch(() => false) : true;
      const { data: updated, error: updateError } = await admin.from('publicacion_drive_uploads').update({ status: revoked ? 'CANCELLED' : 'CANCEL_PENDING', ...(revoked ? { session_uri: null } : {}) }).eq('id', uploadId).eq('publicacion_id', request.sourceRecordId).eq('actor_id', authorized.context.user.id).eq('carpeta', 'ENTREGABLES').eq('status', 'UPLOADING').select('id').maybeSingle();
      if (updateError) return failure(classifyError(updateError), 'No se pudo cancelar la carga.', updateError.code);
      if (!updated) return failure('CONFLICT', 'La carga cambió de estado y no se pudo cancelar.');
      return revoked ? success(undefined) : failure('UNAVAILABLE', 'No se pudo cancelar la sesión; el cupo se libera al vencer.');
    },

    async listFiles(kind, request, actor): Promise<Result<readonly DesignRequestFile[]>> {
      if (kind !== 'BRIEF' && kind !== 'DELIVERABLE') return failure('INVALID_INPUT', 'Tipo de archivo no compatible.');
      const loaded = await loadPublication(request.sourceRecordId, actor, 'design.requests.read');
      if ('error' in loaded) return loaded.error;
      try {
        const dirs = await foldersFor(loaded.publication);
        const folder = kind === 'BRIEF' ? dirs.briefId : dirs.deliverablesId;
        const files = await listDriveFolderFiles(folder);
        return success(files.map((file) => ({ id: file.id, kind, fileName: file.name, mimeType: file.mimeType, size: file.size, url: file.webViewLink, createdAt: file.createdTime || null })));
      } catch (cause) {
        return failure('UNAVAILABLE', cause instanceof Error ? cause.message : 'No se pudieron consultar los archivos.');
      }
    },

    async listPendingUploads(kind, request, actor): Promise<Result<readonly DesignPendingUpload[]>> {
      if (kind !== 'DELIVERABLE') return success([]);
      const loaded = await loadPublication(request.sourceRecordId, actor, 'design.posts.upload');
      if ('error' in loaded) return loaded.error;
      if (loaded.publication.estatus !== 'EN_DISENO') return success([]);
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('publicacion_drive_uploads').select('id,file_name,mime_type,file_size,status,expires_at').eq('publicacion_id', loaded.publication.id).eq('actor_id', loaded.context.user.id).eq('carpeta', 'ENTREGABLES').in('status', ['RESERVING', 'UPLOADING', 'CANCEL_PENDING']).gt('expires_at', new Date().toISOString());
      if (error) return failure(classifyError(error), 'No se pudieron consultar las cargas pendientes.', error.code);
      return success((data ?? []).map((item) => ({ id: item.id, kind: 'DELIVERABLE', fileName: item.file_name, mimeType: item.mime_type, size: Number(item.file_size), status: item.status === 'CANCEL_PENDING' ? 'CANCEL_PENDING' : item.status === 'RESERVING' ? 'RESERVING' : 'UPLOADING', expiresAt: item.expires_at })));
    },
  },
};

export default source;
