import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DESIGN_SOURCES,
  type DesignRequestCapabilities,
  type DesignRequestDetailModel,
  type DesignRequestListFilters,
  type DesignRequestModel,
  type DesignRequestSource,
  type DesignRequestSourceRegistry,
  type DesignRequestUploadOperations,
  type DesignUploadKind,
  type DesignPendingUpload,
  type DesignActor,
  type Result,
} from './index';

const generalRequest = {
  id: 'GENERAL:request-1',
  source: 'GENERAL',
  sourceRecordId: 'request-1',
  title: 'Flyer de temporada',
  requesterId: 'actor-1',
  requestedAt: '2026-11-01T10:00:00Z',
  instructions: 'Preparar una pieza promocional.',
  targetDate: '2026-11-20',
  requestedOutputs: [{ category: 'DIGITAL', sourceFormatCode: 'DIGITAL', label: 'Digital' }],
  status: 'REQUESTED',
  sourceStatus: 'SOLICITADA',
  designerId: null,
  startedAt: null,
  deliveredAt: null,
  priority: 'NORMAL',
  updatedAt: '2026-11-01T10:00:00Z',
  sourceData: {
    designType: 'DIGITAL',
    designTypeOther: null,
    department: 'Mercadeo',
    categories: ['Temporada'],
    scopes: ['Online'],
    requesterRole: 'social-media',
  },
} satisfies DesignRequestModel<'GENERAL'>;

const generalDetail = {
  ...generalRequest,
  createdAt: generalRequest.requestedAt,
  designer: null,
  usageDate: { label: 'Fecha requerida', value: generalRequest.targetDate },
  copy: null,
  correction: null,
  history: [],
} satisfies DesignRequestDetailModel<'GENERAL'>;

const socialMediaRequest = {
  ...generalRequest,
  source: 'SOCIAL_MEDIA',
  sourceData: { format: 'STORY', channels: ['INSTAGRAM'], publicationDate: null, campaignName: 'Verano', topics: ['Lanzamiento'] },
} satisfies DesignRequestModel<'SOCIAL_MEDIA'>;

const eventsRequest = {
  ...generalRequest,
  source: 'EVENTS',
  sourceData: { eventName: 'Apertura', stores: ['Centro'], startsAt: null, endsAt: null, formats: ['DIGITAL'], eventStatus: 'CANCELLED' },
} satisfies DesignRequestModel<'EVENTS'>;

const internalRequest = {
  ...generalRequest,
  source: 'INTERNAL',
  sourceData: { taskType: 'IMPRESION', storeName: 'Centro', quantity: 12, neededBy: '2026-12-01' },
} satisfies DesignRequestModel<'INTERNAL'>;

// @ts-expect-error SOCIAL_MEDIA cannot carry the EVENTS source data shape.
const invalidSocialMediaRequest: DesignRequestModel<'SOCIAL_MEDIA'> = eventsRequest;

const generalCapabilities: DesignRequestCapabilities = {
  start: true,
  deliver: true,
  reopen: false,
  fileAccess: {
    REFERENCE: { readCompletedFiles: true, readPendingUploads: true },
    DELIVERABLE: { readCompletedFiles: false, readPendingUploads: true },
  },
  uploads: {
    REFERENCE: { reserve: true, finalize: true, resumable: true, cancellable: true },
    DELIVERABLE: { reserve: true, finalize: true, resumable: true, cancellable: true },
  },
};

const pendingGeneralUpload: DesignPendingUpload = {
  id: 'upload-1',
  kind: 'DELIVERABLE',
  fileName: 'entrega.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  status: 'UPLOADING',
  sourceStatus: 'UPLOADING',
  expiresAt: '2026-11-20T10:00:00Z',
};

