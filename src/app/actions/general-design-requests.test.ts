jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth/dal', () => ({ authorizeAction: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ getSupabaseAdmin: jest.fn() }));
jest.mock('@/lib/googleDrive', () => ({ ensureDriveChildFolder: jest.fn(), findDriveUploadedFile: jest.fn() }));
jest.mock('@/lib/driveFileRules', () => ({ getDriveFileRule: jest.fn() }));
jest.mock('@/lib/designSla', () => ({ getCaracasToday: jest.fn() }));
jest.mock('@/lib/sedes', () => ({ listSedesActivas: jest.fn() }));

import { authorizeAction } from '@/lib/auth/dal';
import { ensureDriveChildFolder, findDriveUploadedFile } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import {
  cancelGeneralDesignDeliverableUploadAction,
  cancelGeneralRequestReferenceUploadAction,
  createGeneralDesignRequestAction,
  deliverGeneralDesignRequestAction,
  expireGeneralRequestUploadAction,
  finishGeneralDesignDeliverableUploadAction,
  finishGeneralRequestReferenceUploadAction,
  listGeneralRequestPendingUploadsAction,
  requestGeneralCancellationAction,
  resolveGeneralCancellationAction,
  resumeGeneralRequestUploadAction,
  setGeneralDesignPriorityAction,
  startGeneralDesignDeliverableUploadAction,
  startGeneralDesignWorkAction,
  startGeneralRequestReferenceUploadAction,
} from './general-design-requests';

const id = '00000000-0000-4000-8000-000000000001';
const uploadId = '00000000-0000-4000-8000-000000000002';

function makeQuery(result: { data: unknown; error?: unknown }) {
  const query: Record<string, jest.Mock> & { then?: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown> } = {};
  for (const method of ['select', 'eq', 'in', 'gt', 'update', 'insert']) query[method] = jest.fn(() => query);
  query.maybeSingle = jest.fn(async () => result);
  query.single = jest.fn(async () => result);
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function allowPermission(permission: string) {
  jest.mocked(authorizeAction).mockImplementation(async (requested) =>
    requested === permission
      ? { context: { user: { id }, supabase: { from: jest.fn() } } as never, error: null }
      : denied,
  );
}
const denied = { context: null, error: 'No tienes permiso para realizar esta acción.' };

describe('GENERAL design-specific authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authorizeAction).mockImplementation(async (permission) =>
      permission === 'design.requests.read'
        ? { context: { user: { id } } as never, error: null }
        : denied,
    );
  });

  it.each([
    ['create request', 'requests.general.create', () => createGeneralDesignRequestAction({ title: '', designType: '', instructions: '', categories: [], scopes: [], department: '', requiredDate: '', submissionKey: id })],
    ['start reference upload', 'requests.general.read-own', () => startGeneralRequestReferenceUploadAction({ id, name: 'brief.pdf', size: 100 })],
    ['resume reference upload', 'requests.general.read-own', () => resumeGeneralRequestUploadAction(id, 'REFERENCIAS')],
    ['expire reference upload', 'requests.general.read-own', () => expireGeneralRequestUploadAction(id, 'REFERENCIAS')],
    ['finish reference upload', 'requests.general.read-own', () => finishGeneralRequestReferenceUploadAction(id)],
    ['cancel reference upload', 'requests.general.read-own', () => cancelGeneralRequestReferenceUploadAction(id)],
    ['request cancellation', 'requests.general.read-own', () => requestGeneralCancellationAction(id, 'reason')],
    ['start', 'design.general.start', () => startGeneralDesignWorkAction(id)],
    ['deliver', 'design.general.deliver', () => deliverGeneralDesignRequestAction(id)],
    ['start deliverable upload', 'design.general.deliverable.upload', () => startGeneralDesignDeliverableUploadAction({ id, name: 'design.pdf', size: 100 })],
    ['resume deliverable upload', 'design.general.deliverable.upload', () => resumeGeneralRequestUploadAction(id, 'ENTREGABLES')],
    ['expire deliverable upload', 'design.general.deliverable.upload', () => expireGeneralRequestUploadAction(id, 'ENTREGABLES')],
    ['finish deliverable upload', 'design.general.deliverable.upload', () => finishGeneralDesignDeliverableUploadAction(id)],
    ['cancel deliverable upload', 'design.general.deliverable.upload', () => cancelGeneralDesignDeliverableUploadAction(id)],
    ['list pending deliverable uploads', 'design.general.deliverable.upload', () => listGeneralRequestPendingUploadsAction(id, 'ENTREGABLES')],
    ['update priority', 'design.general.priority.update', () => setGeneralDesignPriorityAction(id, 'HIGH')],
    ['resolve cancellation', 'design.general.cancellation.resolve', () => resolveGeneralCancellationAction(id, 'APPROVED', '')],
  ])('does not let design.requests.read authorize %s', async (_label, permission, invoke) => {
    const result = await invoke();

    expect(authorizeAction).toHaveBeenCalledWith(permission);
    expect(result.success).toBe(false);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});

