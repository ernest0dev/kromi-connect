'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react';
import { listPublicacionDeliverablesForReviewAction, getPublicationDesignerNameAction } from '@/app/actions/publicaciones/design-drive';
import { formatDesignDate, getDesignSlaOutcome } from '@/lib/designSla';
import type { DriveBriefFile } from '@/lib/googleDrive';

type ReviewState = 'loading' | 'error' | 'empty' | 'loaded';

export function DeliverablesReview({ publicationId, deliveredAt, estimatedAt }: { publicationId: string; deliveredAt: string | null; estimatedAt: string | null }) {
  const [files, setFiles] = useState<DriveBriefFile[]>([]);
  const [designer, setDesigner] = useState<string | null>(null);
  const [state, setState] = useState<ReviewState>('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    const [fileResult, designerResult] = await Promise.all([
      listPublicacionDeliverablesForReviewAction(publicationId),
      getPublicationDesignerNameAction(publicationId),
    ]);
    if (fileResult.success) {
      setFiles(fileResult.data);
      setState(fileResult.data.length ? 'loaded' : 'empty');
    } else {
      setError(fileResult.error);
      setState('error');
    }
    if (designerResult.success) setDesigner(designerResult.name);
  }, [publicationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const outcome = getDesignSlaOutcome(estimatedAt, deliveredAt);
  return <section aria-labelledby="design-delivery-heading" className="rounded-xl border border-[#E7E4DC] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="design-delivery-heading" className="text-sm font-bold text-[#10233F]">Entrega de Diseño{state === 'loaded' ? <span className="font-medium text-[#5E6680]"> · {files.length} {files.length === 1 ? 'archivo' : 'archivos'}</span> : null}</h3>
        {deliveredAt && <p className="mt-1 text-xs text-[#5E6680]">Entregada por {designer || 'Diseño'} · {formatDesignDate(deliveredAt, { weekday: 'short', day: 'numeric', month: 'short' })}{outcome !== '—' && <> · <span className={outcome === 'A tiempo' ? 'font-semibold text-[#0B6B3F]' : 'font-semibold text-[#A5281B]'}>{outcome}</span></>}</p>}
      </div>
      {(state === 'error' || state === 'empty') && <button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#C9C3B6] bg-white px-3 text-xs font-semibold text-[#10233F] hover:bg-[#F7F5F0]"><RefreshCw size={13}/>Reintentar</button>}
    </div>

    {state === 'loading' && <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#F7F5F0] p-3 text-sm text-[#5E6680]"><Loader2 size={15} className="animate-spin"/>Consultando archivos en Drive…</p>}
    {state === 'error' && <div role="alert" className="mt-4 rounded-lg border border-[#F0B5B0] bg-[#FDE8E6] p-3 text-sm text-[#A5281B]">{error} Las acciones de revisión siguen disponibles.</div>}
    {state === 'empty' && <div className="mt-4 rounded-lg border border-[#F0C98A] bg-[#FFF6E8] p-3 text-sm leading-5 text-[#7A3E00]">No aparecen archivos en la carpeta Entregables, aunque Diseño marcó la pieza como entregada. Revisa la carpeta en Drive antes de continuar.</div>}
    {state === 'loaded' && <ul className="mt-4 space-y-3">{files.map((file) => <li key={file.id} className="flex min-w-0 items-center gap-3 rounded-lg bg-[#F7F5F0] p-3">
      {file.thumbnailLink ? <a href={file.webViewLink || file.thumbnailLink} target="_blank" rel="noopener noreferrer" aria-label={`Previsualizar ${file.name}`} className="shrink-0"><Image src={file.thumbnailLink} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-md object-cover"/></a> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-white text-[#5E6680]"><FileText size={22}/></span>}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#10233F]">{file.name}</span><span className="mt-1 block text-xs text-[#5E6680]">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span></span>
      {file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${file.name} en Drive`} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-[#0066D2] hover:bg-[#E6F0FB]"><ExternalLink size={16}/></a>}
    </li>)}</ul>}
  </section>;
}
