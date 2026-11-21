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

import { authorizeAction } from '@/lib/auth/dal';
import { countDriveFolderFiles, findDriveUploadedFile, revokeDriveResumableSession } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { cancelPublicacionBriefUploadAction, finishPublicacionBriefUploadAction, listPublicacionBriefFilesAction } from './drive';

const publicationId = '00000000-0000-4000-8000-000000000001';
const uploadId = '00000000-0000-4000-8000-000000000002';
const actorId = '00000000-0000-4000-8000-000000000003';
const file = { id: 'drive-file', size: 120, mimeType: 'application/pdf' };
const publication = {
  id: publicationId,
  drive_folder_id: 'root',
  drive_folder_url: 'https://drive.google.com/drive/folders/root',
  drive_brief_folder_id: 'brief',
  drive_deliverables_folder_id: 'deliverables',
  drive_brief_file_count: 0,
  drive_brief_checked_at: null,
  instrucciones_diseno: null,
  requiere_diseno: false,
  estatus: 'PENDIENTE_BRIEF',
  deleted_at: null,
};
const upload = {
  id: uploadId,
  publicacion_id: publicationId,
  actor_id: actorId,
  carpeta: 'BRIEF',
  file_size: 120,
  mime_type: 'application/pdf',
  file_name: 'brief.pdf',
  status: 'UPLOADING',
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  session_uri: 'https://www.googleapis.com/upload/drive/session',
};

function setup(options: {
  upload?: unknown;
  uploads?: unknown[];
  updated?: unknown;
  completedFile?: unknown;
  file?: unknown;
} = {}) {
  const filters: Array<[string, ...unknown[]]> = [];
  const updatePayloads: unknown[] = [];
  const queries: Array<Record<string, jest.Mock>> = [];
  const adminQuery = () => {
    let isUpdate = false;
    const query: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'in', 'lte', 'gt']) {
      query[method] = jest.fn((...args: unknown[]) => {
        filters.push([method, ...args]);
        return query;
      });
    }
    query.update = jest.fn((payload: unknown) => {
      isUpdate = true;
      updatePayloads.push(payload);
      return query;
    });
    query.maybeSingle = jest.fn(async () => ({
      data: isUpdate ? (options.updated === undefined ? { id: uploadId } : options.updated) : (options.upload === undefined ? upload : options.upload),
      error: null,
    }));
    query.then = jest.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: options.uploads ?? [], error: null }).then(resolve, reject));
    queries.push(query);
    return query;
  };
  const admin = {
    from: jest.fn(() => adminQuery()),
    rpc: jest.fn(async () => ({ data: null, error: null })),
  };
  const userQuery: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq']) userQuery[method] = jest.fn(() => userQuery);
  userQuery.maybeSingle = jest.fn(async () => ({ data: publication, error: null }));
  const supabase = {
    rpc: jest.fn(async (name: string) => ({ data: name === 'user_has_all_publication_accounts' ? true : null, error: null })),
    from: jest.fn(() => userQuery),
  };
  jest.mocked(authorizeAction).mockResolvedValue({ context: { user: { id: actorId }, supabase } as never, error: null });
  jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
  jest.mocked(findDriveUploadedFile).mockResolvedValue((options.file === undefined ? file : options.file) as never);
  jest.mocked(countDriveFolderFiles).mockResolvedValue(1);
  jest.mocked(revokeDriveResumableSession).mockResolvedValue(true);
  return { admin, filters, updatePayloads, queries };
}