describe('GENERAL specific permissions allow the intended action to reach business validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['start', 'design.general.start', () => startGeneralDesignWorkAction(id)],
    ['deliver', 'design.general.deliver', () => deliverGeneralDesignRequestAction(id)],
    ['deliverable upload', 'design.general.deliverable.upload', () => listGeneralRequestPendingUploadsAction(id, 'ENTREGABLES')],
    ['priority', 'design.general.priority.update', () => setGeneralDesignPriorityAction(id, 'HIGH')],
    ['cancellation resolution', 'design.general.cancellation.resolve', () => resolveGeneralCancellationAction(id, 'APPROVED', '')],
  ])('%s is authorized by its dedicated permission', async (_label, permission, invoke) => {
    allowPermission(permission);
    const rows = [
      makeQuery({ data: null }),
      makeQuery({ data: { status: 'EN_DISENO' } }),
      makeQuery({ data: [], error: null }),
      makeQuery({ data: null, error: null }),
      makeQuery({ data: { status: 'EN_DISENO' } }),
      makeQuery({ data: null }),
      makeQuery({ data: null, error: null }),
    ];
    const admin = { from: jest.fn(() => rows.shift() ?? makeQuery({ data: null, error: null })) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await invoke();

    expect(authorizeAction).toHaveBeenCalledWith(permission);
    expect(getSupabaseAdmin).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/permiso/i);
  });
});

