jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/dal', () => ({ authorizeAction: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ getSupabaseAdmin: jest.fn() }));
jest.mock('@/lib/driveFileRules', () => ({ DRIVE_FILE_RULES: { ENTREGABLES: { maxFiles: 20, maxBytes: 500_000_000, mimeByExtension: { '.pdf': 'application/pdf' } } }, getDriveFileRule: jest.fn() }));
jest.mock('@/lib/googleDrive', () => ({
  countDriveFolderFiles: jest.fn(), createDriveResumableSession: jest.fn(), ensurePublicacionDriveFolders: jest.fn(),
  findDriveUploadedFile: jest.fn(), listDriveFolderFiles: jest.fn(), revokeDriveResumableSession: jest.fn(),
}));

import { authorizeAction } from '@/lib/auth/dal';
import { countDriveFolderFiles, createDriveResumableSession, findDriveUploadedFile, listDriveFolderFiles, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getDriveFileRule } from '@/lib/driveFileRules';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import type { Database } from '@/types/database.types';
import source, { mapSocialMediaPublication } from './design-source';

const actorId = '00000000-0000-4000-8000-000000000001';
const publicationId = '00000000-0000-4000-8000-000000000002';

const publication: Database['public']['Functions']['get_design_publication_queue']['Returns'][number] = {
  body_texto: 'Body', campana_id: '00000000-0000-4000-8000-000000000004', creador_id: actorId, created_at: '2026-01-01T00:00:00Z', cta_texto: 'CTA',
  deleted_at: null, disenador_id: actorId, drive_brief_checked_at: null, drive_brief_file_count: 1, drive_brief_folder_id: 'brief', drive_cleanup_attempted_at: null,
  drive_cleanup_error: null, drive_cleanup_status: 'NONE', drive_deleted_at: null, drive_deliverables_folder_id: 'deliverables', drive_folder_id: 'root', drive_folder_url: null,
  drive_preserved_at: null, estatus: 'EN_DISENO', fecha_aprobacion_gerencia: null, fecha_entrega_diseno_estimada: '2026-01-05', fecha_entrega_diseno_real: null,
  fecha_limite_brief: null, fecha_publicacion: '2026-01-10', fecha_rodaje: null, fecha_solicitud_diseno: '2026-01-01T00:00:00Z', formato: 'POST', hashtags: ['#uno'],
  hook_texto: 'Hook', hora_publicacion: null, id: publicationId, instrucciones_diseno: 'Instructions', linea_contenido: null, prioridad: 1, requiere_diseno: true,
  requiere_rodaje: false, sedes: [], titulo: 'Lanzamiento', updated_at: '2026-01-02T00:00:00Z', version_copy: 1,
};