describe('publication BRIEF upload isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an ENTREGABLES row from the BRIEF finish action', async () => {
    setup({ upload: { ...upload, carpeta: 'ENTREGABLES' } });

    const result = await finishPublicacionBriefUploadAction(uploadId);

    expect(result.success).toBe(false);
    expect(getSupabaseAdmin().from).toHaveBeenCalled();
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('rejects an ENTREGABLES row from the BRIEF cancel action', async () => {
    setup({ upload: { ...upload, carpeta: 'ENTREGABLES' } });

    const result = await cancelPublicacionBriefUploadAction(uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
    expect(revokeDriveResumableSession).not.toHaveBeenCalled();
  });

  it('finishes only a valid BRIEF upload with the full conditional key', async () => {
    const { admin, filters, updatePayloads } = setup();

    const result = await finishPublicacionBriefUploadAction(uploadId);

    expect(result.success).toBe(true);
    expect(admin.from).toHaveBeenCalledWith('publicacion_drive_uploads');
    expect(filters).toContainEqual(['eq', 'carpeta', 'BRIEF']);
    expect(filters).toContainEqual(['eq', 'publicacion_id', publicationId]);
    expect(filters).toContainEqual(['eq', 'actor_id', actorId]);
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
    expect(updatePayloads).toContainEqual(expect.objectContaining({ status: 'COMPLETE', drive_file_id: file.id }));
    expect(admin.rpc).toHaveBeenCalledWith('sync_publication_drive_brief', expect.objectContaining({ p_publication_id: publicationId }));
  });

  it('does not report finish success when its conditional update affects no row', async () => {
    setup({ updated: null });

    const result = await finishPublicacionBriefUploadAction(uploadId);

    expect(result).toEqual({ success: false, error: 'La carga cambió de estado y no se pudo confirmar.' });
  });

  it.each(['COMPLETE', 'CANCELLED', 'EXPIRED'])('does not cancel a terminal %s upload', async (status) => {
    setup({ upload: { ...upload, status } });

    const result = await cancelPublicacionBriefUploadAction(uploadId);

    expect(result.success).toBe(false);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
    expect(revokeDriveResumableSession).not.toHaveBeenCalled();
  });

  it('conditions cancellation on the loaded active status and ownership fields', async () => {
    const { filters, updatePayloads } = setup();
    jest.mocked(findDriveUploadedFile).mockResolvedValue(null);

    const result = await cancelPublicacionBriefUploadAction(uploadId);

    expect(result).toEqual({ success: true });
    expect(revokeDriveResumableSession).toHaveBeenCalledWith(upload.session_uri);
    expect(filters).toContainEqual(['eq', 'publicacion_id', publicationId]);
    expect(filters).toContainEqual(['eq', 'actor_id', actorId]);
    expect(filters).toContainEqual(['eq', 'carpeta', 'BRIEF']);
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
    expect(updatePayloads).toContainEqual(expect.objectContaining({ status: 'CANCELLED' }));
  });

  it('reports a cancellation conflict if another transition wins', async () => {
    const { updatePayloads } = setup({ updated: null });
    jest.mocked(findDriveUploadedFile).mockResolvedValue(null);

    const result = await cancelPublicacionBriefUploadAction(uploadId);

    expect(result).toEqual({ success: false, error: 'La carga cambió de estado y no se pudo cancelar.' });
    expect(updatePayloads).toContainEqual(expect.objectContaining({ status: 'CANCELLED' }));
  });

  it('preserves cancellation recovery when the BRIEF file already reached Drive', async () => {
    const { admin, filters } = setup();
    jest.mocked(findDriveUploadedFile).mockResolvedValue(file as never);

    const result = await cancelPublicacionBriefUploadAction(uploadId);

    expect(result).toEqual({ success: true, completed: true });
    expect(admin.rpc).toHaveBeenCalledWith('sync_publication_drive_brief', expect.objectContaining({ p_publication_id: publicationId }));
    expect(revokeDriveResumableSession).not.toHaveBeenCalled();
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
  });

  it('reconciles a valid BRIEF file through conditional owner and state filters', async () => {
    const { admin, filters, updatePayloads } = setup({ uploads: [upload] });

    const result = await listPublicacionBriefFilesAction(publicationId);

    expect(result.success).toBe(true);
    expect(admin.from).toHaveBeenCalledWith('publicacion_drive_uploads');
    expect(filters).toContainEqual(['eq', 'publicacion_id', publicationId]);
    expect(filters).toContainEqual(['eq', 'carpeta', 'BRIEF']);
    expect(filters).toContainEqual(['eq', 'actor_id', actorId]);
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
    expect(updatePayloads).toContainEqual(expect.objectContaining({ status: 'COMPLETE', drive_file_id: file.id }));
    expect(admin.rpc).toHaveBeenCalledWith('sync_publication_drive_brief', expect.objectContaining({ p_publication_id: publicationId }));
  });

  it('ignores an ENTREGABLES row returned to BRIEF reconciliation', async () => {
    setup({ uploads: [{ ...upload, carpeta: 'ENTREGABLES' }] });

    await listPublicacionBriefFilesAction(publicationId);

    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('does not overwrite a concurrent terminal transition during reconciliation', async () => {
    const { filters, updatePayloads } = setup({ uploads: [upload], updated: null });

    const result = await listPublicacionBriefFilesAction(publicationId);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pendingUploads).toEqual(expect.arrayContaining([expect.objectContaining({ id: uploadId })]));
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
    expect(updatePayloads).toContainEqual(expect.objectContaining({ status: 'COMPLETE' }));
  });

  it('keeps expiration conditional and does not query Drive for expired uploads', async () => {
    const expired = { ...upload, expires_at: new Date(Date.now() - 60_000).toISOString() };
    const { filters, updatePayloads } = setup({ uploads: [expired] });

    const result = await listPublicacionBriefFilesAction(publicationId);

    expect(result.success).toBe(true);
    expect(filters).toContainEqual(['eq', 'status', 'UPLOADING']);
    expect(filters).toContainEqual(['lte', 'expires_at', expect.any(String)]);
    expect(updatePayloads).toContainEqual({ status: 'EXPIRED', session_uri: null });
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });
});
