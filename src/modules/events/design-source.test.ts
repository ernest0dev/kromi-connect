jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/dal', () => ({ authorizeAction: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ getSupabaseAdmin: jest.fn() }));
jest.mock('@/lib/driveFileRules', () => ({ DRIVE_FILE_RULES: { ENTREGABLES: { maxFiles: 20, maxBytes: 500_000_000, mimeByExtension: { '.pdf': 'application/pdf' } } }, getDriveFileRule: jest.fn() }));
jest.mock('@/lib/googleDrive', () => ({
  createDriveResumableSession: jest.fn(), ensurePublicacionDriveFolders: jest.fn(), findDriveUploadedFile: jest.fn(),
  listDriveFolderFiles: jest.fn(), revokeDriveResumableSession: jest.fn(),
}));

import { authorizeAction } from '@/lib/auth/dal';
import { createDriveResumableSession, ensurePublicacionDriveFolders, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getDriveFileRule } from '@/lib/driveFileRules';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import type { Database } from '@/types/database.types';
import source, { mapEventsDesignRequest } from './design-source';

const actorId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const uploadId = '00000000-0000-4000-8000-000000000003';
const eventQueueRow: Database['public']['Functions']['get_design_event_queue']['Returns'][number] = {
  id: eventId, nombre: 'Feria de primavera', inicio: '2026-12-10T10:00:00Z', fin: '2026-12-10T18:00:00Z',
  sedes: [{ sede_id: 'store-id', nombre: 'Tienda Centro' }], diseno_formatos: ['DIGITAL', 'IMPRESION'],
  instrucciones_diseno: 'Diseñar materiales para la feria.', fecha_entrega_diseno: '2026-12-08', diseno_estatus: 'EN_DISENO',
  disenador_id: actorId, diseno_solicitado_en: '2026-12-01T10:00:00Z', diseno_iniciado_en: '2026-12-02T10:00:00Z',
  diseno_entregado_en: '2026-12-12T10:00:00Z', drive_folder_id: 'root-folder', drive_brief_folder_id: 'brief-folder',
  drive_deliverables_folder_id: 'deliverables-folder', drive_brief_file_count: 1,
};
const eventDetail: Database['public']['Functions']['get_design_event_request']['Returns'][number] = {
  ...eventQueueRow, estatus: 'EN_PLANIFICACION', disenador_nombre: 'Ana Diseño', creado_en: '2026-11-30T10:00:00Z', creado_por: actorId,
};
const upload = {
  id: uploadId, actor_id: actorId, evento_id: eventId, carpeta: 'ENTREGABLES', status: 'UPLOADING', file_size: 12,
  expires_at: '2027-01-01T00:00:00Z', session_uri: 'https://www.googleapis.com/upload/drive/session', file_name: 'pieza.pdf', mime_type: 'application/pdf',
  created_at: '2026-12-02T11:00:00Z', drive_file_id: null, completed_at: null,
};

