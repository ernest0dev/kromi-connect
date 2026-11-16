/** Public, client-safe domain contract for Design request sources. */

export const DESIGN_SOURCES = ['SOCIAL_MEDIA', 'EVENTS', 'INTERNAL', 'GENERAL'] as const;

export type DesignSource = (typeof DESIGN_SOURCES)[number];

export type DesignRequestStatus =
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'NEEDS_CHANGES'
  | 'DELIVERED'
  | 'CANCELLED';

export type DesignPriority = 'HIGH' | 'NORMAL' | 'LOW';

export type DesignOutput = {
  category: string;
  sourceFormatCode: string;
  label: string;
  specification?: string | null;
};

export type DesignRequestSourceData = {
  SOCIAL_MEDIA: {
    format: string;
    channels: readonly string[];
    publicationDate: string | null;
    campaignName?: string | null;
    topics?: readonly string[];
  };
  EVENTS: {
    eventName: string;
    stores: readonly string[];
    startsAt: string | null;
    endsAt: string | null;
    formats: readonly string[];
    /** Current event lifecycle status; distinct from the Design request status. */
    eventStatus: string | null;
  };
  INTERNAL: {
    taskType: string;
    storeName: string | null;
    quantity: number | null;
    neededBy: string | null;
  };
  GENERAL: {
    designType: string;
    designTypeOther: string | null;
    department: string | null;
    categories: readonly string[];
    scopes: readonly string[];
    requesterRole: string | null;
  };
};

export type DesignRequestModel<TSource extends DesignSource = DesignSource> =
  TSource extends DesignSource
    ? {
        /** Stable, source-qualified identifier used by Design routes. */
        id: string;
        source: TSource;
        sourceRecordId: string;
        title: string;
        requesterId: string | null;
        requestedAt: string | null;
        instructions: string;
        targetDate: string | null;
        requestedOutputs: readonly DesignOutput[];
        status: DesignRequestStatus;
        /** Original source status, retained for source-specific rules and audit. */
        sourceStatus: string | null;
        designerId: string | null;
        startedAt: string | null;
        deliveredAt: string | null;
        priority: DesignPriority | null;
        updatedAt: string | null;
        sourceData: DesignRequestSourceData[TSource];
      }
    : never;

export type DesignRequestDetailModel<TSource extends DesignSource = DesignSource> =
  DesignRequestModel<TSource> & {
    createdAt: string | null;
    designer: { id: string; name: string | null } | null;
    usageDate: { label: string; value: string | null } | null;
    copy: { hook?: string; body?: string; cta?: string; hashtags?: readonly string[] } | null;
    correction: { text: string; at: string } | null;
    history: readonly DesignHistoryEntry[];
  };

export type DesignHistoryEntry = {
  at: string;
  label: string;
  note?: string | null;
  actorId?: string | null;
  actorName?: string | null;
};

/** Identity only; adapters must perform their own permission checks. */
export type DesignActor = {
  id: string;
  roleCode?: string;
};

export type DesignRequestListFilters<TSourceFilters extends object = Record<never, never>> = {
  statuses?: readonly DesignRequestStatus[];
  search?: string;
  /** null means unassigned; a string is a user id. */
  designerId?: string | null;
  targetDateFrom?: string;
  targetDateTo?: string;
  sourceSpecific?: TSourceFilters;
};

export type DesignRequestErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'UPLOAD_REJECTED'
  | 'SOURCE_ERROR';

export type DesignRequestError = {
  code: DesignRequestErrorCode;
  message: string;
  /** Preserve a source/RPC code without making it part of the shared code set. */
  sourceCode?: string;
};

export type Result<T, E = DesignRequestError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type DesignRequestCapabilities = {
  start: boolean;
  deliver: boolean;
  reopen: boolean;
  /** Reading completed files and pending-upload metadata are separate grants. */
  fileAccess: Partial<Record<DesignUploadKind, DesignRequestFileAccess>>;
  uploads: Partial<Record<DesignUploadKind, DesignUploadCapability>>;
};

export type DesignUploadKind = 'BRIEF' | 'DELIVERABLE' | 'REFERENCE';

export type DesignUploadCapability = {
  reserve: boolean;
  finalize: boolean;
  resumable: boolean;
  cancellable: boolean;
  maxFiles?: number;
  maxBytes?: number;
  acceptedMimeTypes?: readonly string[];
};

export type DesignRequestFileAccess = {
  readCompletedFiles: boolean;
  readPendingUploads: boolean;
};

export type DesignUploadInput = {
  fileName: string;
  size: number;
  /** A hint only; the source remains responsible for validating/deriving MIME. */
  mimeType?: string;
};

export type DesignUploadReservation = {
  uploadId: string;
  fileName: string;
  mimeType: string;
  size: number;
  /** Short-lived client upload URL/session, never a service credential. */
  transfer: { url: string; resumable: boolean; expiresAt: string | null };
};

