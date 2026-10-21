'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, UploadCloud } from 'lucide-react';
import { cancelEventBriefUploadAction, finishEventBriefUploadAction, listEventBriefFilesForRequesterAction, resumeEventBriefUploadAction, startEventBriefUploadAction } from '@/app/actions/events/drive';
import { uploadFile } from '@/lib/driveResumableUpload';

type BriefFile = { id: string; name: string; mimeType: string; size: number; webViewLink: string | null };
type Pending = { id: string; name: string; mimeType: string; size: number };

export function EventBriefUploader({ eventId, enabled, initialCount }: { eventId: string; enabled: boolean; initialCount: number }) {
  const [files, setFiles] = useState<BriefFile[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [controller, setController] = useState<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const result = await listEventBriefFilesForRequesterAction(eventId);
    if (!result.success) { setError(result.error ?? 'No se pudo consultar el brief.'); return; }
    setFiles(result.files as BriefFile[]); setPending(result.pendingUploads); setFolderUrl(result.folderUrl ?? '');
  }, [eventId]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);

  async function transfer(file: File, resume?: Pending): Promise<boolean> {
    setBusy(true); setError(''); setProgress(0);
    const abort = new AbortController(); setController(abort);
    try {
      let uploadId: string; let sessionUri: string; let mimeType: string;
      if (resume) {
        if (resume.name !== file.name || resume.size !== file.size) throw new Error('Selecciona el mismo archivo y tamaño para reanudar.');
        const session = await resumeEventBriefUploadAction(resume.id);
        if (!session.success) throw new Error(session.error);
        uploadId = resume.id; sessionUri = session.data.sessionUri; mimeType = session.data.mimeType;
        await uploadFile(file, sessionUri, mimeType, abort.signal, setProgress, true);
      } else {
        const started = await startEventBriefUploadAction({ id: eventId, name: file.name, size: file.size });
        if (!started.success) throw new Error(started.error);
        uploadId = started.uploadId; sessionUri = started.sessionUri; mimeType = started.mimeType;
        await uploadFile(file, sessionUri, mimeType, abort.signal, setProgress);
      }
      const done = await finishEventBriefUploadAction(uploadId);
      if (!done.success) throw new Error(done.error);
      setProgress(100); await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el brief.');
      await refresh();
      return false;
    } finally { setBusy(false); setController(null); }
  }

  async function uploadMany(selected: File[]) {
    if (files.length + pending.length + selected.length > 10) { setError('El brief admite hasta 10 archivos.'); return; }
    if (selected.some((file) => file.size > 100 * 1024 * 1024)) { setError('Cada archivo puede pesar hasta 100 MB.'); return; }
    for (const file of selected) if (!await transfer(file)) break;
  }

  async function cancel(id: string) {
    const result = await cancelEventBriefUploadAction(id);
    if (!result.success) setError(result.error); else await refresh();
  }

  return <div className="space-y-2 rounded-lg border border-blue-100 bg-white p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Brief · {files.length || initialCount} archivos</p>{folderUrl && <a href={folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Abrir carpeta <ExternalLink size={13}/></a>}</div>
    {enabled && <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"><UploadCloud size={16}/>Subir brief<input className="sr-only" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4" disabled={busy || files.length + pending.length >= 10} onChange={(event) => { const selected = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; if (selected.length) void uploadMany(selected); }}/></label>}
    {enabled && <p className="text-xs text-slate-500">Opcional · hasta 10 archivos, 100 MB cada uno. JPG, PNG, WebP, PDF o MP4.</p>}
    {pending.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">Carga pausada: {item.name}</span><label className="cursor-pointer font-semibold text-blue-700 underline">Reanudar<input type="file" className="sr-only" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void transfer(file, item); }}/></label><button type="button" disabled={busy} onClick={() => void cancel(item.id)} className="font-semibold text-red-700">Cancelar</button></div>)}
    {progress !== null && <div role="status" className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded bg-blue-100"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }}/></div><span className="text-xs text-slate-500">{progress}%</span>{controller && <button type="button" onClick={() => controller.abort()} className="text-xs font-semibold text-red-700">Detener</button>}</div>}
    {files.map((file) => <p key={file.id} className="flex items-center gap-2 truncate text-xs">{file.webViewLink ? <a className="truncate text-blue-700 underline" href={file.webViewLink} target="_blank" rel="noreferrer">{file.name}</a> : <span className="truncate">{file.name}</span>}<FileText size={13} className="shrink-0 text-slate-400"/></p>)}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