function setup(options: {
  permission?: boolean;
  deniedPermissions?: readonly string[];
  roleCode?: string;
  identity?: string;
  rows?: typeof publication[];
  currentStatus?: typeof publication.estatus;
  noDetail?: boolean;
  noCycle?: boolean;
  expiredUpload?: boolean;
  expiredReservation?: boolean;
  emptyReservationUpdate?: boolean;
  emptyFinalization?: boolean;
  emptyTransition?: boolean;
  mismatchedTransition?: boolean;
  reservationError?: { code: string; message: string };
  rpcErrors?: Record<string, { code: string; message: string }>;
} = {}) {
  const calls: string[] = [];
  const supabase = {
    rpc: jest.fn(async (name: string, args?: { p_estatus_nuevo?: typeof publication.estatus }) => {
      calls.push(name);
      if (options.rpcErrors?.[name]) return { data: null, error: options.rpcErrors[name] };
      if (name === 'get_design_publication_queue') return { data: options.rows ?? [publication], error: null };
      if (name === 'get_design_publication_request') return { data: options.noDetail ? [] : [{ ...publication, estatus: options.currentStatus ?? publication.estatus }], error: null };
      if (name === 'get_design_publication_channels') return { data: [{ publicacion_id: publicationId, canal: 'Instagram' }], error: null };
      if (name === 'get_publication_designer_names') return { data: [{ publicacion_id: publicationId, disenador_id: actorId, full_name: 'Ana' }], error: null };
      if (name === 'get_design_publication_comments') return { data: [{ id: 'comment', publicacion_id: publicationId, texto: 'Cambiar color', tipo: 'CORRECCION', creado_en: '2026-01-03T00:00:00Z' }], error: null };
      if (name === 'get_design_publication_timeline') return { data: [{ at: '2026-01-02T00:00:00Z', label: 'EN_DISENO', note: null }], error: null };
      if (name === 'transition_publicacion_status') return { data: options.emptyTransition ? null : { ...publication, id: options.mismatchedTransition ? '00000000-0000-4000-8000-000000000099' : publicationId, estatus: args?.p_estatus_nuevo ?? publication.estatus }, error: null };
      return { data: publication, error: null };
    }),
    from: jest.fn(() => ({ select: jest.fn(() => ({ in: jest.fn(async () => ({ data: [{ id: publication.campana_id!, nombre: 'Campaña' }], error: null })) })) })),
  };
  const query: Record<string, jest.Mock> = {};
  let selected = '';
  for (const method of ['update', 'eq', 'in', 'gt', 'order', 'limit']) query[method] = jest.fn(() => query);
  query.select = jest.fn((columns: string) => { selected = columns; return query; });
  query.maybeSingle = jest.fn(async () => ({ data: selected === '*' ? { ...uploadFixture, expires_at: options.expiredUpload ? '2020-01-01T00:00:00Z' : uploadFixture.expires_at } : selected === 'id,expires_at' ? options.emptyReservationUpdate ? null : { id: uploadFixture.id, expires_at: options.expiredReservation ? '2020-01-01T00:00:00Z' : uploadFixture.expires_at } : options.noCycle ? null : { id: uploadFixture.id, expires_at: uploadFixture.expires_at, cambiado_en: '2026-01-02T00:00:00Z' }, error: null }));
  query.then = jest.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: [{ id: uploadFixture.id, file_name: uploadFixture.file_name, mime_type: uploadFixture.mime_type, file_size: uploadFixture.file_size, status: uploadFixture.status, expires_at: uploadFixture.expires_at }], error: null }).then(resolve, reject));
  const admin = { from: jest.fn(() => query), rpc: jest.fn(async (name: string) => ({ data: options.reservationError && name === 'reserve_publication_deliverable_upload' ? null : name === 'finalize_publication_deliverable_upload' ? options.emptyFinalization ? [] : [uploadFixture.id] : uploadFixture.id, error: name === 'reserve_publication_deliverable_upload' ? options.reservationError ?? null : null })) };
  jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
  jest.mocked(authorizeAction).mockImplementation(async (permission) => {
    calls.push(permission);
    return options.permission === false || options.deniedPermissions?.includes(permission)
      ? { context: null, error: 'Sin permiso.' }
      : { context: { user: { id: options.identity ?? actorId }, profile: { full_name: 'Ana', role_code: options.roleCode ?? 'design' }, role: options.roleCode ?? 'design', supabase } as never, error: null };
  });
  return { calls, supabase, admin, query };
}

const uploadFixture = {
  id: '00000000-0000-4000-8000-000000000003', publicacion_id: publicationId, actor_id: actorId, carpeta: 'ENTREGABLES',
  status: 'UPLOADING', file_size: 12, expires_at: '2027-01-01T00:00:00Z', session_uri: 'https://www.googleapis.com/upload/drive/session',
  file_name: 'pieza.pdf', mime_type: 'application/pdf',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDriveFileRule).mockReturnValue({ mimeType: 'application/pdf', maxBytes: 500_000_000, maxFiles: 20 } as never);
  jest.mocked(countDriveFolderFiles).mockResolvedValue(0);
  jest.mocked(createDriveResumableSession).mockResolvedValue('https://www.googleapis.com/upload/drive/session');
  jest.mocked(findDriveUploadedFile).mockResolvedValue({ id: 'drive-file', name: 'pieza.pdf', mimeType: 'application/pdf', size: 12, createdTime: '2026-01-03T00:00:00Z', webViewLink: 'https://drive.google.com/file/d/id', thumbnailLink: null });
  jest.mocked(listDriveFolderFiles).mockResolvedValue([]);
  jest.mocked(revokeDriveResumableSession).mockResolvedValue(true);
});