export type DesignRequestFile = {
  id: string;
  kind: DesignUploadKind;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  url: string | null;
  createdAt: string | null;
};

export type DesignUploadStatus =
  | 'RESERVING'
  | 'UPLOADING'
  | 'COMPLETE'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'CANCEL_PENDING';

/** Metadata for an upload reservation/session; it does not expose its URI. */
export type DesignPendingUpload = {
  id: string;
  kind: DesignUploadKind;
  fileName: string;
  mimeType: string;
  size: number;
  status: DesignUploadStatus;
  sourceStatus?: string | null;
  expiresAt: string | null;
};

export type DesignRequestDeliveryEligibility = {
  eligible: boolean;
  reason: DesignRequestError | null;
};

export type DesignRequestOperationArguments<TRequest, TInput> = [TInput] extends [never]
  ? [request: TRequest, actor: DesignActor]
  : [request: TRequest, actor: DesignActor, input: TInput];

export type DesignUploadFinalizeInput = { uploadId: string };

export type DesignRequestUploadOperations<
  TSource extends DesignSource,
  TReserveInput = DesignUploadInput,
  TFinalizeInput = DesignUploadFinalizeInput,
> = {
  supportedKinds: readonly DesignUploadKind[];
  reserveUpload(
    kind: DesignUploadKind,
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
    input: TReserveInput,
  ): Promise<Result<DesignUploadReservation>>;
  finalizeUpload(
    kind: DesignUploadKind,
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
    input: TFinalizeInput,
  ): Promise<Result<DesignRequestFile>>;
  resumeUpload?(
    kind: DesignUploadKind,
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
    uploadId: string,
  ): Promise<Result<DesignUploadReservation>>;
  cancelUpload?(
    kind: DesignUploadKind,
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
    uploadId: string,
  ): Promise<Result<void>>;
  listFiles?(
    kind: DesignUploadKind,
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
  ): Promise<Result<readonly DesignRequestFile[]>>;
  listPendingUploads?(
    kind: DesignUploadKind,
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
  ): Promise<Result<readonly DesignPendingUpload[]>>;
};

/**
 * Source contract only. It contains no persistence, authorization, or provider
 * implementation; each adapter remains responsible for its own invariants.
 */
export interface DesignRequestSource<
  TSource extends DesignSource = DesignSource,
  TSourceFilters extends object = Record<never, never>,
  TStartInput = never,
  TDeliverInput = never,
  TReopenInput = never,
  TReserveUploadInput = DesignUploadInput,
  TFinalizeUploadInput = DesignUploadFinalizeInput,
> {
  readonly source: TSource;
  list(
    filters: DesignRequestListFilters<TSourceFilters>,
    actor: DesignActor,
  ): Promise<Result<readonly DesignRequestModel<TSource>[]>>;
  getDetail(id: string, actor: DesignActor): Promise<Result<DesignRequestDetailModel<TSource>>>;
  capabilities(
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
  ): Promise<Result<DesignRequestCapabilities>>;
  start?: (...args: DesignRequestOperationArguments<DesignRequestModel<TSource>, TStartInput>) => Promise<Result<void>>;
  deliver?: (...args: DesignRequestOperationArguments<DesignRequestModel<TSource>, TDeliverInput>) => Promise<Result<void>>;
  reopen?: (...args: DesignRequestOperationArguments<DesignRequestModel<TSource>, TReopenInput>) => Promise<Result<void>>;
  deliverEligibility?(
    request: DesignRequestModel<TSource>,
    actor: DesignActor,
  ): Promise<Result<DesignRequestDeliveryEligibility>>;
  uploads?: DesignRequestUploadOperations<TSource, TReserveUploadInput, TFinalizeUploadInput>;
}

/** Source-specific generic arguments retained by the mapped registry. */
export type DesignRequestSourceTypeOptions = {
  filters: object;
  startInput: unknown;
  deliverInput: unknown;
  reopenInput: unknown;
  reserveUploadInput: unknown;
  finalizeUploadInput: unknown;
};

/**
 * Heterogeneous registry that preserves each key's source, model, filters,
 * and operation inputs. Use a mapped type instead of widening every source to
 * `DesignRequestSource<DesignSource>`.
 */
export type DesignRequestSourceRegistry<
  TOptions extends { [S in DesignSource]: DesignRequestSourceTypeOptions },
> = {
  [S in DesignSource]: DesignRequestSource<
    S,
    TOptions[S]['filters'],
    TOptions[S]['startInput'],
    TOptions[S]['deliverInput'],
    TOptions[S]['reopenInput'],
    TOptions[S]['reserveUploadInput'],
    TOptions[S]['finalizeUploadInput']
  >;
};
