'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AlertCircle, CircleHelp, Clock3, Info } from 'lucide-react';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';
import { formatDesignDate, formatSocialPlatform, getDesignDueLabel, getDesignDueTone } from '@/lib/designSla';
import type { Publicacion } from '@/types';

type Props = { publications: Publicacion[]; userId: string; designerNames: Record<string, string>; channels: Record<string, string[]>; today: string };
type Status = Publicacion['estatus'];

const badge = {
  neutral: 'border-[#D2CCC0] bg-[#F3F0E9] text-[#3C4663]',
  soon: 'border-[#F0C98A] bg-[#FDEBD0] text-[#7A3E00]',
  late: 'border-[#F0B5B0] bg-[#FDE8E6] text-[#A5281B]',
};

function DueBadge({ estimate, today }: { estimate: string | null; today: string }) {
  const tone = getDesignDueTone(estimate, today);
  const Icon = tone === 'late' ? AlertCircle : tone === 'soon' ? Clock3 : CircleHelp;
  return <span className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge[tone]}`}><Icon size={13}/>{getDesignDueLabel(estimate, today)}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  const label = status === 'SOLICITADO' ? 'Solicitada' : status === 'EN_CORRECCION' ? 'Devuelta con correcciones' : 'En diseño';
  const tone = status === 'SOLICITADO' ? 'bg-[#E6F0FB] text-[#002F80]' : status === 'EN_CORRECCION' ? 'bg-[#FDEBD0] text-[#7A3E00]' : 'bg-[#E0F4FD] text-[#05526F]';
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function QueueView({ publications, userId, designerNames, channels, today }: Props) {
  const router = useRouter();
  const [mine, setMine] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState('');
  const [error, setError] = useState('');
  const rows = mine ? publications.filter((publication) => publication.disenador_id === userId) : publications;

  const take = (publication: Publicacion) => startTransition(async () => {
    setPendingId(publication.id);
    setError('');
    const result = await transitionPublicationAction({ publicationId: publication.id, status: 'EN_DISENO' });
    if (!result.success) setError(result.error || 'No se pudo abrir la solicitud.');
    else {
      router.push(`/design/publications/${publication.id}`);
      router.refresh();
    }
    setPendingId('');
  });

  const card = (publication: Publicacion) => {
    const claimedBy = publication.disenador_id ? designerNames[publication.id] || 'Diseño' : null;
    const isMine = publication.disenador_id === userId;
    const canStart = publication.estatus === 'SOLICITADO';
    const isCorrection = publication.estatus === 'EN_CORRECCION';

    return <article key={publication.id} className="grid gap-4 rounded-xl border border-[#E7E4DC] bg-white p-4 shadow-[0_2px_8px_rgba(16,35,63,0.035)] sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.72fr)_minmax(175px,0.58fr)_auto] sm:items-center sm:gap-5 sm:px-5">
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold text-[#10233F]">{publication.titulo}</h3>
        <p className="mt-1 text-sm text-[#5E6680]">{publication.formato}{channels[publication.id]?.length ? <> <span aria-hidden="true">·</span> {channels[publication.id].map(formatSocialPlatform).join(', ')}</> : null}</p>
      </div>
      <div className="space-y-1 text-sm leading-6 text-[#5E6680]">
        {claimedBy ? <p>Tomada por <span className="font-semibold text-[#10233F]">{claimedBy}{isMine ? ' (tú)' : ''}</span></p> : <p className="text-[#5E6680]">Pendiente de asignación</p>}
        <p>Publica <span className="font-semibold text-[#10233F]">{formatDesignDate(publication.fecha_publicacion)}</span></p>
        <p>Entrega estimada <span className="font-semibold text-[#10233F]">{formatDesignDate(publication.fecha_entrega_diseno_estimada)}</span></p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
        <StatusBadge status={publication.estatus}/>
        <DueBadge estimate={publication.fecha_entrega_diseno_estimada} today={today}/>
      </div>
      <div className="sm:justify-self-end">
        {canStart ? <button type="button" disabled={pending} onClick={() => take(publication)} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#0066D2] bg-[#0066D2] px-4 text-sm font-semibold text-white transition hover:bg-[#002F80] disabled:cursor-wait disabled:opacity-60 sm:w-auto">{pending && pendingId === publication.id ? 'Abriendo…' : 'Tomar y abrir'}</button> : <Link href={`/design/publications/${publication.id}`} className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition sm:w-auto ${isCorrection ? 'border border-[#0066D2] bg-[#0066D2] text-white hover:bg-[#002F80]' : 'border border-[#C9C3B6] bg-white text-[#10233F] hover:bg-[#F7F5F0]'}`}>{isCorrection ? 'Ver correcciones' : 'Abrir ficha'}</Link>}
      </div>
    </article>;
  };

  const unclaimed = rows.filter((publication) => publication.estatus === 'SOLICITADO');
  const inProgress = rows.filter((publication) => publication.estatus === 'EN_DISENO' || publication.estatus === 'EN_CORRECCION');
  const empty = (message: string) => <p className="rounded-xl border border-dashed border-[#D2CCC0] bg-white/70 px-5 py-4 text-sm text-[#5E6680]">{message}</p>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex max-w-2xl items-start gap-2.5 rounded-xl bg-[#E6F0FB] px-4 py-3 text-sm leading-6 text-[#002F80]"><Info size={18} className="mt-0.5 shrink-0"/><span>Al tomar una solicitud queda registrada a tu nombre. Si hace falta, cualquier persona de Diseño puede entregarla.</span></p>
      <div role="group" aria-label="Filtrar solicitudes" className="flex shrink-0 gap-2">
        {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={mine === value} onClick={() => setMine(value)} className={`min-h-11 rounded-full border px-5 text-sm font-semibold transition ${mine === value ? 'border-[#A9C8EE] bg-[#E6F0FB] text-[#002F80]' : 'border-[#D2CCC0] bg-white text-[#3C4663] hover:bg-[#F7F5F0]'}`}>{value ? 'Mías' : 'Todas'}</button>)}
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!mine && <section aria-labelledby="design-unclaimed" className="space-y-3">
      <h2 id="design-unclaimed" className="text-base font-bold text-[#10233F]">Por tomar <span className="font-medium text-[#5E6680]">· {unclaimed.length}</span></h2>
      {unclaimed.length ? unclaimed.map(card) : empty('No hay solicitudes por tomar.')}
    </section>}
    <section aria-labelledby="design-in-progress" className="space-y-3">
      <h2 id="design-in-progress" className="text-base font-bold text-[#10233F]">En curso <span className="font-medium text-[#5E6680]">· {inProgress.length}</span></h2>
      {inProgress.length ? inProgress.map(card) : empty(mine ? 'Aún no tienes solicitudes asignadas.' : 'No hay solicitudes en curso.')}
    </section>
  </div>;
}