function setup(options: {
  denied?: readonly string[]; identity?: string; designStatus?: string; eventStatus?: string; archived?: string | null;
  noDetail?: boolean; noDeliverable?: boolean; emptyReservation?: boolean; expiredReservation?: boolean;
  emptyFinalization?: boolean; expiredUpload?: boolean; cancelPending?: boolean; emptyCancel?: boolean;
  rpcErrors?: Record<string, { code: string; message: string }>;
} = {}) {
  const calls: string[] = [];
  const supabase = {
    rpc: jest.fn(async (name: string) => {
      calls.push(name);
      if (options.rpcErrors?.[name]) return { data: null, error: options.rpcErrors[name] };
      if (name === 'get_design_event_queue') return { data: [eventQueueRow], error: null };
      if (name === 'get_design_event_request') return { data: options.noDetail ? [] : [{ ...eventDetail, diseno_estatus: options.designStatus ?? eventDetail.diseno_estatus, estatus: options.eventStatus ?? eventDetail.estatus }], error: null };
      if (name === 'get_design_event_timeline') return { data: [
        { at: '2026-12-02T10:00:00Z', label: 'EN_DISENO', note: null },
        { at: '2026-12-03T10:00:00Z', label: 'EN_CORRECCION', note: 'Ajustar el título.' },
      ], error: null };
      return { data: null, error: null };
    }),
  };
  let selected = '';
  let table = '';
  let updatedStatus = '';
  const query: Record<string, jest.Mock> = {};
  for (const method of ['select', 'update', 'eq', 'in', 'gt', 'is', 'limit']) {
    query[method] = jest.fn((...args: unknown[]) => {
      if (method === 'select') selected = String(args[0]);
      if (method === 'update') updatedStatus = String((args[0] as Record<string, unknown>).status ?? '');
      return query;
    });
  }
  query.maybeSingle = jest.fn(async () => {
    if (table === 'eventos') return { data: { estatus: options.eventStatus ?? 'EN_PLANIFICACION', archivado_en: options.archived ?? null, drive_folder_id: 'root-folder', drive_brief_folder_id: 'brief-folder', drive_deliverables_folder_id: 'deliverables-folder' }, error: null };
    if (selected === 'id,expires_at') return { data: options.emptyReservation ? null : { id: uploadId, expires_at: options.expiredReservation ? '2020-01-01T00:00:00Z' : upload.expires_at }, error: null };
    if (selected === 'id') return { data: options.emptyCancel ? null : { id: uploadId }, error: null };
    return { data: { ...upload, status: options.cancelPending ? 'CANCEL_PENDING' : 'UPLOADING', expires_at: options.expiredUpload ? '2020-01-01T00:00:00Z' : upload.expires_at }, error: null };
  });
  query.then = jest.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    const pending = table === 'eventos' ? [{ id: eventId, estatus: options.eventStatus ?? 'EN_PLANIFICACION' }]
      : table === 'evento_drive_uploads' && selected !== 'id,expires_at'
        ? options.noDeliverable ? [] : [{ id: uploadId, file_name: upload.file_name, mime_type: upload.mime_type, file_size: upload.file_size, status: options.cancelPending ? 'CANCEL_PENDING' : 'UPLOADING', expires_at: upload.expires_at }]
        : [];
    return Promise.resolve({ data: pending, error: null }).then(resolve, reject);
  });
  const admin = {
    from: jest.fn((name: string) => { table = name; return query; }),
    rpc: jest.fn(async (name: string) => ({
      data: name === 'reserve_evento_deliverable_upload' ? uploadId : name === 'finalize_evento_deliverable_upload' ? options.emptyFinalization ? [] : [uploadId] : null,
      error: options.rpcErrors?.[name] ?? null,
    })),
  };
  jest.mocked(getSupabaseAdmin).mockImplementation(() => { calls.push('service-role'); return admin as never; });
  jest.mocked(authorizeAction).mockImplementation(async (permission) => {
    calls.push(permission);
    return options.denied?.includes(permission)
      ? { context: null, error: 'Sin permiso.' }
      : { context: { user: { id: options.identity ?? actorId }, profile: { full_name: 'Ana', role_code: 'admin' }, role: 'admin', supabase } as never, error: null };
  });
  return { calls, supabase, admin, query, getUpdatedStatus: () => updatedStatus };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDriveFileRule).mockReturnValue({ mimeType: 'application/pdf', maxBytes: 500_000_000, maxFiles: 20 } as never);
  jest.mocked(createDriveResumableSession).mockResolvedValue(upload.session_uri!);
  jest.mocked(ensurePublicacionDriveFolders).mockResolvedValue({ brief: { id: 'brief-folder', url: null }, deliverables: { id: 'deliverables-folder', url: null } });
  jest.mocked(findDriveUploadedFile).mockResolvedValue({ id: 'drive-file-id', name: 'pieza.pdf', mimeType: 'application/pdf', size: 12, createdTime: '2026-12-03T12:00:00Z', webViewLink: 'https://drive.google.com/file/d/id', thumbnailLink: null });
  jest.mocked(listDriveFolderFiles).mockResolvedValue([]);
  jest.mocked(revokeDriveResumableSession).mockResolvedValue(true);
});

