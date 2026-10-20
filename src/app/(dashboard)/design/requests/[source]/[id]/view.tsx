'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { AlertCircle, ExternalLink, FileText, UploadCloud } from 'lucide-react';
import type { DesignRequestDetail } from '@/lib/designRequests';
import { designOutputLabel, DESIGN_SOURCE_LABELS, DESIGN_STATUS_LABELS } from '@/lib/design/designLabels';
import { shouldRenderDetailField } from '@/lib/design/fieldRules';
import { formatDesignDate, getDesignDueLabel, getDesignDueTone } from '@/lib/designSla';
import { uploadFile } from '@/lib/driveResumableUpload';
import { startDesignRequestAction, deliverDesignRequestAction, reopenDesignRequestAction } from '@/app/actions/design/requests';
import { listDesignPublicationDriveFilesAction, startDeliverableUploadAction, finishDeliverableUploadAction, cancelDeliverableUploadAction } from '@/app/actions/publicaciones/design-drive';
import { getInternalDesignFilesAction, startInternalDeliverableUploadAction, finishInternalDeliverableUploadAction, resumeInternalDeliverableUploadAction, cancelInternalDeliverableUploadAction } from '@/app/actions/internal/design-work';
import { listEventDesignFilesAction, startEventDeliverableUploadAction, finishEventDeliverableUploadAction, resumeEventDeliverableUploadAction, cancelEventDeliverableUploadAction } from '@/app/actions/events/drive';
import { resumeDeliverableUploadAction } from '@/app/actions/publicaciones/design-drive';