const generalUploads = {
  supportedKinds: ['REFERENCE', 'DELIVERABLE'],
  reserveUpload: async (kind, request, actor, input) => {
    void kind;
    void request;
    void actor;
    return {
      ok: true,
      value: { uploadId: 'upload-1', fileName: input.fileName, mimeType: input.mimeType ?? 'application/pdf', size: input.size, transfer: { url: 'https://upload.invalid/session', resumable: true, expiresAt: pendingGeneralUpload.expiresAt } },
    } as const;
  },
  finalizeUpload: async (kind, request, actor, input) => {
    void request;
    void actor;
    return ({
    ok: true,
    value: { id: input.uploadId, kind, fileName: kind === 'REFERENCE' ? 'referencia.pdf' : 'entrega.pdf', mimeType: 'application/pdf', size: 1024, url: null, createdAt: null },
    }) as const;
  },
  listFiles: async (kind, request, actor) => {
    void request;
    void actor;
    return { ok: true, value: [{ id: `file-${kind}`, kind, fileName: `${kind.toLowerCase()}.pdf`, mimeType: 'application/pdf', size: 1024, url: null, createdAt: null }] } as const;
  },
  listPendingUploads: async (kind, request, actor) => {
    void request;
    void actor;
    return { ok: true, value: [{ ...pendingGeneralUpload, kind }] } as const;
  },
} satisfies DesignRequestUploadOperations<'GENERAL'>;

function makeUploadFixture<S extends DesignRequestModel['source'], TReserveInput, TFinalizeInput>(
  supportedKinds: readonly DesignUploadKind[],
  reserveUpload: DesignRequestUploadOperations<S, TReserveInput, TFinalizeInput>['reserveUpload'],
  finalizeUpload: DesignRequestUploadOperations<S, TReserveInput, TFinalizeInput>['finalizeUpload'],
): DesignRequestUploadOperations<S, TReserveInput, TFinalizeInput> {
  return { supportedKinds, reserveUpload, finalizeUpload };
}

const generalSource = {
  source: 'GENERAL',
  list: async (filters: DesignRequestListFilters<{ department?: string }>, actor: DesignActor) => {
    void filters.sourceSpecific?.department;
    void actor;
    return { ok: true, value: [generalRequest] } as const;
  },
  getDetail: async (id: string, actor: DesignActor) => {
    void id;
    void actor;
    return { ok: true, value: generalDetail } as const;
  },
  capabilities: async (request: DesignRequestModel<'GENERAL'>, actor: DesignActor) => {
    void request;
    void actor;
    return { ok: true, value: generalCapabilities } as const;
  },
  start: async (request: DesignRequestModel<'GENERAL'>, actor: DesignActor) => {
    void request;
    void actor;
    return { ok: true, value: undefined } as const;
  },
  deliver: async (request: DesignRequestModel<'GENERAL'>, actor: DesignActor) => {
    void request;
    void actor;
    return { ok: true, value: undefined } as const;
  },
  uploads: generalUploads,
} satisfies DesignRequestSource<'GENERAL', { department?: string }>;

type SourceOptions = {
  SOCIAL_MEDIA: {
    filters: { channel?: string };
    startInput: never;
    deliverInput: { publicationCycleId: string };
    reopenInput: never;
    reserveUploadInput: { fileName: string; size: number; mimeType?: string };
    finalizeUploadInput: { uploadId: string; driveFileId: string };
  };
  EVENTS: {
    filters: { eventStatus?: string };
    startInput: never;
    deliverInput: never;
    reopenInput: { reason: string };
    reserveUploadInput: { fileName: string; size: number; mimeType?: string };
    finalizeUploadInput: { uploadId: string };
  };
  INTERNAL: {
    filters: { storeName?: string };
    startInput: never;
    deliverInput: { uploadId: string };
    reopenInput: never;
    reserveUploadInput: { fileName: string; size: number; mimeType: string };
    finalizeUploadInput: { uploadId: string };
  };
  GENERAL: {
    filters: { department?: string };
    startInput: never;
    deliverInput: never;
    reopenInput: never;
    reserveUploadInput: { fileName: string; size: number; mimeType?: string };
    finalizeUploadInput: { uploadId: string };
  };
};

const noCapabilities: DesignRequestCapabilities = {
  start: false,
  deliver: false,
  reopen: false,
  fileAccess: {},
  uploads: {},
};

