'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Loader2, RefreshCw, UploadCloud, XCircle } from 'lucide-react';
import {
  cancelPublicacionBriefUploadAction,
  finishPublicacionBriefUploadAction,
  listPublicacionBriefFilesAction,
  resumePublicacionBriefUploadAction,
  startPublicacionBriefUploadAction,
} from '@/app/actions/publicaciones/drive';
import type { DriveBriefFile } from '@/lib/googleDrive';

type UploadStatus = 'preparing' | 'uploading' | 'confirming' | 'complete' | 'interrupted' | 'error' | 'cancelled';
type UploadRow = {
  key: string;
  name: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  uploadId?: string;
  sessionUri?: string;
  file?: File;
  mimeType?: string;
  size?: number;
};

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.mp4';
const mimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4',
};
const statusLabels: Record<UploadStatus, string> = {
  preparing: 'Preparando carga…', uploading: 'Subiendo a Drive…', confirming: 'Confirmando en Drive…',
  complete: 'Completado', interrupted: 'Carga interrumpida', error: 'No se pudo completar', cancelled: 'Carga cancelada',
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function formatDate(value: string) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-VE', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas',
  }).format(date);
}

async function queryResumeOffset(uri: string, size: number) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uri);
    xhr.setRequestHeader('Content-Range', 'bytes */' + size);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) { resolve(size); return; }
      if (xhr.status !== 308) { reject(new Error('Drive respondió ' + xhr.status + ' al consultar la sesión.')); return; }
      const match = xhr.getResponseHeader('Range')?.match(/bytes=0-(\d+)/);
      resolve(match ? Number(match[1]) + 1 : 0);
    };
    xhr.onerror = () => reject(new Error('No se pudo consultar el estado de la sesión resumible.'));
    xhr.send();
  });
}

async function uploadResumable(file: File, uri: string, onProgress: (percent: number) => void, signal: AbortSignal, resume = false) {
  const chunkSize = 8 * 1024 * 1024;
  let offset = resume ? await queryResumeOffset(uri, file.size) : 0;
  if (offset >= file.size) return;
  while (offset < file.size) {
    if (signal.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    const end = Math.min(offset + chunkSize, file.size);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      signal.addEventListener('abort', abort, { once: true });
      xhr.open('PUT', uri);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('Content-Range', 'bytes ' + offset + '-' + (end - 1) + '/' + file.size);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.min(99, Math.round(((offset + event.loaded) / file.size) * 100)));
      };
      xhr.onload = () => {
        signal.removeEventListener('abort', abort);
        if (xhr.status >= 200 && xhr.status < 300) { offset = end; resolve(); }
        else reject(new Error('Drive respondió ' + xhr.status + '.'));
      };
      xhr.onerror = () => {
        signal.removeEventListener('abort', abort);
        reject(new Error('El navegador no pudo conectar con Drive. Comprueba CORS del dominio de la aplicación.'));
      };
      xhr.onabort = () => {
        signal.removeEventListener('abort', abort);
        reject(new DOMException('Carga cancelada', 'AbortError'));
      };
      xhr.send(file.slice(offset, end));
    });
    onProgress(Math.min(99, Math.round((offset / file.size) * 100)));
  }
}

