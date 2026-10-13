'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CalendarDays, Check, ExternalLink, FileText, Loader2, UploadCloud } from 'lucide-react';
import type { Publicacion } from '@/types';
import type { DriveBriefFile } from '@/lib/googleDrive';
import { DRIVE_FILE_RULES, getDriveFileRule } from '@/lib/driveFileRules';
import { formatDesignDate, formatSocialPlatform, getDesignDueLabel, getDesignDueTone } from '@/lib/designSla';
import { listDesignPublicationDriveFilesAction, startDeliverableUploadAction, finishDeliverableUploadAction, cancelDeliverableUploadAction, resumeDeliverableUploadAction } from '@/app/actions/publicaciones/design-drive';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';

type Comment = { id: string; publicacion_id: string; texto: string; tipo: string; creado_en: string };
type StatusHistory = { estatus_anterior: string | null; estatus_nuevo: string; motivo: string | null; cambiado_en: string };
type FilesState = { briefFiles: DriveBriefFile[]; deliverableFiles: DriveBriefFile[]; briefUrl: string; deliverablesUrl: string; pendingUploads: { id: string; name: string; mimeType: string; size: number }[] };
type Upload = { id?: string; file?: File; name: string; size: number; mimeType: string; progress: number; error?: string; sessionUri?: string };

function prettySize(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`; }
function dateTime(value: string) { return new Intl.DateTimeFormat('es-VE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }).format(new Date(value)); }

async function getUploadOffset(uri: string, size: number) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uri);
    xhr.setRequestHeader('Content-Range', `bytes */${size}`);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) return resolve(size);
      if (xhr.status !== 308) return reject(new Error(`Drive respondió ${xhr.status} al reanudar.`));
      const match = xhr.getResponseHeader('Range')?.match(/bytes=0-(\d+)/);
      resolve(match ? Number(match[1]) + 1 : 0);
    };
    xhr.onerror = () => reject(new Error('No se pudo consultar la sesión de Drive.'));
    xhr.send();
  });
}

async function uploadFile(file: File, uri: string, mime: string, signal: AbortSignal, onProgress: (value: number) => void, resume = false) {
  const chunk = 8 * 1024 * 1024;
  let offset = resume ? await getUploadOffset(uri, file.size) : 0;
  while (offset < file.size) {
    if (signal.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    const end = Math.min(offset + chunk, file.size);
    try {
      const acceptedOffset = await new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        signal.addEventListener('abort', abort, { once: true });
        xhr.open('PUT', uri);
        xhr.setRequestHeader('Content-Type', mime);
        xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`);
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(99, Math.round((offset + event.loaded) / file.size * 100))); };
        xhr.onload = () => {
          signal.removeEventListener('abort', abort);
          if (xhr.status === 200 || xhr.status === 201) return resolve(file.size);
          if (xhr.status === 308) {
            const match = xhr.getResponseHeader('Range')?.match(/bytes=0-(\d+)/);
            if (!match) return reject(new Error('Drive no confirmó el rango recibido.'));
            return resolve(Math.min(file.size, Number(match[1]) + 1));
          }
          reject(new Error(`Drive respondió ${xhr.status}.`));
        };
        xhr.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('No se pudo conectar con Drive. Revisa CORS del dominio.')); };
        xhr.onabort = () => { signal.removeEventListener('abort', abort); reject(new DOMException('Carga cancelada', 'AbortError')); };
        xhr.send(file.slice(offset, end));
      });
      offset = acceptedOffset;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      // Una respuesta de red puede perderse después de que Drive haya guardado el fragmento.
      const confirmedOffset = await getUploadOffset(uri, file.size).catch(() => offset);
      if (confirmedOffset <= offset) throw cause;
      offset = confirmedOffset;
    }
    onProgress(Math.min(99, Math.round(offset / file.size * 100)));
  }
}