describe('Social Media Design source', () => {
  it('maps normalized state, priority, channels, campaign and source fields', () => {
    const model = mapSocialMediaPublication(publication, ['Instagram'], 'Campaña');
    expect(model).toMatchObject({ source: 'SOCIAL_MEDIA', sourceRecordId: publicationId, status: 'IN_PROGRESS', sourceStatus: 'EN_DISENO', priority: 'HIGH', targetDate: '2026-01-05' });
    expect(model.sourceData).toEqual({ format: 'POST', channels: ['Instagram'], publicationDate: '2026-01-10', campaignName: 'Campaña' });
  });

  it('leaves unavailable campaign and topic fields absent', () => {
    const model = mapSocialMediaPublication({ ...publication, campana_id: null, disenador_id: null, prioridad: 0 });
    expect(model).toMatchObject({ designerId: null, priority: null, sourceData: { channels: [], publicationDate: '2026-01-10' } });
    expect(model.sourceData).not.toHaveProperty('campaignName');
    expect(model.sourceData).not.toHaveProperty('topics');
  });

  it('requires read permission and rejects a mismatched actor before querying', async () => {
    const denied = setup({ permission: false });
    const result = await source.list({}, { id: actorId });
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(denied.supabase.rpc).not.toHaveBeenCalled();

    const mismatch = setup({ identity: '00000000-0000-4000-8000-000000000099' });
    const mismatched = await source.list({}, { id: actorId });
    expect(mismatched).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mismatch.supabase.rpc).not.toHaveBeenCalled();

    const missingPublicationRead = setup({ deniedPermissions: ['design.posts.read'] });
    expect(await source.list({}, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(missingPublicationRead.supabase.rpc).not.toHaveBeenCalled();
  });

  it('uses the queue and applies common and source-specific filters', async () => {
    const { calls } = setup();
    const result = await source.list({ statuses: ['IN_PROGRESS'], search: 'lanzamiento', designerId: actorId, targetDateFrom: '2026-01-01', targetDateTo: '2026-01-31', sourceSpecific: { channels: ['instagram'], formats: ['post'] } }, { id: actorId });
    expect(result.ok && result.value).toHaveLength(1);
    expect(calls).toContain('get_design_publication_queue');
    expect(calls).toContain('get_design_publication_channels');
    expect(calls).toContain('get_publication_designer_names');
  });

  it('maps detail copy, designer, correction and history', async () => {
    setup();
    const result = await source.getDetail(publicationId, { id: actorId });
    expect(result).toMatchObject({ ok: true, value: { copy: { hook: 'Hook', body: 'Body', cta: 'CTA', hashtags: ['#uno'] }, designer: { id: actorId, name: 'Ana' }, correction: { text: 'Cambiar color' }, history: [{ label: 'EN_DISENO' }] } });
  });

  it('returns NOT_FOUND and source errors through Result for detail reads', async () => {
    setup({ noDetail: true });
    expect(await source.getDetail(publicationId, { id: actorId })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    setup({ rpcErrors: { get_design_publication_request: { code: '08006', message: 'connection failure' } } });
    expect(await source.getDetail(publicationId, { id: actorId })).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE', sourceCode: '08006' } });
  });

  it('rejects an invalid start state after server authorization', async () => {
    const { supabase } = setup();
    const request = mapSocialMediaPublication({ ...publication, estatus: 'PUBLICADO' });
    const result = await source.start?.(request, { id: actorId });
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(supabase.rpc).not.toHaveBeenCalledWith('transition_publicacion_status', expect.anything());
  });

  it('denies start and delivery without their respective grants or matching actor identity', async () => {
    const request = mapSocialMediaPublication(publication);
    const startDenied = setup({ deniedPermissions: ['design.posts.start'] });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(startDenied.supabase.rpc).not.toHaveBeenCalled();

    const deliverDenied = setup({ deniedPermissions: ['design.posts.deliver'] });
    expect(await source.deliver?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(deliverDenied.supabase.rpc).not.toHaveBeenCalled();

    const mismatch = setup({ identity: '00000000-0000-4000-8000-000000000099' });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mismatch.supabase.rpc).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();

    const missingPublicationRead = setup({ deniedPermissions: ['design.posts.read'] });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(missingPublicationRead.supabase.rpc).not.toHaveBeenCalled();
  });

  it('starts and reopens only the live eligible source states, and normalizes transition failures', async () => {
    const request = mapSocialMediaPublication(publication);
    const startContext = setup({ currentStatus: 'SOLICITADO' });
    expect(await source.start?.(request, { id: actorId })).toEqual({ ok: true, value: undefined });
    expect(startContext.supabase.rpc).toHaveBeenCalledWith('transition_publicacion_status', expect.objectContaining({ p_estatus_nuevo: 'EN_DISENO' }));

    const reopenContext = setup({ currentStatus: 'EN_CORRECCION' });
    expect(await source.reopen?.(request, { id: actorId })).toEqual({ ok: true, value: undefined });
    expect(reopenContext.supabase.rpc).toHaveBeenCalledWith('transition_publicacion_status', expect.objectContaining({ p_estatus_nuevo: 'EN_DISENO' }));

    setup({ currentStatus: 'PUBLICADO' });
    expect(await source.reopen?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    setup({ currentStatus: 'SOLICITADO', rpcErrors: { transition_publicacion_status: { code: '42501', message: 'permission denied' } } });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN', sourceCode: '42501' } });
    setup({ currentStatus: 'SOLICITADO', rpcErrors: { transition_publicacion_status: { code: 'P0001', message: 'La transición de estado no está permitida.' } } });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'CONFLICT', sourceCode: 'P0001' } });
    setup({ currentStatus: 'SOLICITADO', emptyTransition: true });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    setup({ currentStatus: 'SOLICITADO', mismatchedTransition: true });
    expect(await source.start?.(request, { id: actorId })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('delivers only when Drive metadata is newer than the latest Design cycle', async () => {
    const { supabase } = setup();
    jest.mocked(listDriveFolderFiles).mockResolvedValue([{ id: 'file', name: 'pieza.pdf', mimeType: 'application/pdf', size: 12, createdTime: '2026-01-03T00:00:00Z', webViewLink: null, thumbnailLink: null }]);
    const request = mapSocialMediaPublication(publication);
    const result = await source.deliver?.(request, { id: actorId });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(supabase.rpc).toHaveBeenCalledWith('transition_publicacion_status', expect.objectContaining({ p_estatus_nuevo: 'EN_REVISION_CM' }));

    jest.clearAllMocks();
    setup();
    jest.mocked(listDriveFolderFiles).mockResolvedValue([{ id: 'old', name: 'pieza-vieja.pdf', mimeType: 'application/pdf', size: 12, createdTime: '2026-01-01T00:00:00Z', webViewLink: null, thumbnailLink: null }]);
    const rejected = await source.deliver?.(request, { id: actorId });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });

    jest.clearAllMocks();
    setup({ currentStatus: 'SOLICITADO' });
    const wrongCurrentState = await source.deliver?.(request, { id: actorId });
    expect(wrongCurrentState).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(listDriveFolderFiles).not.toHaveBeenCalled();

    const fallback = setup({ noCycle: true });
    jest.mocked(listDriveFolderFiles).mockResolvedValue([{ id: 'legacy-file', name: 'pieza-antigua.pdf', mimeType: 'application/pdf', size: 12, createdTime: '', webViewLink: null, thumbnailLink: null }]);
    expect(await source.deliver?.(request, { id: actorId })).toEqual({ ok: true, value: undefined });
    expect(fallback.admin.from).toHaveBeenCalledWith('publicacion_estatus_historial');
  });

  it('reserves a validated deliverable through the typed RPC', async () => {
    const { admin } = setup();
    const request = mapSocialMediaPublication(publication);
    const result = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', mimeType: 'application/pdf', size: 12 });
    expect(result).toMatchObject({ ok: true, value: { uploadId: uploadFixture.id, transfer: { resumable: true, url: 'https://www.googleapis.com/upload/drive/session' } } });
    expect(admin.rpc).toHaveBeenCalledWith('reserve_publication_deliverable_upload', expect.objectContaining({ p_actor_id: actorId, p_publication_id: publicationId, p_mime_type: 'application/pdf' }));
    expect(createDriveResumableSession).toHaveBeenCalledTimes(1);

    setup({ reservationError: { code: 'P0001', message: 'Entregables ya tiene 20 archivos o cargas reservadas.' } });
    const full = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 });
    expect(full).toMatchObject({ ok: false, error: { code: 'CONFLICT', sourceCode: 'P0001' } });
    expect(createDriveResumableSession).toHaveBeenCalledTimes(1);

    setup({ reservationError: { code: 'P0001', message: 'Solo Diseño puede subir entregables.' } });
    const forbidden = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 });
    expect(forbidden).toMatchObject({ ok: false, error: { code: 'FORBIDDEN', sourceCode: 'P0001' } });
  });

  it('does not return a resumable session when its reservation is empty or expired', async () => {
    const request = mapSocialMediaPublication(publication);
    const empty = setup({ emptyReservationUpdate: true });
    const emptyResult = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 });
    expect(emptyResult).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(revokeDriveResumableSession).toHaveBeenCalledWith('https://www.googleapis.com/upload/drive/session');
    expect(empty.query.update).toHaveBeenCalledWith({ status: 'CANCELLED', session_uri: null });

    jest.clearAllMocks();
    const expired = setup({ expiredReservation: true });
    const expiredResult = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 });
    expect(expiredResult).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(expired.admin.rpc).toHaveBeenCalledWith('reserve_publication_deliverable_upload', expect.anything());
  });

  it('rejects unsupported file rules before Service Role access', async () => {
    const { admin } = setup();
    jest.mocked(getDriveFileRule).mockReturnValue(null);
    const request = mapSocialMediaPublication(publication);
    const result = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.exe', size: 12 });
    expect(result).toMatchObject({ ok: false, error: { code: 'UPLOAD_REJECTED' } });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(createDriveResumableSession).not.toHaveBeenCalled();
  });

  it('finalizes only through the atomic RPC and converts an empty response to conflict', async () => {
    const request = mapSocialMediaPublication(publication);
    const { admin, query } = setup();
    const completed = await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId: uploadFixture.id });
    expect(completed).toMatchObject({ ok: true, value: { id: 'drive-file', fileName: 'pieza.pdf' } });
    expect(admin.rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.objectContaining({ p_upload_id: uploadFixture.id, p_publication_id: publicationId, p_actor_id: actorId, p_drive_file_id: 'drive-file' }));
    expect(query.update).not.toHaveBeenCalled();

    const empty = setup({ emptyFinalization: true });
    const conflict = await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId: uploadFixture.id });
    expect(conflict).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(empty.admin.rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.anything());
  });

  it('keeps BRIEF read-only and lists completed Drive files', async () => {
    setup();
    jest.mocked(listDriveFolderFiles).mockResolvedValue([{ id: 'brief-file', name: 'brief.pdf', mimeType: 'application/pdf', size: 10, createdTime: '2026-01-01T00:00:00Z', webViewLink: null, thumbnailLink: null }]);
    const request = mapSocialMediaPublication(publication);
    const files = await source.uploads?.listFiles?.('BRIEF', request, { id: actorId });
    expect(files).toEqual({ ok: true, value: [{ id: 'brief-file', kind: 'BRIEF', fileName: 'brief.pdf', mimeType: 'application/pdf', size: 10, url: null, createdAt: '2026-01-01T00:00:00Z' }] });
    expect(source.uploads?.supportedKinds).toEqual(['DELIVERABLE']);
    const briefReserve = await source.uploads?.reserveUpload('BRIEF', request, { id: actorId }, { fileName: 'brief.pdf', size: 10 });
    expect(briefReserve).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('resumes and conditionally cancels only the authenticated actor upload', async () => {
    const { admin, query } = setup();
    const request = mapSocialMediaPublication(publication);
    const resumed = await source.uploads?.resumeUpload?.('DELIVERABLE', request, { id: actorId }, uploadFixture.id);
    expect(resumed).toMatchObject({ ok: true, value: { transfer: { url: uploadFixture.session_uri } } });
    const cancelled = await source.uploads?.cancelUpload?.('DELIVERABLE', request, { id: actorId }, uploadFixture.id);
    expect(cancelled).toEqual({ ok: true, value: undefined });
    expect(query.update).toHaveBeenCalledWith({ status: 'CANCELLED', session_uri: null });
    expect(admin.from).toHaveBeenCalledWith('publicacion_drive_uploads');
  });

  it('lists pending upload metadata without exposing the transfer URI', async () => {
    const { query } = setup();
    const request = mapSocialMediaPublication(publication);
    const pending = await source.uploads?.listPendingUploads?.('DELIVERABLE', request, { id: actorId });
    expect(pending).toMatchObject({ ok: true, value: [{ id: uploadFixture.id, kind: 'DELIVERABLE', fileName: 'pieza.pdf', status: 'UPLOADING' }] });
    expect(JSON.stringify(pending)).not.toContain('session_uri');
    expect(JSON.stringify(pending)).not.toContain(uploadFixture.session_uri);
    expect(query.eq).toHaveBeenCalledWith('actor_id', actorId);
  });

  it('rejects expired resumptions and finalizations and invalid reservation states', async () => {
    const request = mapSocialMediaPublication(publication);
    setup({ expiredUpload: true });
    expect(await source.uploads?.resumeUpload?.('DELIVERABLE', request, { id: actorId }, uploadFixture.id)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });

    setup({ expiredUpload: true });
    expect(await source.uploads?.finalizeUpload('DELIVERABLE', request, { id: actorId }, { uploadId: uploadFixture.id })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(findDriveUploadedFile).not.toHaveBeenCalled();

    const { admin } = setup({ currentStatus: 'SOLICITADO' });
    expect(await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('derives capabilities from current permissions and state without an admin role bypass', async () => {
    const { supabase } = setup({ roleCode: 'admin', deniedPermissions: ['design.posts.start', 'design.posts.upload', 'design.posts.deliver'] });
    const capabilities = await source.capabilities(mapSocialMediaPublication(publication), { id: actorId, roleCode: 'admin' });
    expect(capabilities).toMatchObject({ ok: true, value: { start: false, deliver: false, reopen: false, uploads: { DELIVERABLE: { reserve: false, finalize: false } } } });
    expect(supabase.rpc).toHaveBeenCalledWith('get_design_publication_request', { p_id: publicationId });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('enables start and reopen only for their current eligible states', async () => {
    setup({ currentStatus: 'SOLICITADO' });
    const requested = await source.capabilities(mapSocialMediaPublication(publication), { id: actorId });
    expect(requested).toMatchObject({ ok: true, value: { start: true, reopen: false, deliver: false } });

    setup({ currentStatus: 'EN_CORRECCION' });
    const correction = await source.capabilities(mapSocialMediaPublication(publication), { id: actorId });
    expect(correction).toMatchObject({ ok: true, value: { start: false, reopen: true, deliver: false } });

    setup({ currentStatus: 'EN_DISENO' });
    jest.mocked(listDriveFolderFiles).mockResolvedValue([{ id: 'new', name: 'pieza.pdf', mimeType: 'application/pdf', size: 10, createdTime: '2026-01-03T00:00:00Z', webViewLink: null, thumbnailLink: null }]);
    const inProgress = await source.capabilities(mapSocialMediaPublication(publication), { id: actorId });
    expect(inProgress).toMatchObject({ ok: true, value: { start: false, reopen: false, deliver: true, fileAccess: { BRIEF: { readCompletedFiles: true, readPendingUploads: false }, DELIVERABLE: { readCompletedFiles: true, readPendingUploads: true } }, uploads: { DELIVERABLE: { reserve: true, finalize: true } } } });
  });

  it('does not access Service Role when upload authorization is denied', async () => {
    const { supabase } = setup({ permission: false });
    const request = mapSocialMediaPublication(publication);
    const result = await source.uploads?.reserveUpload('DELIVERABLE', request, { id: actorId }, { fileName: 'pieza.pdf', size: 12 });
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
