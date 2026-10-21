'use client';

import { useState } from 'react';
import { finishInternalBriefUploadAction, listInternalBriefFilesAction, requestInternalDesignAction, retractInternalDesignAction, startInternalBriefUploadAction } from '@/app/actions/internal/drive';
import type { StoreTaskRow } from '@/lib/internalTasks';
import { uploadFile } from '@/lib/driveResumableUpload';

type FileRow = { id: string; name: string; mimeType: string; size: number; webViewLink: string | null };

export function TaskBriefPanel({ task, onChange }: { task: StoreTaskRow; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [deliverables, setDeliverables] = useState<FileRow[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [deliverablesUrl, setDeliverablesUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true); setMessage('');
    const result = await listInternalBriefFilesAction(task.id);
    if (result.success) {
      setFiles(result.files as FileRow[]); setDeliverables(result.deliverables as FileRow[]);
      setFolderUrl(result.folderUrl); setDeliverablesUrl(result.deliverablesUrl);
    }
    else setMessage(result.error ?? 'No se pudo consultar el brief.');
    setBusy(false);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage('Preparando carga…');
    const start = await startInternalBriefUploadAction({ taskId: task.id, name: file.name, mimeType: file.type, size: file.size });
    if (!start.success) { setMessage(start.error ?? 'No se pudo iniciar la carga.'); setBusy(false); return; }
    try {
      await uploadFile(file, start.sessionUri, file.type || 'application/octet-stream', new AbortController().signal, () => undefined);
      const done = await finishInternalBriefUploadAction(start.uploadId);
      if (!done.success) throw new Error(done.error ?? 'No se pudo confirmar el archivo.');
      setMessage('Archivo guardado en Drive.');
      await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo subir el archivo.'); }
    setBusy(false);
  }

  async function requestDesign() {
    setBusy(true); setMessage('Verificando requisitos y brief en Drive…');
    const result = await requestInternalDesignAction(task.id);
    setMessage(result.success ? 'Solicitud enviada a Design.' : result.error ?? 'No se pudo solicitar a Design.');
    setBusy(false);
    if (result.success) onChange();
  }

  async function retractDesign() {
    setBusy(true); setMessage('Retirando solicitud…');
    const result = await retractInternalDesignAction({ taskId: task.id });
    setMessage(result.success ? 'Solicitud retirada; el pendiente volvió a Pendiente.' : result.error ?? 'No se pudo retirar la solicitud.');
    setBusy(false);
    if (result.success) onChange();
  }

  return <div className="mt-3 rounded-lg border border-[#dce2ea] bg-[#fafbfd] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-semibold">Brief en Drive</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(!open); if (!open) void load(); }} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">{open ? 'Cerrar' : 'Ver / subir brief'}</button>
        {folderUrl && <a className="px-2 py-1.5 text-xs font-semibold text-[#0066D2] underline" href={folderUrl} target="_blank" rel="noreferrer">Abrir Drive</a>}
      </div>
    </div>
    {open && <div className="mt-3 space-y-2">
      {message && <p role="status" className="text-xs text-[#566274]">{message}</p>}
      <label className="inline-flex cursor-pointer items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold ring-1 ring-[#cbd3df]">Subir archivo<input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
      <p className="text-xs text-[#566274]">Hasta 10 archivos, 100 MB cada uno. JPG, PNG, WebP, PDF o MP4. Disponible aunque el pendiente no requiera diseño.</p>
      {files.length > 0 && <ul className="space-y-1">{files.map((file) => <li key={file.id} className="text-sm"><a className="text-[#0066D2] underline" href={file.webViewLink ?? '#'} target="_blank" rel="noreferrer">{file.name}</a> <span className="text-xs text-[#566274]">({(file.size / 1048576).toFixed(1)} MB)</span></li>)}</ul>}
      {task.diseno_estatus === 'ENTREGADO' && <section className="mt-4 border-t border-slate-200 pt-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Entregables de Design</h3>{deliverablesUrl && <a className="text-xs font-semibold text-[#0066D2] underline" href={deliverablesUrl} target="_blank" rel="noreferrer">Abrir Drive</a>}</div>{deliverables.length ? <ul className="mt-2 space-y-1">{deliverables.map((file) => <li key={file.id} className="text-sm"><a className="text-[#0066D2] underline" href={file.webViewLink ?? '#'} target="_blank" rel="noreferrer">{file.name}</a> <span className="text-xs text-[#566274]">({(file.size / 1048576).toFixed(1)} MB)</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No se encontraron archivos en la carpeta Entregables.</p>}</section>}
      {!busy && open && <button type="button" className="text-xs font-semibold text-[#0066D2] underline" onClick={() => void load()}>Actualizar lista</button>}
    </div>}
    {task.requiere_diseno && task.estatus === 'PENDIENTE' && task.diseno_estatus !== 'SOLICITADO' && <button type="button" disabled={busy} onClick={() => void requestDesign()} className="mt-3 rounded-lg bg-[#0066D2] px-3 py-2 text-xs font-bold text-white">Solicitar a Design</button>}
    {task.diseno_estatus === 'SOLICITADO' && <button type="button" disabled={busy} onClick={() => void retractDesign()} className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold">Retirar solicitud</button>}
  </div>;
}