function FileRow({ file }: { file: DriveBriefFile }) {
  const image = file.mimeType.startsWith('image/') && file.thumbnailLink;
  return <li className="flex min-h-12 items-center gap-3 border-t border-[#F0EDE6] py-2">
    {image ? <Image src={file.thumbnailLink!} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-md object-cover"/> : <FileText size={18} className="shrink-0 text-[#5E6680]"/>}
    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#10233F]">{file.name}</span>
    <span className="shrink-0 text-xs text-[#5E6680]">{prettySize(file.size)}</span>
    {file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${file.name} en Drive`} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-[#0066D2] hover:bg-[#E6F0FB]"><ExternalLink size={16}/></a>}
  </li>;
}

function DueBadge({ estimate, today }: { estimate: string | null; today: string }) {
  const tone = getDesignDueTone(estimate, today);
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone === 'late' ? 'bg-[#FDE8E6] text-[#A5281B]' : tone === 'soon' ? 'bg-[#FDEBD0] text-[#7A3E00]' : 'bg-[#F3F0E9] text-[#3C4663]'}`}>{getDesignDueLabel(estimate, today)}</span>;
}

export function DesignPublicationDetail({ publication, comments, designerName, channels, actorId, cycleStart, history, today }: { publication: Publicacion; comments: Comment[]; designerName: string | null; channels: string[]; actorId: string; cycleStart: string | null; history: StatusHistory[]; today: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<FilesState | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [fileError, setFileError] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState('');
  const controllers = useRef(new Map<string, AbortController>());
  const driveFiles = files?.deliverableFiles || [];
  const hasCurrentCycleFile = cycleStart ? driveFiles.some((file) => file.createdTime && new Date(file.createdTime) > new Date(cycleStart)) : driveFiles.length > 0;
  const currentStatus = publication.estatus;
  const isInDesign = currentStatus === 'EN_DISENO';
  const isCorrection = currentStatus === 'EN_CORRECCION';
  const correction = [...comments].filter((item) => item.tipo === 'CORRECCION').sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0];
  const remaining = Math.max(0, DRIVE_FILE_RULES.ENTREGABLES.maxFiles - driveFiles.length);

  const refreshFiles = useCallback(async () => {
    const result = await listDesignPublicationDriveFilesAction(publication.id);
    if (result.success) {
      setFiles(result.data);
      setFileError('');
      setUploads((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...result.data.pendingUploads.filter((item: FilesState['pendingUploads'][number]) => !seen.has(item.id)).map((item: FilesState['pendingUploads'][number]) => ({ ...item, progress: 0, error: 'Carga interrumpida. Selecciona el mismo archivo para reanudar.' }))];
      });
    } else setFileError(result.error || 'No se pudieron consultar los archivos.');
    setLoadingFiles(false);
  }, [publication.id]);

  useEffect(() => { void refreshFiles(); }, [refreshFiles]);

  const runUpload = async (upload: Upload, resumed = false) => {
    if (!upload.id || !upload.file || !upload.sessionUri) return;
    const controller = new AbortController();
    controllers.current.set(upload.id, controller);
    try {
      await uploadFile(upload.file, upload.sessionUri, upload.mimeType, controller.signal, (progress) => setUploads((rows) => rows.map((row) => row.id === upload.id ? { ...row, progress } : row)), resumed || !!upload.error);
      const finished = await finishDeliverableUploadAction(upload.id);
      if (!finished.success) throw new Error(finished.error);
      setUploads((rows) => rows.map((row) => row.id === upload.id ? { ...row, progress: 100, id: undefined, file: undefined, sessionUri: undefined, error: undefined } : row));
      await refreshFiles();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') await cancelDeliverableUploadAction(upload.id);
      else {
        // La transferencia pudo completarse aunque el navegador no recibiera su respuesta final.
        const confirmed = await finishDeliverableUploadAction(upload.id).catch(() => ({ success: false as const }));
        if (confirmed.success) {
          setUploads((rows) => rows.map((row) => row.id === upload.id ? { ...row, progress: 100, id: undefined, file: undefined, sessionUri: undefined, error: undefined } : row));
          await refreshFiles();
          return;
        }
      }
      setUploads((rows) => rows.map((row) => row.id === upload.id ? { ...row, error: cause instanceof Error ? cause.message : 'Falló la carga.' } : row));
    } finally { controllers.current.delete(upload.id); }
  };

  const begin = async (file: File) => {
    const rule = getDriveFileRule('ENTREGABLES', file.name);
    if (!rule) { setUploads((rows) => [...rows, { name: file.name, size: file.size, mimeType: '', progress: 0, error: 'Formato no permitido.' }]); return; }
    if (file.size > rule.maxBytes) { setUploads((rows) => [...rows, { name: file.name, size: file.size, mimeType: rule.mimeType, progress: 0, error: 'El máximo es 500 MB.' }]); return; }
    const started = await startDeliverableUploadAction({ publicationId: publication.id, name: file.name, size: file.size });
    if (!started.success) { setError(started.error || 'No se pudo iniciar la carga.'); return; }
    const upload: Upload = { id: started.data.uploadId, file, name: file.name, size: file.size, mimeType: started.data.mimeType, sessionUri: started.data.sessionUri, progress: 0 };
    setUploads((rows) => [...rows, upload]);
    await runUpload(upload);
  };

  const resume = async (index: number, file: File) => {
    const row = uploads[index];
    if (!row.id) return;
    if (file.name !== row.name || file.size !== row.size) { setUploads((rows) => rows.map((item, i) => i === index ? { ...item, error: 'Selecciona el mismo archivo y tamaño.' } : item)); return; }
    const session = await resumeDeliverableUploadAction(row.id);
    if (!session.success) { setUploads((rows) => rows.map((item, i) => i === index ? { ...item, error: session.error || 'No se pudo reanudar.' } : item)); return; }
    const updated = { ...row, file, sessionUri: session.data.sessionUri, error: undefined };
    setUploads((rows) => rows.map((item, i) => i === index ? updated : item));
    await runUpload(updated, true);
  };

  const onChoose = async (list: FileList | null) => {
    if (!list) return;
    setError('');
    for (const file of Array.from(list)) await begin(file);
  };

  const changeStatus = (status: 'EN_DISENO' | 'EN_REVISION_CM') => startTransition(async () => {
    setError('');
    setLoadingId(status);
    const result = await transitionPublicationAction({ publicationId: publication.id, status });
    if (!result.success) setError(result.error || 'No se pudo cambiar el estado.');
    else if (status === 'EN_REVISION_CM') router.push('/design/publications');
    else router.refresh();
    setLoadingId('');
  });

  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 pb-28 pt-5 text-[#10233F] sm:px-6 sm:pt-7 md:pb-10">
    <header className="space-y-4">
      <Link href="/design/publications" className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-[#0066D2] hover:text-[#002F80]"><ArrowLeft size={15}/>Solicitudes</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-[#10233F] sm:text-[28px]">{publication.titulo}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isCorrection ? 'bg-[#FDEBD0] text-[#7A3E00]' : 'bg-[#E0F4FD] text-[#05526F]'}`}>{isCorrection ? 'Devuelta con correcciones' : 'En diseño'}</span>
            <span className="inline-flex min-h-6 items-center rounded-full bg-[#F3F0E9] px-2.5 py-0.5 text-xs font-semibold text-[#3C4663]">{publication.formato}</span>
            {channels.map((channel) => <span key={channel} className="inline-flex min-h-6 items-center rounded-full bg-[#F3F0E9] px-2.5 py-0.5 text-xs font-semibold text-[#3C4663]">{formatSocialPlatform(channel)}</span>)}
            <span className="text-sm text-[#5E6680]">Tomada por <span className="font-semibold text-[#10233F]">{designerName || 'Diseño'}{publication.disenador_id === actorId ? ' (tú)' : ''}</span></span>
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 md:flex">
          {isInDesign ? <button type="button" disabled={pending || !hasCurrentCycleFile} onClick={() => changeStatus('EN_REVISION_CM')} className="min-h-11 rounded-lg border border-[#0066D2] bg-[#0066D2] px-5 text-sm font-semibold text-white hover:bg-[#002F80] disabled:cursor-not-allowed disabled:border-[#E7E4DC] disabled:bg-[#E7E4DC] disabled:text-[#5E6680]">{pending && loadingId === 'EN_REVISION_CM' ? 'Entregando…' : 'Entregar a revisión'}</button> : <button type="button" disabled={pending} onClick={() => changeStatus('EN_DISENO')} className="min-h-11 rounded-lg border border-[#0066D2] bg-[#0066D2] px-5 text-sm font-semibold text-white hover:bg-[#002F80] disabled:opacity-60">{pending ? 'Abriendo…' : 'Reabrir para corregir'}</button>}
          <span className="text-xs text-[#5E6680]">{isCorrection ? 'Al reabrir podrás cargar archivos nuevos.' : hasCurrentCycleFile ? 'La pieza está lista para revisión.' : 'Disponible cuando cargues un archivo nuevo.'}</span>
        </div>
      </div>
    </header>

    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    {isCorrection && <section aria-labelledby="correction-title" className="rounded-xl border border-[#F0C98A] bg-[#FFF6E8] px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3 text-[#7A3E00]"><AlertCircle size={19} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="correction-title" className="font-bold">Social Media pidió correcciones</h2>{correction && <time className="text-xs" dateTime={correction.creado_en}>{dateTime(correction.creado_en)}</time>}</div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#4A2A00]">{correction?.texto || 'No hay una observación disponible.'}</p></div></div>
    </section>}

    <section aria-label="Instrucciones y archivos" className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)] lg:gap-6">
      <article className="rounded-xl border border-[#E7E4DC] border-t-4 border-t-[#0066D2] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-bold">Instrucciones</h2><span className="text-xs text-[#5E6680]">Escritas por Social Media</span></div>
        <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-[#3C4663]">{publication.instrucciones_diseno || 'No se registraron instrucciones.'}</p>
        <p className="mt-5 border-t border-[#E7E4DC] pt-4 text-[13px] leading-5 text-[#5E6680]">Si algo no queda claro, consulta a Social Media antes de entregar. Cualquier ajuste a estas instrucciones llegará como una corrección.</p>
      </article>

      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="brief-heading" className="rounded-xl border border-[#E7E4DC] bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="brief-heading" className="font-bold">Brief <span className="font-medium text-[#5E6680]">· {files?.briefFiles.length || 0} archivos de referencia</span></h2>{files?.briefUrl && <a href={files.briefUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[#0066D2] hover:text-[#002F80]">Abrir carpeta <ExternalLink size={13}/></a>}</div>
          {files?.briefFiles.length ? <ul className="mt-2">{files.briefFiles.map((file) => <FileRow key={file.id} file={file}/>)}</ul> : <p className="mt-3 text-sm text-[#5E6680]">{loadingFiles ? 'Consultando archivos del Brief…' : 'No hay archivos de referencia.'}</p>}
        </section>

        <section aria-labelledby="deliverables-heading" className="rounded-xl border border-[#E7E4DC] bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="deliverables-heading" className="font-bold">Entregables <span className="font-medium text-[#5E6680]">· {driveFiles.length} de {DRIVE_FILE_RULES.ENTREGABLES.maxFiles}</span></h2>{files?.deliverablesUrl && <a href={files.deliverablesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[#0066D2] hover:text-[#002F80]">Abrir carpeta <ExternalLink size={13}/></a>}</div>
          {isInDesign ? <label className="mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#9DBDE6] bg-[#F4F8FD] px-4 py-5 text-center transition hover:bg-[#EAF2FC]">
            <UploadCloud size={22} className="text-[#0066D2]"/><span className="text-sm font-semibold text-[#002F80]">Agregar entregables desde tu equipo</span>
            <span className="text-xs leading-5 text-[#3C4663]">Imagen, video, audio, PPTX o PDF · hasta 500 MB por archivo · quedan {remaining} cupos</span>
            <span className="text-xs text-[#5E6680]">Se valida la extensión y el tamaño, no el contenido.</span>
            <input type="file" multiple aria-label="Elegir archivos entregables" className="sr-only" onChange={(event) => { void onChoose(event.currentTarget.files); event.currentTarget.value = ''; }}/>
          </label> : <div className="mt-3 flex min-h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D2CCC0] bg-[#F7F5F0] px-4 py-4 text-center"><span className="text-sm font-semibold text-[#5E6680]">La carga está pausada</span><span className="mt-1 text-xs leading-5 text-[#5E6680]">Reabre la solicitud para subir los archivos corregidos.</span></div>}
          {fileError && <p role="alert" className="mt-3 text-sm text-red-700">{fileError} <button type="button" onClick={() => { setLoadingFiles(true); void refreshFiles(); }} className="font-semibold underline">Reintentar</button></p>}
          {loadingFiles && <p className="mt-3 flex items-center gap-2 text-sm text-[#5E6680]"><Loader2 size={14} className="animate-spin"/>Consultando Drive…</p>}
          {uploads.length > 0 && <ul className="mt-3 space-y-2">{uploads.map((item, index) => <li key={`${item.id || item.name}-${index}`} className="rounded-lg bg-[#F7F5F0] p-3">
            <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span><span className="text-xs text-[#5E6680]">{item.error ? item.progress ? `${item.progress}%` : prettySize(item.size) : `${item.progress}% · ${prettySize(item.size)}`}</span>
              {item.id && item.error && <label className="cursor-pointer text-xs font-semibold text-[#0066D2] underline">Seleccionar para reanudar<input type="file" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void resume(index, file); event.currentTarget.value = ''; }}/></label>}
              {item.id && <button type="button" onClick={() => controllers.current.get(item.id!)?.abort()} className="min-h-9 rounded px-2 text-xs font-semibold text-[#A5281B] hover:bg-red-50">Cancelar</button>}
              {!item.id && item.progress === 100 && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B6B3F]"><Check size={14}/>Cargado</span>}
            </div>
            {item.error ? <p role="alert" className="mt-1 text-xs text-[#A5281B]">{item.error}</p> : <div role="progressbar" aria-label={`Progreso de ${item.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DCE6F3]"><div className="h-full rounded-full bg-[#0066D2] transition-[width]" style={{ width: `${item.progress}%` }}/></div>}
          </li>)}</ul>}
          {driveFiles.length > 0 && <ul className="mt-3 space-y-2">{driveFiles.map((file) => <li key={file.id} className="rounded-lg bg-[#F7F5F0] px-3"><FileRow file={file}/></li>)}</ul>}
          {!loadingFiles && !driveFiles.length && !fileError && <p className="mt-3 text-sm text-[#5E6680]">Aún no hay archivos en Entregables.</p>}
          {isInDesign && !hasCurrentCycleFile && <p className="mt-3 text-xs leading-5 text-[#5E6680]">Para entregar necesitas al menos un archivo nuevo cargado después de abrir esta solicitud.</p>}
        </section>
      </div>
    </section>

    <section aria-labelledby="dates-heading" className="rounded-xl border border-[#E7E4DC] bg-white px-4 py-4 sm:px-6">
      <h2 id="dates-heading" className="mb-4 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-[#5E6680]"><CalendarDays size={15}/>FECHAS Y PLAZO</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DateInfo label="Creada" value={formatDesignDate(publication.created_at)}/>
        <DateInfo label="Solicitada a Diseño" value={formatDesignDate(publication.fecha_solicitud_diseno, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}/>
        <div><p className="text-xs text-[#5E6680]">Entrega estimada</p><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{formatDesignDate(publication.fecha_entrega_diseno_estimada)}</span><DueBadge estimate={publication.fecha_entrega_diseno_estimada} today={today}/></div></div>
        <DateInfo label="Entrega real" value={formatDesignDate(publication.fecha_entrega_diseno_real, { weekday: 'short', day: 'numeric', month: 'short' })}/>
        <DateInfo label="Publicación" value={formatDesignDate(publication.fecha_publicacion)}/>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.8fr)]">
      <article aria-labelledby="content-heading" className="rounded-xl border border-[#E7E4DC] bg-white px-5 py-5 sm:px-6">
        <h2 id="content-heading" className="mb-4 text-[11px] font-bold tracking-[0.08em] text-[#5E6680]">CONTENIDO DE LA PUBLICACIÓN</h2>
        <div className="space-y-4">
          <ContentField label="Hook" value={publication.hook_texto}/>
          <ContentField label="Cuerpo" value={publication.body_texto}/>
          {publication.cta_texto && <ContentField label="CTA" value={publication.cta_texto}/>}
          {!!publication.hashtags?.length && <ContentField label="Hashtags" value={publication.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}/>}
        </div>
      </article>
      <aside className="space-y-5">
        <section className="rounded-xl border border-[#E7E4DC] bg-white px-5 py-5 sm:px-6"><h2 className="mb-4 text-[11px] font-bold tracking-[0.08em] text-[#5E6680]">DATOS</h2><dl className="space-y-3 text-sm"><div><dt className="text-xs text-[#5E6680]">Formato</dt><dd className="mt-0.5 font-medium">{publication.formato}</dd></div><div><dt className="text-xs text-[#5E6680]">Canales</dt><dd className="mt-0.5 font-medium">{channels.length ? channels.map(formatSocialPlatform).join(', ') : '—'}</dd></div><div><dt className="text-xs text-[#5E6680]">Prioridad</dt><dd className="mt-0.5 font-medium">{publication.prioridad === 1 ? 'Alta' : publication.prioridad === 3 ? 'Baja' : 'Normal'}</dd></div></dl></section>
        <section className="rounded-xl border border-[#E7E4DC] bg-white px-5 py-5 sm:px-6"><h2 className="mb-4 text-[11px] font-bold tracking-[0.08em] text-[#5E6680]">HISTORIAL DE LA SOLICITUD</h2>
          <ol className="space-y-3 border-l border-[#D2CCC0] pl-4">
            {history.map((item, index) => <li key={`${item.cambiado_en}-${index}`} className="relative text-[13px] leading-5"><span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0066D2] ring-1 ring-[#A9C8EE]"/><p className="font-semibold text-[#10233F]">{historyLabel(item.estatus_nuevo, item.estatus_anterior)}</p><time className="text-xs text-[#5E6680]" dateTime={item.cambiado_en}>{dateTime(item.cambiado_en)}</time>{item.motivo && <p className="mt-1 whitespace-pre-line text-[#3C4663]">{item.motivo}</p>}</li>)}
            {!history.length && <li className="text-sm text-[#5E6680]">Aún no hay movimientos registrados.</li>}
            {comments.filter((item) => item.tipo === 'COMENTARIO').map((item) => <li key={item.id} className="relative text-[13px] leading-5"><span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#5E6680] ring-1 ring-[#D2CCC0]"/><p className="font-semibold text-[#10233F]">Comentario</p><time className="text-xs text-[#5E6680]" dateTime={item.creado_en}>{dateTime(item.creado_en)}</time><p className="mt-1 whitespace-pre-line text-[#3C4663]">{item.texto}</p></li>)}
          </ol>
        </section>
      </aside>
    </section>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E4DC] bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(16,35,63,0.08)] backdrop-blur md:hidden">
      {isInDesign ? <button type="button" disabled={pending || !hasCurrentCycleFile} onClick={() => changeStatus('EN_REVISION_CM')} className="min-h-12 w-full rounded-xl border border-[#0066D2] bg-[#0066D2] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-[#E7E4DC] disabled:bg-[#E7E4DC] disabled:text-[#5E6680]">{pending && loadingId === 'EN_REVISION_CM' ? 'Entregando…' : 'Entregar a revisión'}</button> : <button type="button" disabled={pending} onClick={() => changeStatus('EN_DISENO')} className="min-h-12 w-full rounded-xl border border-[#0066D2] bg-[#0066D2] px-4 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Abriendo…' : 'Reabrir para corregir'}</button>}
    </div>
  </main>;
}

function DateInfo({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-[#5E6680]">{label}</p><p className="mt-1 text-sm font-semibold text-[#10233F]">{value}</p></div>; }
function ContentField({ label, value }: { label: string; value: string | null }) { return <div><p className="text-xs text-[#5E6680]">{label}</p><p className="mt-0.5 whitespace-pre-line text-sm leading-6 text-[#3C4663]">{value || '—'}</p></div>; }
function historyLabel(next: string, previous: string | null) {
  if (next === 'SOLICITADO') return 'Solicitada a Diseño';
  if (next === 'EN_DISENO') return previous === 'EN_CORRECCION' ? 'Reabierta para corregir' : 'Abierta por Diseño';
  if (next === 'EN_REVISION_CM') return 'Entregada a Social Media';
  if (next === 'EN_CORRECCION') return 'Devuelta con correcciones';
  if (next === 'CANCELADO') return 'Solicitud cancelada';
  return next.replaceAll('_', ' ');
}