const socialMediaSource = {
  source: 'SOCIAL_MEDIA',
  list: async (filters: DesignRequestListFilters<{ channel?: string }>, actor: DesignActor) => { void filters; void actor; return { ok: true, value: [] } as const; },
  getDetail: async (id: string, actor: DesignActor) => { void id; void actor; return { ok: false, error: { code: 'NOT_FOUND', message: 'Missing.' } } as const; },
  capabilities: async (request: DesignRequestModel<'SOCIAL_MEDIA'>, actor: DesignActor) => { void request; void actor; return { ok: true, value: noCapabilities } as const; },
  deliver: async (_request: DesignRequestModel<'SOCIAL_MEDIA'>, _actor: DesignActor, input: SourceOptions['SOCIAL_MEDIA']['deliverInput']) => {
    void input.publicationCycleId;
    return { ok: true, value: undefined } as const;
  },
  uploads: makeUploadFixture<'SOCIAL_MEDIA', SourceOptions['SOCIAL_MEDIA']['reserveUploadInput'], SourceOptions['SOCIAL_MEDIA']['finalizeUploadInput']>(
    ['DELIVERABLE'],
    async (kind, request, actor, input) => {
      void kind; void request; void actor;
      return { ok: true, value: { uploadId: `sm-${input.fileName}`, fileName: input.fileName, mimeType: input.mimeType ?? 'image/png', size: input.size, transfer: { url: 'https://upload.invalid/social', resumable: true, expiresAt: null } } };
    },
    async (kind, request, actor, input) => {
      void request; void actor; void input.driveFileId;
      return { ok: true, value: { id: input.uploadId, kind, fileName: 'social.png', mimeType: 'image/png', size: 100, url: null, createdAt: null } };
    },
  ),
} satisfies DesignRequestSource<'SOCIAL_MEDIA', SourceOptions['SOCIAL_MEDIA']['filters'], never, SourceOptions['SOCIAL_MEDIA']['deliverInput'], never, SourceOptions['SOCIAL_MEDIA']['reserveUploadInput'], SourceOptions['SOCIAL_MEDIA']['finalizeUploadInput']>;

const eventsSource = {
  source: 'EVENTS',
  list: async (filters: DesignRequestListFilters<{ eventStatus?: string }>, actor: DesignActor) => { void filters; void actor; return { ok: true, value: [] } as const; },
  getDetail: async (id: string, actor: DesignActor) => { void id; void actor; return { ok: false, error: { code: 'NOT_FOUND', message: 'Missing.' } } as const; },
  capabilities: async (request: DesignRequestModel<'EVENTS'>, actor: DesignActor) => { void request; void actor; return { ok: true, value: noCapabilities } as const; },
  reopen: async (_request: DesignRequestModel<'EVENTS'>, _actor: DesignActor, input: SourceOptions['EVENTS']['reopenInput']) => {
    void input.reason;
    return { ok: true, value: undefined } as const;
  },
  uploads: makeUploadFixture<'EVENTS', SourceOptions['EVENTS']['reserveUploadInput'], SourceOptions['EVENTS']['finalizeUploadInput']>(
    ['DELIVERABLE'],
    async (kind, request, actor, input) => {
      void kind; void request; void actor;
      return { ok: true, value: { uploadId: `event-${input.fileName}`, fileName: input.fileName, mimeType: input.mimeType ?? 'application/pdf', size: input.size, transfer: { url: 'https://upload.invalid/events', resumable: true, expiresAt: null } } };
    },
    async (kind, request, actor, input) => {
      void request; void actor;
      return { ok: true, value: { id: input.uploadId, kind, fileName: 'event.pdf', mimeType: 'application/pdf', size: 100, url: null, createdAt: null } };
    },
  ),
} satisfies DesignRequestSource<'EVENTS', SourceOptions['EVENTS']['filters'], never, never, SourceOptions['EVENTS']['reopenInput'], SourceOptions['EVENTS']['reserveUploadInput'], SourceOptions['EVENTS']['finalizeUploadInput']>;

