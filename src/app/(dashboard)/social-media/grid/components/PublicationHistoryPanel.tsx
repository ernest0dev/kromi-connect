'use client';

import { ReactNode, useEffect, useState } from 'react';
import { getPublicationReviewHistoryAction } from '@/app/actions/publicaciones/workflow';
import { ESTATUS_STYLE } from '../utils/constants';

export type PublicationHistoryResult = Awaited<ReturnType<typeof getPublicationReviewHistoryAction>> | null;

export function usePublicationHistory(publicationId: string | null): PublicationHistoryResult {
  const [data, setData] = useState<PublicationHistoryResult>(null);
  useEffect(() => {
    let active = true;
    if (!publicationId) { setData(null); return () => { active = false; }; }
    setData(null);
    void getPublicationReviewHistoryAction(publicationId).then((result) => { if (active) setData(result); });
    return () => { active = false; };
  }, [publicationId]);
  return data;
}

function HistoryStatus({ data, children }: { data: PublicationHistoryResult; children: ReactNode }) {
  if (!data) return <p className="text-xs text-slate-500">Cargando historial…</p>;
  if (!data.success) return <p role="alert" className="text-xs text-red-700">{data.error}</p>;
  return <>{children}</>;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' }).format(new Date(value));
}

export function PublicationCommentsSection({ data }: { data: PublicationHistoryResult }) {
  return <section className="space-y-2">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Observaciones de revisión</h3>
    <HistoryStatus data={data}>{data?.success && (data.comments.length ? data.comments.map((comment) => <article key={comment.id} className="rounded-lg border border-slate-200 p-3"><p className="whitespace-pre-wrap text-sm text-slate-800">{comment.texto}</p><p className="mt-2 text-[11px] text-slate-500">{comment.tipo === 'CORRECCION' ? 'Corrección solicitada por Social Media' : comment.tipo === 'MOTIVO_CANCELACION' ? 'Cancelación · Social Media' : 'Observación'} · {formatTimestamp(comment.creado_en)}</p></article>) : <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Las solicitudes de corrección y sus observaciones aparecerán aquí con autor y fecha.</p>)}</HistoryStatus>
  </section>;
}

export function PublicationStatusHistorySection({ data }: { data: PublicationHistoryResult }) {
  return <section className="space-y-2">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Historial de estados</h3>
    <HistoryStatus data={data}>{data?.success && (data.history.length ? <ol className="space-y-2">{data.history.map((event) => <li key={event.id} className="border-l-2 border-blue-200 pl-3"><p className="text-sm font-medium text-slate-800">{event.estatus_anterior ? ESTATUS_STYLE[event.estatus_anterior].label : 'Creada'} → {ESTATUS_STYLE[event.estatus_nuevo].label}</p>{event.motivo && <p className="mt-1 text-xs text-slate-600">{event.motivo}</p>}<p className="mt-1 text-[11px] text-slate-500">{event.estatus_nuevo === 'EN_DISENO' || event.estatus_nuevo === 'EN_REVISION_CM' ? 'Diseño' : 'Social Media'} · {formatTimestamp(event.cambiado_en)}</p></li>)}</ol> : <p className="text-sm text-slate-500">Sin cambios de estado registrados.</p>)}</HistoryStatus>
  </section>;
}

export function PublicationHistoryPanel({ publicationId }: { publicationId: string }) {
  const data = usePublicationHistory(publicationId);
  return <div className="grid gap-5 md:grid-cols-2"><PublicationCommentsSection data={data} /><PublicationStatusHistorySection data={data} /></div>;
}
