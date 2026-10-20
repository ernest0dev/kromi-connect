'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { startInternalDesignWorkAction } from '@/app/actions/internal/design-work';
import { startEventDesignWorkAction } from '@/app/actions/events/design';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';
import { formatDesignDate, getDesignDueLabel } from '@/lib/designSla';
import type { DesignRequest } from '@/lib/designRequests';
import { designRequestHref, DESIGN_STATUS_LABELS, DESIGN_SOURCE_LABELS, designOutputLabel } from '@/lib/design/designLabels';

export function UnifiedQueueView({ requests, userId, today }: { requests: DesignRequest[]; userId: string; today: string }) {
  const router = useRouter();
  const [source, setSource] = useState('ALL');
  const [mine, setMine] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const filtered = requests.filter((r) => (source === 'ALL' || r.source === source) && (!mine || r.designer_id === userId));
  const take = (r: DesignRequest) => startTransition(async () => {
    setError('');
    const result = r.source === 'SOCIAL_MEDIA'
      ? await transitionPublicationAction({ publicationId: r.source_record_id, status: 'EN_DISENO' })
      : r.source === 'INTERNAL' ? await startInternalDesignWorkAction(r.source_record_id) : await startEventDesignWorkAction(r.source_record_id);
    if (!result.success) setError(result.error || 'No se pudo iniciar la solicitud.');
    else { router.push(designRequestHref(r)); router.refresh(); }
  });
  const card = (r: DesignRequest) => <article key={r.request_id} className="grid gap-3 rounded-xl border border-[#E7E4DC] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,.7fr)_auto] sm:items-center">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-[#10233F]">{r.title}</h2><span className="rounded-full bg-[#E6F0FB] px-2 py-0.5 text-xs font-semibold text-[#002F80]">{DESIGN_SOURCE_LABELS[r.source]}</span></div><p className="mt-1 text-sm text-[#5E6680]">{r.requested_outputs.map((x) => designOutputLabel(x.label)).join(', ') || 'Sin formato'}</p></div>
    <div className="space-y-1 text-sm text-[#5E6680]"><p>{DESIGN_STATUS_LABELS[r.design_status]}{r.designer_id === userId ? ' · Asignada a ti' : ''}</p><p>Entrega: <strong className="text-[#10233F]">{formatDesignDate(r.target_date)}</strong></p><p className="text-xs">{getDesignDueLabel(r.target_date, today)}</p></div>
    <div>{r.design_status === 'REQUESTED' ? <button type="button" disabled={busy} onClick={() => take(r)} className="min-h-10 rounded-lg bg-[#0066D2] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Abriendo…' : 'Tomar y abrir'}</button> : <Link href={designRequestHref(r)} className="inline-flex min-h-10 items-center rounded-lg border border-[#C9C3B6] px-4 text-sm font-semibold text-[#10233F]">Abrir ficha</Link>}</div>
  </article>;
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros de solicitudes"><select value={source} onChange={(e) => setSource(e.target.value)} className="min-h-10 rounded-lg border px-3 text-sm"><option value="ALL">Todos los orígenes</option><option value="SOCIAL_MEDIA">Social Media</option><option value="INTERNAL">Interno</option><option value="EVENTS">Eventos</option></select><button type="button" aria-pressed={mine} onClick={() => setMine(!mine)} className="min-h-10 rounded-lg border px-3 text-sm">{mine ? 'Mis solicitudes' : 'Todas las solicitudes'}</button></div>
    {!filtered.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-[#5E6680]">No hay solicitudes para estos filtros.</p> : <div className="space-y-3">{filtered.map(card)}</div>}
  </div>;
}