const internalSource = {
  source: 'INTERNAL',
  list: async (filters: DesignRequestListFilters<{ storeName?: string }>, actor: DesignActor) => { void filters; void actor; return { ok: true, value: [] } as const; },
  getDetail: async (id: string, actor: DesignActor) => { void id; void actor; return { ok: false, error: { code: 'NOT_FOUND', message: 'Missing.' } } as const; },
  capabilities: async (request: DesignRequestModel<'INTERNAL'>, actor: DesignActor) => { void request; void actor; return { ok: true, value: noCapabilities } as const; },
  deliver: async (_request: DesignRequestModel<'INTERNAL'>, _actor: DesignActor, input: SourceOptions['INTERNAL']['deliverInput']) => {
    void input.uploadId;
    return { ok: true, value: undefined } as const;
  },
  uploads: makeUploadFixture<'INTERNAL', SourceOptions['INTERNAL']['reserveUploadInput'], SourceOptions['INTERNAL']['finalizeUploadInput']>(
    ['DELIVERABLE'],
    async (kind, request, actor, input) => {
      void kind; void request; void actor;
      return { ok: true, value: { uploadId: `internal-${input.fileName}`, fileName: input.fileName, mimeType: input.mimeType, size: input.size, transfer: { url: 'https://upload.invalid/internal', resumable: true, expiresAt: null } } };
    },
    async (kind, request, actor, input) => {
      void request; void actor;
      return { ok: true, value: { id: input.uploadId, kind, fileName: 'internal.pdf', mimeType: 'application/pdf', size: 100, url: null, createdAt: null } };
    },
  ),
} satisfies DesignRequestSource<'INTERNAL', SourceOptions['INTERNAL']['filters'], never, SourceOptions['INTERNAL']['deliverInput'], never, SourceOptions['INTERNAL']['reserveUploadInput'], SourceOptions['INTERNAL']['finalizeUploadInput']>;

const generalRegistrySource = {
  source: 'GENERAL',
  list: async (filters: DesignRequestListFilters<{ department?: string }>, actor: DesignActor) => { void filters; void actor; return { ok: true, value: [] } as const; },
  getDetail: async (id: string, actor: DesignActor) => { void id; void actor; return { ok: false, error: { code: 'NOT_FOUND', message: 'Missing.' } } as const; },
  capabilities: async (request: DesignRequestModel<'GENERAL'>, actor: DesignActor) => { void request; void actor; return { ok: true, value: noCapabilities } as const; },
  uploads: generalUploads,
} satisfies DesignRequestSource<'GENERAL', SourceOptions['GENERAL']['filters'], never, never, never, SourceOptions['GENERAL']['reserveUploadInput'], SourceOptions['GENERAL']['finalizeUploadInput']>;

const sourceRegistry: DesignRequestSourceRegistry<SourceOptions> = {
  SOCIAL_MEDIA: socialMediaSource,
  EVENTS: eventsSource,
  INTERNAL: internalSource,
  GENERAL: generalRegistrySource,
};

function dispatchReopen(request: DesignRequestModel, actor: DesignActor): Promise<Result<void>> {
  switch (request.source) {
    case 'SOCIAL_MEDIA':
      return sourceRegistry.SOCIAL_MEDIA.reopen?.(request, actor)
        ?? Promise.resolve({ ok: false, error: { code: 'INVALID_STATE', message: 'Not supported.' } });
    case 'EVENTS':
      return sourceRegistry.EVENTS.reopen?.(request, actor, { reason: 'Revision solicitada.' })
        ?? Promise.resolve({ ok: false, error: { code: 'INVALID_STATE', message: 'Not supported.' } });
    case 'INTERNAL':
      return sourceRegistry.INTERNAL.reopen?.(request, actor)
        ?? Promise.resolve({ ok: false, error: { code: 'INVALID_STATE', message: 'Not supported.' } });
    case 'GENERAL':
      if (!sourceRegistry.GENERAL.reopen) {
        return Promise.resolve({ ok: false, error: { code: 'INVALID_STATE', message: 'General requests cannot be reopened.' } });
      }
      return sourceRegistry.GENERAL.reopen(request, actor);
  }
}