export function PublicationDriveFiles({
  publicationId, canUpload = true, title, designRequired = true, showFolderLink = true, onBriefState,
}: {
  publicationId: string; canUpload?: boolean; title?: string; designRequired?: boolean;
  showFolderLink?: boolean; onBriefState?: (count: number, checkedAt: string) => void;
}) {
  const heading = title ?? (designRequired ? 'Archivos del brief' : 'Material de apoyo (opcional)');
  const [files, setFiles] = useState<DriveBriefFile[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [refresh, setRefresh] = useState(0);
  const controllers = useRef(new Map<string, AbortController>());
  const sequence = useRef(0);
  const onBriefStateRef = useRef(onBriefState);

  useEffect(() => { onBriefStateRef.current = onBriefState; }, [onBriefState]);

  const updateUpload = (key: string, patch: Partial<UploadRow>) => {
    setUploads((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row));
  };
  const makeLocalKey = () => {
    sequence.current += 1;
    return 'upload-' + sequence.current;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPublicacionBriefFilesAction(publicationId);
      if (!result.success) { setError(result.error || 'No se pudo cargar la lista de Drive.'); return; }
      setFiles(result.data.files);
      setCount(result.data.count);
      setFolderUrl(result.data.folderUrl);
      onBriefStateRef.current?.(result.data.count, result.data.checkedAt);
      setUploads((current) => {
        const knownIds = new Set(current.map((row) => row.uploadId).filter((id): id is string => Boolean(id)));
        const pendingRows = result.data.pendingUploads
          .filter((item: { id: string }) => !knownIds.has(item.id))
          .map((item: { id: string; name: string; mimeType: string; size: number }) => ({
            key: item.id, name: item.name, progress: 0, status: 'interrupted' as const,
            error: 'Selecciona el mismo archivo para reanudar la carga.', uploadId: item.id,
            mimeType: item.mimeType, size: Number(item.size),
          }));
        return [...current, ...pendingRows];
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista de Drive.');
    } finally {
      setLoading(false);
    }
  }, [publicationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, refresh]);

  const resumeUpload = async (rowKey: string, override?: UploadRow) => {
    const row = override ?? uploads.find((item) => item.key === rowKey);
    if (!row?.uploadId || !row.sessionUri || !row.file) return;
    const controller = new AbortController();
    controllers.current.set(row.uploadId, controller);
    updateUpload(rowKey, { status: 'uploading', error: undefined });
    try {
      await uploadResumable(row.file, row.sessionUri,
        (progress) => updateUpload(rowKey, { progress, status: 'uploading' }), controller.signal, true);
      updateUpload(rowKey, { status: 'confirming', error: undefined });
      const finished = await finishPublicacionBriefUploadAction(row.uploadId);
      if (!finished.success) throw new Error(finished.error);
      updateUpload(rowKey, { progress: 100, status: 'complete', error: undefined, uploadId: undefined, sessionUri: undefined, file: undefined });
      await load();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        const cancelled = await cancelPublicacionBriefUploadAction(row.uploadId);
        if (cancelled.success) {
          updateUpload(rowKey, { status: cancelled.completed ? 'complete' : 'cancelled', progress: cancelled.completed ? 100 : row.progress,
            error: undefined, uploadId: undefined, sessionUri: undefined, file: undefined });
          if (cancelled.completed) await load();
          return;
        }
        updateUpload(rowKey, { status: 'interrupted', error: cancelled.error || 'No se pudo cancelar la carga.' });
        return;
      }
      updateUpload(rowKey, { status: 'error', error: cause instanceof Error ? cause.message : 'Falló la carga.' });
    } finally {
      controllers.current.delete(row.uploadId);
    }
  };

  const resumeAfterReselect = async (rowKey: string, file: File) => {
    const row = uploads.find((item) => item.key === rowKey);
    if (!row?.uploadId) return;
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const mime = file.type || mimeByExtension[extension];
    if (file.name !== row.name || file.size !== row.size || mime !== row.mimeType) {
      updateUpload(rowKey, { status: 'interrupted', error: 'Selecciona el mismo archivo, con igual nombre, tamaño y tipo.' });
      return;
    }
    try {
      const result = await resumePublicacionBriefUploadAction(row.uploadId);
      if (!result.success) {
        updateUpload(rowKey, { status: 'interrupted', error: result.error || 'No se pudo reanudar la carga.' });
        return;
      }
      const resumable = { ...row, file, sessionUri: result.data.sessionUri, status: 'uploading' as const, error: undefined };
      updateUpload(rowKey, resumable);
      await resumeUpload(rowKey, resumable);
    } catch (cause) {
      updateUpload(rowKey, { status: 'interrupted', error: cause instanceof Error ? cause.message : 'No se pudo reanudar la carga.' });
    }
  };

  const cancelUpload = async (row: UploadRow) => {
    if (!row.uploadId) return;
    const controller = controllers.current.get(row.uploadId);
    if (controller) { controller.abort(); return; }
    try {
      const result = await cancelPublicacionBriefUploadAction(row.uploadId);
      if (result.success) {
        updateUpload(row.key, { status: result.completed ? 'complete' : 'cancelled', progress: result.completed ? 100 : row.progress,
          error: undefined, uploadId: undefined, sessionUri: undefined, file: undefined });
        if (result.completed) await load();
      } else updateUpload(row.key, { status: 'error', error: result.error });
    } catch (cause) {
      updateUpload(row.key, { status: 'error', error: cause instanceof Error ? cause.message : 'No se pudo cancelar la carga.' });
    }
  };

  const onChooseFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setPending(true);
    setError('');
    for (const file of Array.from(list)) {
      const key = makeLocalKey();
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const mime = file.type || mimeByExtension[extension];
      setUploads((rows) => [...rows, { key, name: file.name, progress: 0, status: 'preparing', file, mimeType: mime, size: file.size }]);
      if (mimeByExtension[extension] !== mime) {
        updateUpload(key, { status: 'error', error: 'Tipo de archivo no permitido.', file: undefined });
        continue;
      }
      try {
        const started = await startPublicacionBriefUploadAction({ publicationId, name: file.name, mimeType: mime, size: file.size });
        if (!started.success) { updateUpload(key, { status: 'error', error: started.error, file: undefined }); continue; }
        updateUpload(key, { uploadId: started.data.uploadId, sessionUri: started.data.sessionUri, status: 'uploading' });
        const controller = new AbortController();
        controllers.current.set(started.data.uploadId, controller);
        try {
          await uploadResumable(file, started.data.sessionUri,
            (progress) => updateUpload(key, { progress, status: 'uploading' }), controller.signal);
          updateUpload(key, { status: 'confirming' });
          const finished = await finishPublicacionBriefUploadAction(started.data.uploadId);
          if (!finished.success) throw new Error(finished.error);
          updateUpload(key, { progress: 100, status: 'complete', error: undefined, uploadId: undefined, sessionUri: undefined, file: undefined });
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            const cancelled = await cancelPublicacionBriefUploadAction(started.data.uploadId);
            if (cancelled.success) {
              updateUpload(key, { status: cancelled.completed ? 'complete' : 'cancelled', progress: cancelled.completed ? 100 : 0,
                error: undefined, uploadId: undefined, sessionUri: undefined, file: undefined });
            } else updateUpload(key, { status: 'interrupted', error: cancelled.error || 'No se pudo cancelar la carga.' });
          } else updateUpload(key, { status: 'error', error: cause instanceof Error ? cause.message : 'Falló la carga.' });
        } finally {
          controllers.current.delete(started.data.uploadId);
        }
      } catch (cause) {
        updateUpload(key, { status: 'error', error: cause instanceof Error ? cause.message : 'No se pudo iniciar la carga.', file: undefined });
      }
    }
    setPending(false);
    setRefresh((value) => value + 1);
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={heading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{heading}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{count}/10 archivos · JPG, PNG, WebP, PDF o MP4 · hasta 100 MB c/u</p>
        </div>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} aria-label="Actualizar lista"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {canUpload && count < 10 && (
        <label className={'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-800 ' + (pending ? 'pointer-events-none opacity-60' : '')}>
          <UploadCloud size={18} />{pending ? 'Subiendo archivos…' : 'Seleccionar archivos'}
          <input type="file" accept={ACCEPT} multiple hidden disabled={pending}
            onChange={(event) => { void onChooseFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
        </label>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</p>}
      {uploads.map((upload) => {
        const isActive = upload.status === 'preparing' || upload.status === 'uploading' || upload.status === 'confirming';
        const isFailure = upload.status === 'error' || upload.status === 'interrupted';
        const isComplete = upload.status === 'complete';
        return (
          <div key={upload.key} className="rounded-lg bg-slate-50 p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block truncate font-medium text-slate-800">{upload.name}</span>
                <span className={'mt-0.5 block ' + (isFailure ? 'text-red-700' : isComplete ? 'text-emerald-700' : 'text-slate-600')}>{statusLabels[upload.status]}</span>
                {upload.error && <span role="alert" className="mt-1 block text-red-700">{upload.error}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isComplete ? <CheckCircle2 size={16} className="text-emerald-600" /> :
                  upload.status === 'cancelled' ? <XCircle size={16} className="text-slate-400" /> :
                  isActive ? <span className="text-slate-500">{upload.status === 'confirming' ? '99%' : upload.progress + '%'}</span> : null}
                {upload.uploadId && isFailure && upload.file && <button type="button" onClick={() => void resumeUpload(upload.key)} className="font-semibold text-blue-700 underline">Reanudar</button>}
                {upload.uploadId && isFailure && !upload.file && (
                  <label className="cursor-pointer font-semibold text-blue-700 underline">
                    Seleccionar para reanudar
                    <input type="file" accept={ACCEPT} hidden onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void resumeAfterReselect(upload.key, file);
                      event.currentTarget.value = '';
                    }} />
                  </label>
                )}
                {upload.uploadId && <button type="button" onClick={() => void cancelUpload(upload)} className="font-semibold text-slate-600 underline">Cancelar</button>}
              </div>
            </div>
            {isActive && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-700 transition-all" style={{ width: (upload.status === 'confirming' ? 99 : upload.progress) + '%' }} />
            </div>}
          </div>
        );
      })}
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Consultando Drive…</p>
      ) : files.length ? (
        <ul className="divide-y divide-slate-100">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <FileText size={16} className="shrink-0 text-slate-500" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800">{file.name}</span>
                  <span className="text-[10px] text-slate-500">{formatSize(file.size)} · {formatDate(file.createdTime)}</span>
                </span>
              </span>
              {file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700">Abrir <ExternalLink size={12} /></a>}
            </li>
          ))}
        </ul>
      ) : !error ? (
        <p className="text-xs text-slate-500">{designRequired ? 'Faltan archivos para enviar el brief a Design.' : 'Sin archivos. Es opcional: esta publicación no pasa por Design.'}</p>
      ) : null}
      {showFolderLink && folderUrl && <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">Ver carpeta en Drive <ExternalLink size={11} /></a>}
    </section>
  );
}
