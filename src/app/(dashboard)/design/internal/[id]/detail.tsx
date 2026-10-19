'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deliverInternalDesignWorkAction, finishInternalDeliverableUploadAction, getInternalDesignFilesAction, startInternalDesignWorkAction, startInternalDeliverableUploadAction } from '@/app/actions/internal/design-work';
import type { InternalDesignRequest } from '@/lib/internalTasks';

type DriveFile = { id: string; name: string; webViewLink: string | null; size: number };

async function sendFile(file: File, uri: string) {
  const chunkSize = 8 * 1024 * 1024;
  for (let offset = 0; offset < file.size;) {
    const end = Math.min(offset + chunkSize, file.size);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open('PUT', uri);
      xhr.setRequestHeader('Content-Type', file.type); xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`);
      xhr.onload = () => { if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 308) { offset = end; resolve(); } else reject(new Error(`Drive respondió ${xhr.status}.`)); };
      xhr.onerror = () => reject(new Error('No se pudo conectar con Drive.'));
      xhr.send(file.slice(offset, end));
    });
  }
}

export function InternalDesignDetail({ request, initialFiles, canStart, canUpload, canDeliver }: { request: InternalDesignRequest; initialFiles: { briefFiles: DriveFile[]; deliverableFiles: DriveFile[] } | null; canStart: boolean; canUpload: boolean; canDeliver: boolean }) {
  const router = useRouter();
  const [briefFiles, setBriefFiles] = useState<DriveFile[]>(initialFiles?.briefFiles ?? []);
  const [deliverableFiles, setDeliverableFiles] = useState<DriveFile[]>(initialFiles?.deliverableFiles ?? []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadFiles() {
    const result = await getInternalDesignFilesAction(request.id);
    if (result.success) { setBriefFiles(result.briefFiles as DriveFile[]); setDeliverableFiles(result.deliverableFiles as DriveFile[]); }
    else setMessage(result.error ?? 'No se pudieron cargar los archivos.');
  }
  async function start() {
    setBusy(true); const result = await startInternalDesignWorkAction(request.id);
    setMessage(result.success ? 'Solicitud tomada.' : result.error ?? 'No se pudo tomar la solicitud.'); setBusy(false);
    if (result.success) router.refresh();
  }
  async function upload(file: File | undefined) {
    if (!file) return; setBusy(true); setMessage('Preparando carga…');
    const startResult = await startInternalDeliverableUploadAction({ id: request.id, name: file.name, mimeType: file.type, size: file.size });
    if (!startResult.success) { setMessage(startResult.error ?? 'No se pudo iniciar la carga.'); setBusy(false); return; }
    try {
      await sendFile(file, startResult.sessionUri);
      const result = await finishInternalDeliverableUploadAction(startResult.uploadId);
      if (!result.success) throw new Error(result.error ?? 'No se pudo confirmar el archivo.');
      setMessage('Entregable guardado.'); await loadFiles();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo subir el entregable.'); }
    setBusy(false);
  }
  async function deliver() {
    setBusy(true); const result = await deliverInternalDesignWorkAction(request.id);
    setMessage(result.success ? 'Entrega registrada.' : result.error ?? 'No se pudo entregar.'); setBusy(false);
    if (result.success) router.refresh();
  }

  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
    <Link href="/design/internal" className="text-sm font-semibold text-[#0066D2] underline">← Volver a Pendientes del Interno</Link>
    <header><p className="text-xs font-bold uppercase tracking-[.12em] text-[#0066D2]">{request.sede_nombre} · {request.tipo}</p><h1 className="mt-1 text-2xl font-extrabold text-[#10233F]">{request.titulo}</h1><p className="mt-2 text-sm text-[#566274]">Entrega solicitada: {request.fecha_entrega_diseno}{request.cantidad ? ` · Cantidad: ${request.cantidad}` : ''}</p></header>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-bold text-[#10233F]">Instrucciones</h2><p className="mt-2 whitespace-pre-wrap text-sm text-[#39475a]">{request.instrucciones_diseno}</p></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-bold text-[#10233F]">Brief</h2>{briefFiles.length ? <ul className="mt-2 space-y-1">{briefFiles.map((file) => <li key={file.id}><a className="text-sm text-[#0066D2] underline" href={file.webViewLink ?? '#'} target="_blank" rel="noreferrer">{file.name}</a></li>)}</ul> : <p className="mt-2 text-sm text-[#566274]">No hay archivos de brief disponibles.</p>}</section>
    <section className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-[#10233F]">Entregables</h2><p className="mt-1 text-sm text-[#566274]">Estado: {request.diseno_estatus}</p></div>
      {request.diseno_estatus === 'SOLICITADO' && canStart && <button disabled={busy} onClick={() => void start()} className="rounded-lg bg-[#073b78] px-4 py-2 text-sm font-bold text-white">Tomar solicitud</button>}
      {request.diseno_estatus === 'EN_DISENO' && canUpload && <label className="cursor-pointer rounded-lg bg-[#0066D2] px-4 py-2 text-sm font-bold text-white">Subir entregable<input type="file" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>}
    </div>
    {deliverableFiles.length > 0 && <ul className="mt-3 space-y-1">{deliverableFiles.map((file) => <li key={file.id}><a className="text-sm text-[#0066D2] underline" href={file.webViewLink ?? '#'} target="_blank" rel="noreferrer">{file.name}</a></li>)}</ul>}
    {request.diseno_estatus === 'EN_DISENO' && canDeliver && <button disabled={busy} onClick={() => void deliver()} className="mt-4 rounded-lg bg-[#073b78] px-4 py-2 text-sm font-bold text-white">Entregar a Interno</button>}
    {message && <p role="status" className="mt-3 text-sm text-[#566274]">{message}</p>}</section>
  </main>;
}