function assertSourceTypeSafety(actor: DesignActor) {
  // @ts-expect-error a GENERAL model cannot be dispatched as SOCIAL_MEDIA.
  sourceRegistry.SOCIAL_MEDIA.capabilities(generalRequest, actor);
  // @ts-expect-error filters from another source are rejected.
  sourceRegistry.SOCIAL_MEDIA.list({ sourceSpecific: { department: 'Mercadeo' } }, actor);
  return dispatchReopen(generalRequest, actor);
}

function assertUploadInputTypeSafety(actor: DesignActor) {
  // @ts-expect-error INTERNAL requires the MIME value it validates.
  sourceRegistry.INTERNAL.uploads?.reserveUpload('DELIVERABLE', internalRequest, actor, { fileName: 'interno.pdf', size: 20 });
  // @ts-expect-error SOCIAL_MEDIA finalization requires its Drive file id.
  sourceRegistry.SOCIAL_MEDIA.uploads?.finalizeUpload('DELIVERABLE', socialMediaRequest, actor, { uploadId: 'sm-1' });
  // @ts-expect-error EVENTS finalization does not accept SOCIAL_MEDIA-only metadata.
  sourceRegistry.EVENTS.uploads?.finalizeUpload('DELIVERABLE', eventsRequest, actor, { uploadId: 'event-1', driveFileId: 'drive-1' });
  return true;
}

type EventReopenOperation = NonNullable<
  DesignRequestSource<'EVENTS', Record<never, never>, never, never, { reason: string }>['reopen']
>;

const eventReopenWithReason: EventReopenOperation = async (_request, _actor: DesignActor, input) =>
  input.reason.length > 0
    ? { ok: true, value: undefined }
    : { ok: false, error: { code: 'INVALID_INPUT', message: 'A reason is required.' } };