type FileInfo = { id: string; name: string; mimeType: string; size: number; webViewLink: string | null; createdTime?: string };
const card = 'rounded-xl border border-[#E7E4DC] bg-white p-5 sm:p-6';
function formatTime(value: string | null) { return value ? new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' }).format(new Date(value)) : '—'; }
function sizeLabel(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }

function FilesPanel({ detail }: { detail: DesignRequestDetail }) {
  const [brief, setBrief] = useState<FileInfo[]>([]); const [files, setFiles] = useState<FileInfo[]>([]);
  const [pendingUploads, setPendingUploads] = useState<{ id: string; name: string; mimeType: string; size: number }[]>([]);
  const [folderUrl, setFolderUrl] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null); const [busy, setBusy] = useState(false);
  const canUpload = detail.capabilities.canUpload; const source = detail.source;
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (source === 'SOCIAL_MEDIA') {
        const result = await listDesignPublicationDriveFilesAction(detail.source_record_id);
        if (result.success) { setBrief(result.data.briefFiles); setFiles(result.data.deliverableFiles); setFolderUrl(result.data.deliverablesUrl); setPendingUploads(result.data.pendingUploads); } else setError(result.error || 'No se pudieron consultar archivos.');
      } else if (source === 'INTERNAL') {
        const result = await getInternalDesignFilesAction(detail.source_record_id);
        if (result.success) { setBrief(result.briefFiles); setFiles(result.deliverableFiles); setPendingUploads(result.pendingUploads ?? []); } else setError(result.error || 'No se pudieron consultar archivos.');
      } else {
        const result = await listEventDesignFilesAction(detail.source_record_id);
        if (result.success) { setBrief(result.briefFiles); setFiles(result.deliverableFiles); setFolderUrl(result.deliverablesUrl); setPendingUploads(result.pendingUploads ?? []); } else setError(result.error || 'No se pudieron consultar archivos.');
      }
    } finally { setLoading(false); }
  }, [detail.source_record_id, source]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);

  const upload = async (file: File) => {
    setBusy(true); setError(''); setProgress(0);
    try {
      let uploadId = ''; let sessionUri = ''; let mimeType = file.type;
      if (source === 'SOCIAL_MEDIA') {
        const result = await startDeliverableUploadAction({ publicationId: detail.source_record_id, name: file.name, size: file.size });
        if (!result.success) throw new Error(result.error); uploadId = result.data.uploadId; sessionUri = result.data.sessionUri; mimeType = result.data.mimeType;
      } else if (source === 'INTERNAL') {
        const result = await startInternalDeliverableUploadAction({ id: detail.source_record_id, name: file.name, mimeType: file.type, size: file.size });
        if (!result.success) throw new Error(result.error); uploadId = result.uploadId; sessionUri = result.sessionUri;
      } else {
        const result = await startEventDeliverableUploadAction({ id: detail.source_record_id, name: file.name, mimeType: file.type, size: file.size });
        if (!result.success) throw new Error(result.error); uploadId = result.uploadId; sessionUri = result.sessionUri;
      }
      await uploadFile(file, sessionUri, mimeType, new AbortController().signal, setProgress);
      const finished = source === 'SOCIAL_MEDIA' ? await finishDeliverableUploadAction(uploadId) : source === 'INTERNAL' ? await finishInternalDeliverableUploadAction(uploadId) : await finishEventDeliverableUploadAction(uploadId);
      if (!finished.success) throw new Error(finished.error); setProgress(100); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar el entregable.'); await refresh(); }
    finally { setBusy(false); }
  };
  const resume = async (pending: { id: string; name: string; mimeType: string; size: number }, file: File) => {
    if (file.name !== pending.name || file.size !== pending.size) { setError('Selecciona el mismo archivo y tamaño para reanudar.'); return; }
    setBusy(true); setError(''); setProgress(0);
    try {
      const session = source === 'SOCIAL_MEDIA' ? await resumeDeliverableUploadAction(pending.id) : source === 'INTERNAL' ? await resumeInternalDeliverableUploadAction(pending.id) : await resumeEventDeliverableUploadAction(pending.id);
      if (!session.success) throw new Error(session.error); const uri = session.data.sessionUri;
      await uploadFile(file, uri, pending.mimeType, new AbortController().signal, setProgress, true);
      const finished = source === 'SOCIAL_MEDIA' ? await finishDeliverableUploadAction(pending.id) : source === 'INTERNAL' ? await finishInternalDeliverableUploadAction(pending.id) : await finishEventDeliverableUploadAction(pending.id);
      if (!finished.success) throw new Error(finished.error); setProgress(100); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo reanudar el entregable.'); await refresh(); }
    finally { setBusy(false); }
  };
  const cancel = async (id: string) => {
    const result = source === 'SOCIAL_MEDIA' ? await cancelDeliverableUploadAction(id) : source === 'INTERNAL' ? await cancelInternalDeliverableUploadAction(id) : await cancelEventDeliverableUploadAction(id);
    if (!result.success) setError(result.error || 'No se pudo cancelar la carga.'); else await refresh();
  };
  const renderList = (items: FileInfo[], empty: string, warning = false) => items.length ? <ul className="mt-3 divide-y divide-[#F0EDE6]">{items.map((file) => <li key={file.id} className="flex min-h-12 items-center gap-3 py-2"><FileText size={18} className="shrink-0 text-[#5E6680]"/><span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span><span className="text-xs text-[#5E6680]">{sizeLabel(file.size)}</span>{file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${file.name} en Drive`} className="grid h-10 w-10 place-items-center rounded-md text-[#0066D2]"><ExternalLink size={16}/></a>}</li>)}</ul> : <p className={`mt-3 text-sm ${warning ? 'text-amber-800' : 'text-[#5E6680]'}`}>{loading ? 'Consultando archivos…' : empty}</p>;
  return <div className="space-y-4">
    <section className={card}><div className="flex items-center justify-between gap-2"><h2 className="font-bold">Brief <span className="font-medium text-[#5E6680]">· {brief.length} archivos</span></h2></div>{renderList(brief, source === 'EVENTS' ? 'No hay archivos de referencia; el brief es opcional.' : 'Faltan archivos de brief.', source !== 'EVENTS')}</section>
    <section className={card}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Entregables <span className="font-medium text-[#5E6680]">· {files.length} / 20</span></h2>{folderUrl && <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[#0066D2]">Abrir carpeta <ExternalLink size={14}/></a>}</div>
      {canUpload && <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#9DBDE6] bg-[#F4F8FD] p-4 text-center"><UploadCloud className="text-[#0066D2]"/><span className="text-sm font-semibold text-[#002F80]">Agregar entregable</span><span className="text-xs text-[#5E6680]">Hasta 500 MB por archivo</span><input type="file" className="sr-only" disabled={busy || files.length >= 20} onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void upload(file); }}/></label>}
      {canUpload && pendingUploads.map((pending) => <div key={pending.id} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><span className="min-w-0 flex-1 truncate text-sm">Carga pausada: {pending.name}</span><label className="cursor-pointer rounded-md border border-[#C9C3B6] px-3 py-2 text-xs font-semibold">Reanudar<input type="file" className="sr-only" disabled={busy} onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void resume(pending, file); }}/></label><button type="button" onClick={() => void cancel(pending.id)} disabled={busy} className="rounded-md px-3 py-2 text-xs font-semibold text-red-800">Cancelar</button></div>)}
      {progress !== null && <div className="mt-3" role="status"><div className="h-2 overflow-hidden rounded-full bg-[#E6F0FB]"><div className="h-full bg-[#0066D2]" style={{ width: `${progress}%` }}/></div><p className="mt-1 text-xs text-[#5E6680]">{progress === 100 ? 'Carga confirmada' : `${progress}% · La carga se puede reanudar si se interrumpe.`}</p></div>}{renderList(files, 'No hay entregables.')}</section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>;
}

function ActionBar({ detail, actorId }: { detail: DesignRequestDetail; actorId: string }) {
  const router = useRouter(); const [busy, startTransition] = useTransition(); const [error, setError] = useState('');
  const run = (kind: 'start' | 'deliver' | 'reopen') => startTransition(async () => {
    setError(''); const input = { source: detail.source, id: detail.source_record_id };
    const result = kind === 'start' ? await startDesignRequestAction(input) : kind === 'deliver' ? await deliverDesignRequestAction(input) : await reopenDesignRequestAction(input);
    if (!result.success) setError(result.error || 'No se pudo actualizar la solicitud.'); else router.refresh();
  });
  const c = detail.capabilities;
  const action = c.canDeliver ? <button onClick={() => run('deliver')} disabled={busy} className="min-h-11 rounded-lg bg-[#0066D2] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Entregando…' : c.deliverLabel}</button>
    : c.canReopen ? <button onClick={() => run('reopen')} disabled={busy} className="min-h-11 rounded-lg bg-[#0066D2] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Abriendo…' : 'Reabrir para corregir'}</button>
    : c.canStart ? <button onClick={() => run('start')} disabled={busy} className="min-h-11 rounded-lg bg-[#0066D2] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Tomando…' : 'Tomar solicitud'}</button> : null;
  return <>{error && <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{action}{!action && <span className="text-sm text-[#5E6680]">{DESIGN_STATUS_LABELS[detail.design_status]}</span>}{c.canDeliver && c.deliverHint && <span className="block text-xs text-[#5E6680]">{c.deliverHint}</span>}{detail.designer?.id === actorId && <span className="sr-only">Asignada a ti</span>}</>;
}

export function RequestDetailView({ detail, actorId, today }: { detail: DesignRequestDetail; actorId: string; today: string }) {
  const context = detail.context; const sourceLabel = DESIGN_SOURCE_LABELS[detail.source];
  const statusTone = detail.design_status === 'CANCELLED' ? 'bg-[#FDE8E6] text-[#A5281B]' : detail.design_status === 'DELIVERED' ? 'bg-[#E6F5EA] text-[#1E6B35]' : detail.design_status === 'NEEDS_CHANGES' ? 'bg-[#FDEBD0] text-[#7A3E00]' : 'bg-[#E6F0FB] text-[#002F80]';
  const showCopy = shouldRenderDetailField('copy', detail); const showCorrection = shouldRenderDetailField('correction', detail);
  const channels = context.source === 'SOCIAL_MEDIA' ? context.channels : [];
  const storeNames = context.source === 'EVENTS' ? context.stores : [];
  const dataRows: [string, string][] = context.source === 'SOCIAL_MEDIA' ? [['Formato', designOutputLabel(context.format)], ['Canales', channels.map(designOutputLabel).join(', ')], ['Prioridad', detail.priority ?? '']]
    : context.source === 'INTERNAL' ? [['Tipo', designOutputLabel(context.task_type)], ['Tienda', context.store], ['Cantidad', context.quantity?.toString() ?? '']]
    : [['Formatos', context.formats.map(designOutputLabel).join(', ')], ['Tiendas', storeNames.join(', ')], ['Horario', `${formatTime(context.starts_at)}${context.ends_at ? ` – ${formatTime(context.ends_at)}` : ''}`]];
  const dateRows: [string, string | null][] = [['Creada', detail.created_at], ['Solicitada a Diseño', detail.requested_at], ['Entrega objetivo', detail.target_date], ...(detail.delivered_at ? [['Última entrega', detail.delivered_at] as [string, string]] : []), [detail.usage_date?.label ?? 'Fecha de uso', detail.usage_date?.value ?? null]];
  const dueTone = getDesignDueTone(detail.target_date, today);
  return <main className="mx-auto w-full max-w-[1100px] space-y-5 px-4 pb-28 pt-5 text-[#10233F] sm:px-6 sm:pt-7 md:pb-10">
    <header className="space-y-3"><Link href="/design/publications" className="inline-flex min-h-9 items-center text-sm font-semibold text-[#0066D2]">← Solicitudes</Link><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-[26px] font-bold leading-tight sm:text-[28px]">{detail.title}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#F3F0E9] px-2.5 py-1 text-xs font-semibold">{sourceLabel}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}>{DESIGN_STATUS_LABELS[detail.design_status]}</span>{detail.requested_outputs.map((out) => <span key={`${out.category}-${out.source_format_code}`} className="rounded-full bg-[#F3F0E9] px-2.5 py-1 text-xs font-semibold">{designOutputLabel(out.label)}</span>)}{channels.map((channel) => <span key={channel} className="rounded-full bg-[#F3F0E9] px-2.5 py-1 text-xs">{designOutputLabel(channel)}</span>)}</div><p className="mt-2 text-sm text-[#5E6680]">Tomada por <strong className="text-[#10233F]">{detail.designer?.name || (detail.designer ? 'Diseño' : 'Sin asignar')}{detail.designer?.id === actorId ? ' (tú)' : ''}</strong></p></div><div className="hidden md:block"><ActionBar detail={detail} actorId={actorId}/></div></div></header>
    {showCorrection && detail.correction && <section className="rounded-xl border border-[#F0C98A] bg-[#FFF6E8] p-4 text-[#7A3E00]"><div className="flex gap-3"><AlertCircle size={19}/><div><h2 className="font-bold">Social Media pidió correcciones</h2><p className="mt-2 whitespace-pre-line text-sm">{detail.correction.text}</p><time className="mt-2 block text-xs">{formatTime(detail.correction.at)}</time></div></div></section>}
    <section className="grid gap-5 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.4fr)]"><article className={`${card} border-t-4 border-t-[#0066D2]`}><h2 className="font-bold">Instrucciones</h2><p className={`mt-3 whitespace-pre-line text-sm leading-6 ${detail.instructions ? 'text-[#3C4663]' : 'text-amber-800'}`}>{detail.instructions || 'No se registraron instrucciones.'}</p></article><FilesPanel detail={detail}/></section>
    <section className={`${card}`}><h2 className="font-bold">Fechas y plazo</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{dateRows.map(([label,value]) => <div key={label}><p className="text-xs text-[#5E6680]">{label}</p><p className="mt-1 text-sm font-semibold">{formatDesignDate(value)}</p>{label === 'Entrega objetivo' && <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs ${dueTone === 'late' ? 'bg-red-50 text-red-800' : dueTone === 'soon' ? 'bg-amber-50 text-amber-800' : 'bg-[#F3F0E9] text-[#3C4663]'}`}>{getDesignDueLabel(value, today)}</span>}</div>)}</div></section>
    {showCopy && <section className={`${card}`}><h2 className="font-bold">Contenido de la publicación</h2>{detail.copy && Object.values(detail.copy).some((v) => Array.isArray(v) ? v.length : !!v) ? <div className="mt-3 space-y-3 text-sm">{detail.copy.hook && <p><strong>Hook:</strong> {detail.copy.hook}</p>}{detail.copy.body && <p className="whitespace-pre-line"><strong>Cuerpo:</strong> {detail.copy.body}</p>}{detail.copy.cta && <p><strong>CTA:</strong> {detail.copy.cta}</p>}{detail.copy.hashtags?.length ? <p>{detail.copy.hashtags.join(' ')}</p> : null}</div> : <p className="mt-3 text-sm text-amber-800">Sin definir</p>}</section>}
    <section className={`${card}`}><h2 className="font-bold">Datos</h2><dl className="mt-3 grid gap-3 sm:grid-cols-3">{dataRows.filter(([,value]) => value).map(([label,value]) => <div key={label}><dt className="text-xs text-[#5E6680]">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl></section>
    <section className={`${card}`}><h2 className="font-bold">Historial</h2>{detail.history.length ? <ol className="mt-3 space-y-3">{detail.history.map((item,index) => <li key={`${item.at}-${index}`} className="border-l-2 border-[#C9DDF5] pl-3"><p className="text-sm font-semibold">{DESIGN_STATUS_LABELS[item.label === 'EN_DISENO' ? 'IN_PROGRESS' : item.label === 'EN_CORRECCION' ? 'NEEDS_CHANGES' : item.label === 'CANCELADO' ? 'CANCELLED' : item.label === 'SOLICITADO' ? 'REQUESTED' : 'DELIVERED'] ?? item.label}</p><time className="text-xs text-[#5E6680]">{formatTime(item.at)}</time>{item.note && <p className="mt-1 whitespace-pre-line text-sm text-[#5E6680]">{item.note}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-[#5E6680]">Todavía no hay movimientos.</p>}</section>
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E7E4DC] bg-white/95 p-3 backdrop-blur md:hidden"><div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3"><span className="text-sm font-semibold">{DESIGN_STATUS_LABELS[detail.design_status]}</span><ActionBar detail={detail} actorId={actorId}/></div></div>
  </main>;
}
