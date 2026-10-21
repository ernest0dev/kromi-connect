'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Info } from 'lucide-react';
import { startInternalDesignWorkAction } from '@/app/actions/internal/design-work';
import { startEventDesignWorkAction } from '@/app/actions/events/design';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';
import { formatDesignDate } from '@/lib/designSla';
import type { DesignRequest, DesignSource, DesignStatus } from '@/lib/designRequests';
import { designRequestHref, designOutputLabel } from '@/lib/design/designLabels';
import { DesignStatusBadge, DueBadge, OriginChip } from '../components/DesignBadges';

const IN_PROGRESS_STATUSES: DesignStatus[] = ['IN_PROGRESS', 'NEEDS_CHANGES'];

export function UnifiedQueueView({ requests, userId, today }: { requests: DesignRequest[]; userId: string; today: string }) {
  const router = useRouter();
  const [source, setSource] = useState<'ALL' | DesignSource>('ALL');
  const [mine, setMine] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const filtered = requests.filter((request) =>
    (source === 'ALL' || request.source === source) && (!mine || request.designer_id === userId),
  );

  const take = (request: DesignRequest) => startTransition(async () => {
    setError('');
    const result = request.source === 'SOCIAL_MEDIA'
      ? await transitionPublicationAction({ publicationId: request.source_record_id, status: 'EN_DISENO' })
      : request.source === 'INTERNAL'
        ? await startInternalDesignWorkAction(request.source_record_id)
        : await startEventDesignWorkAction(request.source_record_id);
    if (!result.success) setError(result.error || 'No se pudo iniciar la solicitud.');
    else {
      router.push(designRequestHref(request));
      router.refresh();
    }
  });

  const card = (request: DesignRequest) => {
    const channelValues = request.source_context.channels;
    const channels = Array.isArray(channelValues) ? channelValues.filter((value): value is string => typeof value === 'string') : [];
    const formats = request.requested_outputs.map((output) => designOutputLabel(output.label));
    const outputs = [...new Set([...formats, ...channels.map(designOutputLabel)])];
    const designer = request.designer_name?.trim();
    const claimedBy = request.designer_id
      ? `Tomada por ${designer || 'Diseño'}${request.designer_id === userId ? ' (tú)' : ''}`
      : 'Pendiente de asignación';
    const primaryAction = request.design_status === 'NEEDS_CHANGES';

    return <article key={request.request_id} className="grid gap-4 rounded-xl border border-[#E7E4DC] bg-white p-4 shadow-[0_2px_8px_rgba(16,35,63,0.035)] sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.72fr)_minmax(175px,0.58fr)_auto] sm:items-center sm:gap-5 sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-bold text-[#10233F]">{request.title}</h2>
          <OriginChip source={request.source}/>
        </div>
        <p className="mt-1 text-sm text-[#5E6680]">{outputs.join(', ') || 'Sin formato'}</p>
      </div>
      <div className="space-y-1 text-sm leading-6 text-[#5E6680]">
        <p>{claimedBy}</p>
        {request.usage_date && <p>{request.usage_date.label} <strong className="text-[#10233F]">{formatDesignDate(request.usage_date.value)}</strong></p>}
        <p>Entrega estimada <strong className="text-[#10233F]">{formatDesignDate(request.target_date)}</strong></p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
        <DesignStatusBadge status={request.design_status}/>
        <DueBadge estimate={request.target_date} today={today}/>
      </div>
      <div className="sm:justify-self-end">
        {request.design_status === 'REQUESTED'
          ? <button type="button" disabled={busy} onClick={() => take(request)} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#0066D2] bg-[#0066D2] px-4 text-sm font-semibold text-white transition hover:bg-[#002F80] disabled:cursor-wait disabled:opacity-60 sm:w-auto">{busy ? 'Abriendo…' : 'Tomar y abrir'}</button>
          : <Link href={designRequestHref(request)} className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition sm:w-auto ${primaryAction ? 'border border-[#0066D2] bg-[#0066D2] text-white hover:bg-[#002F80]' : 'border border-[#C9C3B6] bg-white text-[#10233F] hover:bg-[#F7F5F0]'}`}>{primaryAction ? 'Ver correcciones' : 'Abrir ficha'}</Link>}
      </div>
    </article>;
  };

  const available = filtered.filter((request) => request.design_status === 'REQUESTED');
  const inProgress = filtered.filter((request) => IN_PROGRESS_STATUSES.includes(request.design_status));
  const empty = (message: string) => <p className="rounded-xl border border-dashed border-[#D2CCC0] bg-white/70 px-5 py-4 text-sm text-[#5E6680]">{message}</p>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex max-w-2xl items-start gap-2.5 rounded-xl bg-[#E6F0FB] px-4 py-3 text-sm leading-6 text-[#002F80]"><Info size={18} className="mt-0.5 shrink-0"/><span>Al tomar una solicitud queda registrada a tu nombre. Si hace falta, cualquier persona de Diseño puede entregarla.</span></p>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar solicitudes" className="flex gap-2">
          {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={mine === value} onClick={() => setMine(value)} className={`min-h-11 rounded-full border px-5 text-sm font-semibold transition ${mine === value ? 'border-[#A9C8EE] bg-[#E6F0FB] text-[#002F80]' : 'border-[#D2CCC0] bg-white text-[#3C4663] hover:bg-[#F7F5F0]'}`}>{value ? 'Mías' : 'Todas'}</button>)}
        </div>
        <label className="sr-only" htmlFor="design-source-filter">Filtrar por origen</label>
        <select id="design-source-filter" value={source} onChange={(event) => setSource(event.target.value as 'ALL' | DesignSource)} className="min-h-11 rounded-lg border border-[#D2CCC0] bg-white px-3 text-sm text-[#3C4663]">
          <option value="ALL">Todos los orígenes</option><option value="SOCIAL_MEDIA">Social Media</option><option value="INTERNAL">Interno</option><option value="EVENTS">Eventos</option>
        </select>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!mine && <section aria-labelledby="design-unclaimed" className="space-y-3">
      <h2 id="design-unclaimed" className="text-base font-bold text-[#10233F]">Por tomar <span className="font-medium text-[#5E6680]">· {available.length}</span></h2>
      {available.length ? available.map(card) : empty('No hay solicitudes por tomar.')}
    </section>}
    <section aria-labelledby="design-in-progress" className="space-y-3">
      <h2 id="design-in-progress" className="text-base font-bold text-[#10233F]">En curso <span className="font-medium text-[#5E6680]">· {inProgress.length}</span></h2>
      {inProgress.length ? inProgress.map(card) : empty(mine ? 'Aún no tienes solicitudes asignadas.' : 'No hay solicitudes en curso.')}
    </section>
  </div>;
}
