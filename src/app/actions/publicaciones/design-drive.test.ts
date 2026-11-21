jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth/dal', () => ({ authorizeAction: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ getSupabaseAdmin: jest.fn() }));
jest.mock('@/lib/googleDrive', () => ({
  countDriveFolderFiles: jest.fn(),
  createDriveResumableSession: jest.fn(),
  ensurePublicacionDriveFolders: jest.fn(),
  findDriveUploadedFile: jest.fn(),
  listDriveFolderFiles: jest.fn(),
  revokeDriveResumableSession: jest.fn(),
}));
jest.mock('@/lib/driveFileRules', () => ({ getDriveFileRule: jest.fn() }));

import { authorizeAction } from '@/lib/auth/dal';
import { countDriveFolderFiles, createDriveResumableSession, findDriveUploadedFile, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getDriveFileRule } from '@/lib/driveFileRules';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { cancelDeliverableUploadAction, finishDeliverableUploadAction, listDesignPublicationDriveFilesAction, resumeDeliverableUploadAction, startDeliverableUploadAction } from './design-drive';

const publicationId = '00000000-0000-4000-8000-000000000001';
const uploadId = '00000000-0000-4000-8000-000000000002';
const actorId = '00000000-0000-4000-8000-000000000003';
const publication = {
  id: publicationId,
  estatus: 'EN_DISENO',
  drive_folder_id: 'root',
  drive_brief_folder_id: 'brief',
  drive_deliverables_folder_id: 'deliverables',
};
const upload = {
  id: uploadId,
  publicacion_id: publicationId,
  actor_id: actorId,
  carpeta: 'ENTREGABLES',
  status: 'UPLOADING',
  file_size: 120,
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  session_uri: 'https://www.googleapis.com/upload/drive/session',
  file_name: 'file.pdf',
  mime_type: 'application/pdf',
};

function setup(options: { upload?: unknown; completed?: unknown; permission?: boolean; reconcileUploads?: unknown[]; rpcError?: unknown } = {}) {
  const filters: Array<[string, ...unknown[]]> = [];
  const update = jest.fn(() => query);
  const query: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'gt', 'in', 'lte']) {
    query[method] = jest.fn((...args: unknown[]) => {
      filters.push([method, ...args]);
      return query;
    });
  }
  query.update = update;
  query.then = jest.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: options.reconcileUploads ?? [], error: null }).then(resolve, reject));
  query.maybeSingle = jest.fn(async () => update.mock.calls.length
    ? { data: options.completed === undefined ? { id: uploadId } : options.completed, error: null }
    : { data: options.upload === undefined ? upload : options.upload, error: null });
  const rpc = jest.fn(async (name: string) => ({ data: name === 'finalize_publication_deliverable_upload' ? (options.completed === undefined ? [uploadId] : options.completed ? [uploadId] : []) : uploadId, error: options.rpcError ?? null }));
  const admin = { from: jest.fn(() => query), rpc };
  const supabase = { rpc: jest.fn(async () => ({ data: [publication], error: null })) };
  jest.mocked(authorizeAction).mockResolvedValue(options.permission === false
    ? { context: null, error: 'Sin permiso.' } as never
    : { context: { user: { id: actorId }, supabase } as never, error: null });
  jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
  jest.mocked(findDriveUploadedFile).mockResolvedValue({ id: 'drive-file', name: 'file.pdf', size: 120 } as never);
  jest.mocked(countDriveFolderFiles).mockResolvedValue(0);
  jest.mocked(createDriveResumableSession).mockResolvedValue('https://www.googleapis.com/upload/drive/session');
  jest.mocked(getDriveFileRule).mockReturnValue({ mimeType: 'application/pdf', maxBytes: 500_000_000 } as never);
  jest.mocked(revokeDriveResumableSession).mockResolvedValue(true);
  return { admin, supabase, query, filters, update };
}