describe('neutral DesignRequestSource contract', () => {
  it('publishes all supported source discriminants', () => {
    expect(DESIGN_SOURCES).toEqual(['SOCIAL_MEDIA', 'EVENTS', 'INTERNAL', 'GENERAL']);
    expect(socialMediaRequest.sourceData.campaignName).toBe('Verano');
    expect(eventsRequest.sourceData.eventStatus).toBe('CANCELLED');
    expect(internalRequest.sourceData.taskType).toBe('IMPRESION');
    expect(invalidSocialMediaRequest).toBeDefined();
  });

  it('allows source-specific typed models, filters, and different operation capabilities', async () => {
    const actor = { id: 'actor-1' } satisfies DesignActor;
    const result = await generalSource.list({ sourceSpecific: { department: 'Mercadeo' } }, actor);
    const detail = await generalSource.getDetail('GENERAL:request-1', actor);

    expect(result).toMatchObject({ ok: true, value: [{ source: 'GENERAL', sourceStatus: 'SOLICITADA' }] });
    expect(detail).toMatchObject({ ok: true, value: { source: 'GENERAL' } });
    expect(generalCapabilities.reopen).toBe(false);
    expect(generalCapabilities.uploads.REFERENCE?.resumable).toBe(true);
    expect(generalCapabilities.fileAccess.DELIVERABLE).toEqual({ readCompletedFiles: false, readPendingUploads: true });
    expect(generalCapabilities.deliver).toBe(true);
    expect(generalCapabilities.uploads.REFERENCE?.reserve).toBe(true);
    const listFiles = jest.fn(generalSource.uploads?.listFiles);
    const references = generalCapabilities.fileAccess.REFERENCE?.readCompletedFiles
      ? await listFiles('REFERENCE', generalRequest, actor)
      : undefined;
    const hiddenDeliverables = generalCapabilities.fileAccess.DELIVERABLE?.readCompletedFiles
      ? await listFiles('DELIVERABLE', generalRequest, actor)
      : undefined;
    const pending = generalCapabilities.fileAccess.DELIVERABLE?.readPendingUploads
      ? await generalSource.uploads?.listPendingUploads?.('DELIVERABLE', generalRequest, actor)
      : undefined;
    expect(references).toMatchObject({ ok: true, value: [{ kind: 'REFERENCE' }] });
    expect(hiddenDeliverables).toBeUndefined();
    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(pending).toMatchObject({ ok: true, value: [{ status: 'UPLOADING', kind: 'DELIVERABLE' }] });
  });

  it('keeps upload inputs and outputs specific to each registry source', async () => {
    const actor = { id: 'actor-1' } satisfies DesignActor;
    expect(assertUploadInputTypeSafety(actor)).toBe(true);

    const socialReservation = await sourceRegistry.SOCIAL_MEDIA.uploads?.reserveUpload('DELIVERABLE', socialMediaRequest, actor, { fileName: 'social.png', size: 101 });
    const eventsReservation = await sourceRegistry.EVENTS.uploads?.reserveUpload('DELIVERABLE', eventsRequest, actor, { fileName: 'event.pdf', size: 202 });
    const internalReservation = await sourceRegistry.INTERNAL.uploads?.reserveUpload('DELIVERABLE', internalRequest, actor, { fileName: 'internal.pdf', size: 303, mimeType: 'application/pdf' });
    const generalReservation = await sourceRegistry.GENERAL.uploads?.reserveUpload('REFERENCE', generalRequest, actor, { fileName: 'general.pdf', size: 404 });
    expect(socialReservation).toMatchObject({ ok: true, value: { fileName: 'social.png', size: 101 } });
    expect(eventsReservation).toMatchObject({ ok: true, value: { fileName: 'event.pdf', size: 202 } });
    expect(internalReservation).toMatchObject({ ok: true, value: { fileName: 'internal.pdf', size: 303, mimeType: 'application/pdf' } });
    expect(generalReservation).toMatchObject({ ok: true, value: { fileName: 'general.pdf', size: 404 } });

    const socialFile = await sourceRegistry.SOCIAL_MEDIA.uploads?.finalizeUpload('DELIVERABLE', socialMediaRequest, actor, { uploadId: 'sm-upload', driveFileId: 'drive-file' });
    const eventsFile = await sourceRegistry.EVENTS.uploads?.finalizeUpload('DELIVERABLE', eventsRequest, actor, { uploadId: 'event-upload' });
    const internalFile = await sourceRegistry.INTERNAL.uploads?.finalizeUpload('DELIVERABLE', internalRequest, actor, { uploadId: 'internal-upload' });
    const generalFile = await sourceRegistry.GENERAL.uploads?.finalizeUpload('REFERENCE', generalRequest, actor, { uploadId: 'general-upload' });
    expect(socialFile).toMatchObject({ ok: true, value: { id: 'sm-upload', kind: 'DELIVERABLE' } });
    expect(eventsFile).toMatchObject({ ok: true, value: { id: 'event-upload', kind: 'DELIVERABLE' } });
    expect(internalFile).toMatchObject({ ok: true, value: { id: 'internal-upload', kind: 'DELIVERABLE' } });
    expect(generalFile).toMatchObject({ ok: true, value: { id: 'general-upload', kind: 'REFERENCE' } });
  });

  it('does not require a source to implement reopen and dispatches GENERAL safely', async () => {
    expect('reopen' in generalSource).toBe(false);
    expect('reopen' in sourceRegistry.GENERAL).toBe(false);
    expect(eventReopenWithReason).toBeDefined();
    expect(assertSourceTypeSafety).toBeDefined();
    await expect(dispatchReopen(generalRequest, { id: 'actor-1' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
  });

  it('types success and normalized failures with source error-code support', () => {
    const success: Result<number> = { ok: true, value: 7 };
    const denied: Result<number> = { ok: false, error: { code: 'FORBIDDEN', message: 'Not allowed.' } };
    const sourceFailure: Result<number> = {
      ok: false,
      error: { code: 'SOURCE_ERROR', sourceCode: '42501', message: 'Source rejected the operation.' },
    };

    expect(success).toEqual({ ok: true, value: 7 });
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(sourceFailure).toMatchObject({ ok: false, error: { code: 'SOURCE_ERROR', sourceCode: '42501' } });
  });

  it('keeps the public API free of imports and server-only dependencies', () => {
    const publicApi = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
    expect(publicApi).not.toMatch(/^\s*import\s/m);
    expect(publicApi).not.toMatch(/server-only|supabase|googleapis|service_role|drive/i);
  });
});