describe('GENERAL upload ownership and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowPermission('design.general.deliverable.upload');
  });

  it('lists only the authorized actor pending deliverable uploads', async () => {
    const requestQuery = makeQuery({ data: { status: 'EN_DISENO' } });
    const uploadQuery = makeQuery({ data: [{ id: 'own-upload', file_name: 'own.pdf', mime_type: 'application/pdf', file_size: 20, created_at: '2026-01-01' }] });
    const admin = { from: jest.fn().mockReturnValueOnce(requestQuery).mockReturnValueOnce(uploadQuery) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await listGeneralRequestPendingUploadsAction(id, 'ENTREGABLES');

    expect(result).toMatchObject({ success: true, uploads: [{ id: 'own-upload' }] });
    expect(uploadQuery.eq).toHaveBeenCalledWith('request_id', id);
    expect(uploadQuery.eq).toHaveBeenCalledWith('category', 'ENTREGABLES');
    expect(uploadQuery.eq).toHaveBeenCalledWith('status', 'UPLOADING');
    expect(uploadQuery.eq).toHaveBeenCalledWith('actor_id', id);
  });

  it('marks an owned upload without a session URI failed and reports it restartable', async () => {
    const uploadQuery = makeQuery({ data: { id: 'own-upload', request_id: id, actor_id: id, session_uri: null } });
    const requestQuery = makeQuery({ data: { status: 'EN_DISENO' } });
    const updateQuery = makeQuery({ data: { id: uploadId }, error: null });
    const admin = { from: jest.fn().mockReturnValueOnce(uploadQuery).mockReturnValueOnce(requestQuery).mockReturnValueOnce(updateQuery) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await resumeGeneralRequestUploadAction('00000000-0000-4000-8000-000000000002', 'ENTREGABLES');

    expect(result).toMatchObject({ success: false, restartable: true });
    expect(updateQuery.update).toHaveBeenCalledWith({ status: 'FAILED', session_uri: null });
    expect(updateQuery.eq).toHaveBeenCalledWith('actor_id', id);
    expect(updateQuery.eq).toHaveBeenCalledWith('category', 'ENTREGABLES');
  });

  it.each([
    ['resume', () => resumeGeneralRequestUploadAction('00000000-0000-4000-8000-000000000003', 'ENTREGABLES')],
    ['expire', () => expireGeneralRequestUploadAction('00000000-0000-4000-8000-000000000003', 'ENTREGABLES')],
    ['cancel', () => cancelGeneralDesignDeliverableUploadAction('00000000-0000-4000-8000-000000000003')],
  ])('does not let an actor %s another actor upload', async (_label, invoke) => {
    const lookup = makeQuery({ data: null });
    const admin = { from: jest.fn().mockReturnValue(lookup) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await invoke();

    expect(result.success).toBe(false);
    expect(lookup.eq).toHaveBeenCalledWith('actor_id', id);
    expect(lookup.update).not.toHaveBeenCalled();
  });

  it('does not restart an upload when its request is no longer in design', async () => {
    const uploadQuery = makeQuery({ data: { id: 'own-upload', request_id: id, actor_id: id, session_uri: null } });
    const requestQuery = makeQuery({ data: { status: 'ENTREGADA' } });
    const admin = { from: jest.fn().mockReturnValueOnce(uploadQuery).mockReturnValueOnce(requestQuery) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await resumeGeneralRequestUploadAction('00000000-0000-4000-8000-000000000002', 'ENTREGABLES');

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('restartable', true);
    expect(admin.from).toHaveBeenCalledTimes(2);
  });
});

function setupFinishUpload(category: 'REFERENCIAS' | 'ENTREGABLES', uploadStatus = 'UPLOADING', updatedRow: { id: string } | null = { id: uploadId }) {
  const uploadQuery = makeQuery({ data: { id: uploadId, request_id: id, actor_id: id, status: uploadStatus, file_name: 'final.pdf', file_size: 42, mime_type: 'application/pdf' } });
  const requestQuery = makeQuery({ data: { drive_folder_id: 'request-folder', status: category === 'REFERENCIAS' ? 'SOLICITADA' : 'EN_DISENO' } });
  const updateQuery = makeQuery({ data: updatedRow, error: null });
  const historyQuery = makeQuery({ data: null, error: null });
  const admin = { from: jest.fn().mockReturnValueOnce(uploadQuery).mockReturnValueOnce(requestQuery).mockReturnValueOnce(updateQuery).mockReturnValueOnce(historyQuery) };
  jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
  jest.mocked(ensureDriveChildFolder).mockResolvedValue({ id: 'child-folder' } as never);
  jest.mocked(findDriveUploadedFile).mockResolvedValue({ id: 'drive-file', webViewLink: 'https://drive.test/file', size: 42, mimeType: 'application/pdf' } as never);
  return { admin, updateQuery, historyQuery };
}

describe('GENERAL upload finalization concurrency guards', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finalizes a reference upload with actor, category, and status compare-and-set filters', async () => {
    allowPermission('requests.general.read-own');
    const { updateQuery, historyQuery } = setupFinishUpload('REFERENCIAS');

    const result = await finishGeneralRequestReferenceUploadAction(uploadId);

    expect(result.success).toBe(true);
    expect(updateQuery.eq).toHaveBeenCalledWith('id', uploadId);
    expect(updateQuery.eq).toHaveBeenCalledWith('actor_id', id);
    expect(updateQuery.eq).toHaveBeenCalledWith('category', 'REFERENCIAS');
    expect(updateQuery.eq).toHaveBeenCalledWith('status', 'UPLOADING');
    expect(updateQuery.select).toHaveBeenCalledWith('id');
    expect(updateQuery.maybeSingle).toHaveBeenCalled();
    expect(historyQuery.insert).toHaveBeenCalled();
  });

  it.each([
    ['REFERENCIAS', finishGeneralRequestReferenceUploadAction, 'requests.general.read-own'],
    ['ENTREGABLES', finishGeneralDesignDeliverableUploadAction, 'design.general.deliverable.upload'],
  ] as const)('rejects a %s row that is no longer UPLOADING', async (_category, finish, permission) => {
    allowPermission(permission);
    const uploadQuery = makeQuery({ data: { id: uploadId, request_id: id, actor_id: id, status: 'CANCELLED', file_name: 'final.pdf', file_size: 42, mime_type: 'application/pdf' } });
    const admin = { from: jest.fn().mockReturnValue(uploadQuery) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await finish(uploadId);

    expect(result.success).toBe(false);
    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(findDriveUploadedFile).not.toHaveBeenCalled();
  });

  it('finalizes a deliverable upload with actor, category, and status compare-and-set filters', async () => {
    allowPermission('design.general.deliverable.upload');
    const { updateQuery, historyQuery } = setupFinishUpload('ENTREGABLES');

    const result = await finishGeneralDesignDeliverableUploadAction(uploadId);

    expect(result.success).toBe(true);
    expect(updateQuery.eq).toHaveBeenCalledWith('id', uploadId);
    expect(updateQuery.eq).toHaveBeenCalledWith('actor_id', id);
    expect(updateQuery.eq).toHaveBeenCalledWith('category', 'ENTREGABLES');
    expect(updateQuery.eq).toHaveBeenCalledWith('status', 'UPLOADING');
    expect(updateQuery.select).toHaveBeenCalledWith('id');
    expect(updateQuery.maybeSingle).toHaveBeenCalled();
    expect(historyQuery.insert).toHaveBeenCalled();
  });

  it.each([
    ['REFERENCIAS', finishGeneralRequestReferenceUploadAction, 'requests.general.read-own'],
    ['ENTREGABLES', finishGeneralDesignDeliverableUploadAction, 'design.general.deliverable.upload'],
  ] as const)('does not record history when the %s conditional update affects no row', async (_category, finish, permission) => {
    allowPermission(permission);
    const { admin, updateQuery } = setupFinishUpload(_category, 'UPLOADING', null);

    const result = await finish(uploadId);

    expect(result.success).toBe(false);
    expect(updateQuery.select).toHaveBeenCalledWith('id');
    expect(admin.from).toHaveBeenCalledTimes(3);
  });
});

describe('GENERAL upload recovery compare-and-set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowPermission('design.general.deliverable.upload');
  });

  it('does not report a missing-session upload restartable if marking FAILED affects no row', async () => {
    const uploadQuery = makeQuery({ data: { id: uploadId, request_id: id, actor_id: id, session_uri: null } });
    const requestQuery = makeQuery({ data: { status: 'EN_DISENO' } });
    const updateQuery = makeQuery({ data: null, error: null });
    const admin = { from: jest.fn().mockReturnValueOnce(uploadQuery).mockReturnValueOnce(requestQuery).mockReturnValueOnce(updateQuery) };
    jest.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const result = await resumeGeneralRequestUploadAction(uploadId, 'ENTREGABLES');

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('restartable', true);
    expect(updateQuery.eq).toHaveBeenCalledWith('id', uploadId);
    expect(updateQuery.eq).toHaveBeenCalledWith('actor_id', id);
    expect(updateQuery.eq).toHaveBeenCalledWith('category', 'ENTREGABLES');
    expect(updateQuery.eq).toHaveBeenCalledWith('status', 'UPLOADING');
    expect(updateQuery.select).toHaveBeenCalledWith('id');
  });
});