describe('finishDeliverableUploadAction atomic finalization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires an authenticated upload permission before obtaining the service role client', async () => {
    setup({ permission: false });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(authorizeAction).toHaveBeenCalledWith('design.posts.upload');
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a missing publication before querying uploads or Drive', async () => {
    const { supabase } = setup();
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a missing upload and does not contact Drive', async () => {
    setup({ upload: null });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a different owner and does not contact Drive', async () => {
    setup({ upload: { ...upload, actor_id: '00000000-0000-4000-8000-000000000004' } });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a different category and does not contact Drive', async () => {
    setup({ upload: { ...upload, carpeta: 'BRIEF' } });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it.each(['CANCELLED', 'EXPIRED', 'COMPLETE', 'CANCEL_PENDING'])('rejects state %s before contacting Drive', async (status) => {
    setup({ upload: { ...upload, status } });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a reservation whose expiry time has passed before contacting Drive', async () => {
    setup({ upload: { ...upload, expires_at: new Date(Date.now() - 60_000).toISOString() } });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a mismatched expected publication at the upload lookup', async () => {
    const { query } = setup({ upload: null });

    await finishDeliverableUploadAction('00000000-0000-4000-8000-000000000004', uploadId);

    expect(query.eq).toHaveBeenCalledWith('publicacion_id', '00000000-0000-4000-8000-000000000004');
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects a row whose stored publication association differs from the request', async () => {
    setup({ upload: { ...upload, publicacion_id: '00000000-0000-4000-8000-000000000004' } });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it.each(['cancellation', 'expiration', 'another finalizer'])('treats a concurrent %s transition as a conflict', async () => {
    const { admin: { rpc } } = setup({ completed: null });

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result.success).toBe(false);
    expect(rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', {
      p_upload_id: uploadId,
      p_publication_id: publicationId,
      p_actor_id: actorId,
      p_drive_file_id: 'drive-file',
    });
  });

  it('marks complete only when the conditional update returns the expected row', async () => {
    const { admin: { rpc } } = setup();

    const result = await finishDeliverableUploadAction(publicationId, uploadId);

    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', {
      p_upload_id: uploadId,
      p_publication_id: publicationId,
      p_actor_id: actorId,
      p_drive_file_id: 'drive-file',
    });
  });

  it('preserves the existing resume contract for the authenticated owner', async () => {
    setup();

    const result = await resumeDeliverableUploadAction(uploadId);

    expect(result).toEqual({ success: true, data: { sessionUri: upload.session_uri, name: upload.file_name, mimeType: upload.mime_type, size: upload.file_size } });
  });

  it('preserves cancellation while conditioning its state transition on UPLOADING', async () => {
    const { filters } = setup();

    const result = await cancelDeliverableUploadAction(uploadId);

    expect(result).toEqual({ success: true });
    expect(revokeDriveResumableSession).toHaveBeenCalledWith(upload.session_uri);
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
    expect(filters).toContainEqual(['eq', 'actor_id', actorId]);
  });

  it('preserves reservation and session creation through the existing upload action', async () => {
    const { admin } = setup();

    const result = await startDeliverableUploadAction({ publicationId, name: 'file.pdf', size: 120 });

    expect(result).toEqual({ success: true, data: { uploadId, sessionUri: upload.session_uri, mimeType: 'application/pdf' } });
    expect(admin.rpc).toHaveBeenCalledWith('reserve_publication_deliverable_upload', expect.objectContaining({ p_actor_id: actorId, p_publication_id: publicationId }));
    expect(createDriveResumableSession).toHaveBeenCalledTimes(1);
    expect(countDriveFolderFiles).toHaveBeenCalledWith('deliverables');
  });

  it('expires stale reservations with a conditional state and expiry filter', async () => {
    const staleUpload = { ...upload, expires_at: new Date(Date.now() - 60_000).toISOString() };
    const { filters, update, admin } = setup({ reconcileUploads: [staleUpload] });

    const result = await listDesignPublicationDriveFilesAction(publicationId);

    expect(result.success).toBe(true);
    expect(filters).toContainEqual(['in', 'status', ['RESERVING', 'UPLOADING', 'CANCEL_PENDING']]);
    expect(filters).toContainEqual(['lte', 'expires_at', expect.any(String)]);
    expect(update).toHaveBeenCalledWith({ status: 'EXPIRED', session_uri: null });
    expect(admin.rpc).not.toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.anything());
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('reconciles a valid Drive file through the atomic finalization RPC', async () => {
    const { admin, update } = setup({ reconcileUploads: [upload] });

    const result = await listDesignPublicationDriveFilesAction(publicationId);

    expect(result.success).toBe(true);
    expect(admin.rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', {
      p_upload_id: uploadId,
      p_publication_id: publicationId,
      p_actor_id: actorId,
      p_drive_file_id: 'drive-file',
    });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETE' }));
  });

  it('leaves the upload pending when the reconciliation RPC returns no rows', async () => {
    const { admin, update } = setup({ reconcileUploads: [upload], completed: null });

    const result = await listDesignPublicationDriveFilesAction(publicationId);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pendingUploads).toEqual(expect.arrayContaining([expect.objectContaining({ id: uploadId })]));
    expect(admin.rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.anything());
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETE' }));
  });

  it('returns a controlled error when the reconciliation RPC fails', async () => {
    const { admin, update } = setup({ reconcileUploads: [upload], rpcError: { message: 'database failure' } });

    const result = await listDesignPublicationDriveFilesAction(publicationId);

    expect(result).toEqual({ success: false, error: 'No se pudo confirmar la carga recuperada de Drive.' });
    expect(admin.rpc).toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.anything());
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETE' }));
  });

  it('does not finalize a Drive file whose size does not match the reservation', async () => {
    const { admin } = setup({ reconcileUploads: [upload] });
    jest.mocked(findDriveUploadedFile).mockResolvedValue({ id: 'drive-file', size: 121 } as never);

    await listDesignPublicationDriveFilesAction(publicationId);

    expect(admin.rpc).not.toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.anything());
  });

  it('does not attempt to reconcile a cancelled-pending upload', async () => {
    const pendingCancellation = { ...upload, status: 'CANCEL_PENDING' };
    const { admin } = setup({ reconcileUploads: [pendingCancellation] });

    await listDesignPublicationDriveFilesAction(publicationId);

    expect(findDriveUploadedFile).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalledWith('finalize_publication_deliverable_upload', expect.anything());
  });
});
