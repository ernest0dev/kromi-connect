'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveRestore, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { resolveExpiredDrivePurgeAction, restorePublicationAction } from '@/app/actions/publicaciones/archive';

interface ArchivePublication {
  id: string;
  titulo: string;
  formato: string;
  fecha_publicacion: string;
  deleted_at: string | null;
  drive_cleanup_status: string;
  drive_cleanup_error: string | null;
  drive_folder_url: string | null;
  accountLabels: string[];
}

export function ArchiveList({ publications }: { publications: ArchivePublication[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const now = new Date();
  const restoreCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
  const daysInTargetMonth = new Date(Date.UTC(restoreCutoff.getUTCFullYear(), restoreCutoff.getUTCMonth() + 1, 0)).getUTCDate();
  restoreCutoff.setUTCDate(Math.min(now.getUTCDate(), daysInTargetMonth));

  const run = (publicationId: string, operation: () => Promise<{ success: boolean; error?: string }>) => {
    setPendingId(publicationId);
    setError('');
    startTransition(async () => {
      const result = await operation();
      if (!result.success) setError(result.error || 'No se pudo completar la operación.');
      else router.refresh();
      setPendingId(null);
    });
  };

  if (!publications.length) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">El Archivo está vacío.</p>;

  return <section className="space-y-3">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {publications.map((item) => {
      const archivedAt = item.deleted_at ? new Date(item.deleted_at) : null;
      const restorable = archivedAt !== null && archivedAt > restoreCutoff && ['PENDIENTE', 'ERROR'].includes(item.drive_cleanup_status);
      const expired = !restorable;
      const busy = isPending && pendingId === item.id;
      return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{item.titulo}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{item.formato}</span></div>
            <p className="text-xs text-slate-500">Publicación: {item.fecha_publicacion} · Archivada: {archivedAt?.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' }) || '—'}</p>
            <p className="text-xs text-slate-500">Cuentas: {item.accountLabels.join(', ') || 'Sin cuentas visibles'}</p>
            {item.drive_folder_url && <a className="text-xs font-semibold text-blue-700 underline" href={item.drive_folder_url} target="_blank" rel="noreferrer">Abrir carpeta de Drive</a>}
            <p className={`text-xs font-semibold ${item.drive_cleanup_status === 'ERROR' ? 'text-red-700' : 'text-slate-600'}`}>Drive: {item.drive_cleanup_status === 'ERROR' ? 'Error pendiente de resolver' : item.drive_cleanup_status}{item.drive_cleanup_error ? ` · ${item.drive_cleanup_error}` : ''}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {restorable && <button type="button" disabled={busy} onClick={() => run(item.id, () => restorePublicationAction(item.id))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />} Restaurar</button>}
            {expired && item.drive_cleanup_status === 'ERROR' && <>
              <button type="button" disabled={busy} onClick={() => run(item.id, () => resolveExpiredDrivePurgeAction(item.id, 'retry-drive'))} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reintentar y purgar</button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('Se conservará la carpeta de Drive y se eliminarán definitivamente los registros de esta publicación. ¿Continuar?')) run(item.id, () => resolveExpiredDrivePurgeAction(item.id, 'keep-drive')); }} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 size={14} /> Conservar Drive y purgar</button>
            </>}
            {expired && item.drive_cleanup_status === 'ELIMINADO' && <button type="button" disabled={busy} onClick={() => run(item.id, () => resolveExpiredDrivePurgeAction(item.id, 'retry-drive'))} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Finalizar purga</button>}
            {expired && item.drive_cleanup_status === 'PENDIENTE' && <span className="self-center text-xs text-slate-500">La purga programada está pendiente.</span>}
          </div>
        </div>
      </article>;
    })}
  </section>;
}