describe('Events Design source', () => {
  it('maps two output formats and keeps Event and Design states distinct', () => {
    const model = mapEventsDesignRequest({ ...eventDetail, sedes: [null, { otro: 'x' }, { sede_id: 's', nombre: ' Norte ' }, 'bad'] });
    expect(model).toMatchObject({
      id: `EVENTS:${eventId}`, source: 'EVENTS', sourceRecordId: eventId, status: 'IN_PROGRESS', sourceStatus: 'EN_DISENO',
      requesterId: actorId, designerId: actorId, priority: null, targetDate: '2026-12-08',
      sourceData: { eventName: 'Feria de primavera', eventStatus: 'EN_PLANIFICACION', formats: ['DIGITAL', 'IMPRESION'], stores: ['Norte'] },
      requestedOutputs: [{ sourceFormatCode: 'DIGITAL', label: 'Digital' }, { sourceFormatCode: 'IMPRESION', label: 'Impresión' }],
    });
    expect(model.sourceData).not.toHaveProperty('topics');
    const unknownFormat = mapEventsDesignRequest({ ...eventDetail, diseno_formatos: ['FORMATO_FUTURO'] });
    expect(unknownFormat.requestedOutputs).toEqual([{ category: 'EVENTS', sourceFormatCode: 'FORMATO_FUTURO', label: 'FORMATO_FUTURO' }]);
  });

  it('uses the queue and applies common and Events-specific filters', async () => {
    const { supabase } = setup();
    const result = await source.list({ statuses: ['IN_PROGRESS'], search: 'centro', designerId: actorId, targetDateFrom: '2026-12-01', targetDateTo: '2026-12-31', sourceSpecific: { formats: ['impresion'], stores: ['TIENDA CENTRO'], eventStatuses: ['en_planificacion'] } }, { id: actorId });
    expect(result.ok && result.value).toHaveLength(1);
    expect(supabase.rpc).toHaveBeenCalledWith('get_design_event_queue');
    expect(await source.list({ sourceSpecific: { formats: ['VIDEO'] } }, { id: actorId })).toMatchObject({ ok: true, value: [] });
  });

  it('maps detail, correction note, date, requester, designer and history', async () => {
    setup();
    const result = await source.getDetail(eventId, { id: actorId });
    expect(result).toMatchObject({ ok: true, value: {
      createdAt: '2026-11-30T10:00:00Z', requesterId: actorId, designer: { id: actorId, name: 'Ana Diseño' },
      usageDate: { label: 'Evento', value: '2026-12-10T10:00:00Z' }, correction: { text: 'Ajustar el título.' },
      history: [{ label: 'EN_DISENO' }, { label: 'EN_CORRECCION', note: 'Ajustar el título.' }], copy: null,
    } });
  });

  it('denies reads and actor mismatch before RPC or Service Role, including admin role', async () => {
    const denied = setup({ denied: ['design.requests.read'] });
    expect(await source.list({}, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(denied.supabase.rpc).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    const mismatch = setup({ identity: '00000000-0000-4000-8000-000000000099' });
    expect(await source.getDetail(eventId, { id: actorId, roleCode: 'admin' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mismatch.supabase.rpc).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('requires read and start grants and validates the live state and lifecycle for start/reopen', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    setup({ denied: ['design.requests.read'] });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    const missingStart = setup({ denied: ['design.requests.start'] });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(missingStart.supabase.rpc).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    const wrongState = setup({ designStatus: 'EN_DISENO' });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(wrongState.supabase.rpc).not.toHaveBeenCalledWith('design_start_event_request', expect.anything());
    const cancelled = setup({ designStatus: 'SOLICITADO', eventStatus: 'CANCELADO' });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(cancelled.supabase.rpc).not.toHaveBeenCalledWith('design_start_event_request', expect.anything());
    setup({ designStatus: 'SOLICITADO', rpcErrors: { design_start_event_request: { code: '08006', message: 'connection failure' } } });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE', sourceCode: '08006' } });
    const start = setup({ designStatus: 'SOLICITADO' });
    expect(await source.start?.(request, { id: actorId })).toEqual({ ok: true, value: undefined });
    expect(start.supabase.rpc).toHaveBeenCalledWith('design_start_event_request', { p_evento_id: eventId });
    const reopen = setup({ designStatus: 'EN_CORRECCION' });
    expect(await source.reopen?.(request, { id: actorId })).toEqual({ ok: true, value: undefined });
    expect(reopen.supabase.rpc).toHaveBeenCalledWith('design_reopen_event_request', { p_evento_id: eventId });
    for (const lifecycle of ['TERMINADO', 'CANCELADO']) {
      const forbiddenLifecycle = setup({ designStatus: 'EN_CORRECCION', eventStatus: lifecycle });
      expect(await source.reopen?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
      expect(forbiddenLifecycle.supabase.rpc).not.toHaveBeenCalledWith('design_reopen_event_request', expect.anything());
    }
    const archived = setup({ designStatus: 'SOLICITADO', archived: '2026-12-01T00:00:00Z' });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(archived.supabase.rpc).not.toHaveBeenCalledWith('design_start_event_request', expect.anything());
  });

  it('requires read and deliver grants, uses completed_at in the current cycle, and accepts the void RPC result', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    setup({ denied: ['design.requests.deliver'] });
    expect(await source.deliver?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    const old = setup({ noDeliverable: true });
    expect(await source.deliver?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(old.supabase.rpc).not.toHaveBeenCalledWith('design_deliver_event_request', expect.anything());
    const delivered = setup({ eventStatus: 'TERMINADO' });
    expect(await source.deliver?.(request, { id: actorId })).toEqual({ ok: true, value: undefined });
    expect(delivered.query.gt).toHaveBeenCalledWith('completed_at', eventDetail.diseno_iniciado_en);
    expect(delivered.supabase.rpc).toHaveBeenCalledWith('design_deliver_event_request', { p_evento_id: eventId });
    setup({ rpcErrors: { design_deliver_event_request: { code: '22023', message: 'No está en diseño.' } } });
    expect(await source.deliver?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', sourceCode: '22023' } });
    const cancelledEvent = setup({ eventStatus: 'CANCELADO' });
    expect(await source.deliver?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(cancelledEvent.supabase.rpc).not.toHaveBeenCalledWith('design_deliver_event_request', expect.anything());
    const archived = setup({ archived: '2026-12-03T00:00:00Z' });
    expect(await source.deliver?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(archived.supabase.rpc).not.toHaveBeenCalledWith('design_deliver_event_request', expect.anything());
  });

  it('derives current-state capabilities and normalized delivery eligibility without admin bypass', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const eligible = setup({ designStatus: 'EN_DISENO' });
    expect(await source.capabilities(request, { id: actorId })).toMatchObject({ ok: true, value: {
      start: false, reopen: false, deliver: true,
      fileAccess: { BRIEF: { readCompletedFiles: true, readPendingUploads: false }, DELIVERABLE: { readCompletedFiles: true, readPendingUploads: true } },
      uploads: { DELIVERABLE: { reserve: true, finalize: true, resumable: true, cancellable: true, maxFiles: 20 } },
    } });
    expect(eligible.calls).toContain('design.requests.deliver');
    setup({ denied: ['design.requests.start', 'design.requests.upload', 'design.requests.deliver'] });
    const deniedCapabilities = await source.capabilities(request, { id: actorId, roleCode: 'admin' });
    expect(deniedCapabilities).toMatchObject({ ok: true, value: { start: false, reopen: false, deliver: false, uploads: { DELIVERABLE: { reserve: false, finalize: false } } } });
    setup({ noDeliverable: true });
    expect(await source.deliverEligibility?.(request, { id: actorId })).toMatchObject({ ok: true, value: { eligible: false, reason: { code: 'INVALID_STATE' } } });
  });

  it('propagates read RPC errors and reports missing details', async () => {
    setup({ rpcErrors: { get_design_event_queue: { code: '08006', message: 'connection failure' } } });
    expect(await source.list({}, { id: actorId })).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE', sourceCode: '08006' } });
    setup({ noDetail: true });
    expect(await source.getDetail(eventId, { id: actorId })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('keeps BRIEF read-only and validates upload permission before admin access', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const denied = setup({ denied: ['design.requests.upload'] });
    expect(await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    setup({ denied: ['design.requests.upload'] });
    expect(await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    setup();
    const brief = await source.uploads?.reserveUpload('BRIEF', request, { id: actorId }, { fileName: 'brief.pdf', size: 12 });
    expect(brief).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    setup({ denied: ['design.requests.read'] });
    expect(await source.uploads?.listPendingUploads?.('BRIEF', request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(denied.calls).toContain('design.requests.upload');
  });

  it('reserves only a valid deliverable and persists a live conditional session before returning it', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const reserved = setup();
    const result = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12, mimeType: 'application/pdf' });
    expect(result).toMatchObject({ ok: true, value: { uploadId, transfer: { url: upload.session_uri, resumable: true } } });
    expect(reserved.admin.rpc).toHaveBeenCalledWith('reserve_evento_deliverable_upload', expect.objectContaining({ p_actor_id: actorId, p_evento_id: eventId, p_mime_type: 'application/pdf' }));
    expect(reserved.query.eq).toHaveBeenCalledWith('id', uploadId);
    expect(reserved.query.eq).toHaveBeenCalledWith('evento_id', eventId);
    expect(reserved.query.eq).toHaveBeenCalledWith('actor_id', actorId);
    expect(reserved.query.eq).toHaveBeenCalledWith('carpeta', 'ENTREGABLES');
    expect(reserved.query.eq).toHaveBeenCalledWith('status', 'RESERVING');
    expect(reserved.query.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(createDriveResumableSession).toHaveBeenCalled();
    const invalid = setup();
    jest.mocked(getDriveFileRule).mockReturnValueOnce(null);
    expect(await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'bad.exe', size: 12 })).toMatchObject({ ok: false, error: { code: 'UPLOAD_REJECTED' } });
    expect(invalid.admin.rpc).not.toHaveBeenCalled();
    const noPersist = setup({ emptyReservation: true });
    expect(await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(revokeDriveResumableSession).toHaveBeenCalledWith(upload.session_uri);
    expect(noPersist.admin.rpc).toHaveBeenCalledWith('reserve_evento_deliverable_upload', expect.anything());
    const expired = setup({ expiredReservation: true });
    expect(await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(revokeDriveResumableSession).toHaveBeenCalledWith(upload.session_uri);
    expect(expired.query.eq).toHaveBeenCalledWith('actor_id', actorId);
  });

  it('finalizes through the atomic RPC only and treats an empty result as conflict', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const finalized = setup();
    const result = await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId });
    expect(result).toMatchObject({ ok: true, value: { id: 'drive-file-id', fileName: 'pieza.pdf' } });
    expect(finalized.admin.rpc).toHaveBeenCalledWith('finalize_evento_deliverable_upload', { p_upload_id: uploadId, p_evento_id: eventId, p_actor_id: actorId, p_drive_file_id: 'drive-file-id' });
    expect(finalized.getUpdatedStatus()).not.toBe('COMPLETE');
    const empty = setup({ emptyFinalization: true });
    expect(await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(empty.getUpdatedStatus()).not.toBe('COMPLETE');
    const moved = setup({ designStatus: 'ENTREGADO' });
    expect(await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(moved.admin.rpc).not.toHaveBeenCalledWith('finalize_evento_deliverable_upload', expect.anything());
  });

  it('restricts resume to owner and live sessions; filters pending metadata without session URIs', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const resumed = setup();
    expect(await source.uploads?.resumeUpload?.('DELIVERABLE', request, { id: actorId }, uploadId)).toMatchObject({ ok: true, value: { transfer: { url: upload.session_uri } } });
    expect(resumed.query.eq).toHaveBeenCalledWith('actor_id', actorId);
    setup({ expiredUpload: true });
    expect(await source.uploads?.resumeUpload?.('DELIVERABLE', request, { id: actorId }, uploadId)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    const pendingContext = setup();
    const pending = await source.uploads?.listPendingUploads?.('DELIVERABLE', request, { id: actorId });
    expect(pending).toMatchObject({ ok: true, value: [{ id: uploadId, status: 'UPLOADING' }] });
    expect(pendingContext.query.eq).toHaveBeenCalledWith('actor_id', actorId);
    expect(pending?.ok && pending.value[0]).not.toHaveProperty('session_uri');
    setup();
    const missingRead = setup({ denied: ['design.requests.read'] });
    expect(await source.uploads?.listPendingUploads?.('DELIVERABLE', request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(missingRead.admin.from).not.toHaveBeenCalled();
  });

  it('conditionally cancels UPLOADING and CANCEL_PENDING and does not overwrite expired/completed reservations', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const cancelled = setup({ cancelPending: true });
    expect(await source.uploads?.cancelUpload?.('DELIVERABLE', request, { id: actorId }, uploadId)).toEqual({ ok: true, value: undefined });
    expect(cancelled.query.in).toHaveBeenCalledWith('status', ['UPLOADING', 'CANCEL_PENDING']);
    jest.mocked(revokeDriveResumableSession).mockResolvedValueOnce(false);
    setup({ cancelPending: true });
    expect(await source.uploads?.cancelUpload?.('DELIVERABLE', request, { id: actorId }, uploadId)).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    setup({ expiredUpload: true });
    expect(await source.uploads?.cancelUpload?.('DELIVERABLE', request, { id: actorId }, uploadId)).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    const empty = setup({ emptyCancel: true });
    expect(await source.uploads?.cancelUpload?.('DELIVERABLE', request, { id: actorId }, uploadId)).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(empty.query.select).toHaveBeenCalledWith('id');
  });

  it('lists completed BRIEF and DELIVERABLE files with read authorization', async () => {
    const request = mapEventsDesignRequest(eventDetail);
    const context = setup();
    jest.mocked(listDriveFolderFiles).mockResolvedValue([{ id: 'file', name: 'brief.pdf', mimeType: 'application/pdf', size: 10, createdTime: '', webViewLink: null, thumbnailLink: null }]);
    expect(await source.uploads?.listFiles?.('BRIEF', request, { id: actorId })).toMatchObject({ ok: true, value: [{ id: 'file', kind: 'BRIEF', createdAt: null }] });
    expect(listDriveFolderFiles).toHaveBeenCalledWith('brief-folder');
    expect(context.calls.filter((permission) => permission === 'design.requests.read').length).toBeGreaterThan(0);
  });
});
