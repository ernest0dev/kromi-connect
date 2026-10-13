'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDesignDate, formatSocialPlatform, getDesignSlaOutcome } from '@/lib/designSla';
import type { Publicacion } from '@/types';
import { DesignWorkspaceNav } from '../DesignWorkspaceNav';

type Filter = 'ALL' | 'DELIVERED' | 'CANCELLED';
type Props = {
  publications: Publicacion[];
  designers: Record<string, string>;
  channels: Record<string, string[]>;
  cancellationReasons: Record<string, string>;
  page: number;
};

const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'DELIVERED', label: 'Entregadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

function statusLabel(status: string) {
  return status === 'EN_REVISION_CM' ? 'En revisión' : status.replaceAll('_', ' ').toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function SlaPill({ estimate, delivered, cancelled }: { estimate: string | null; delivered: string | null; cancelled: boolean }) {
  if (cancelled) return <span className="text-[#5E6680]">—</span>;
  const outcome = getDesignSlaOutcome(estimate, delivered);
  if (outcome === '—') return <span className="text-[#5E6680]">—</span>;
  const onTime = outcome === 'A tiempo';
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${onTime ? 'bg-[#E3F5EC] text-[#0B6B3F]' : 'bg-[#FDE8E6] text-[#A5281B]'}`}>{outcome}</span>;
}

export function HistoryView({ publications, designers, channels, cancellationReasons, page }: Props) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const visible = useMemo(() => publications.filter((publication) => {
    if (filter === 'CANCELLED') return publication.estatus === 'CANCELADO';
    if (filter === 'DELIVERED') return publication.estatus !== 'CANCELADO';
    return true;
  }), [filter, publications]);

  return <>
    <DesignWorkspaceNav active="history" />
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0066D2]">Diseño</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#10233F]">Historial de solicitudes</h1>
        <p className="mt-1 text-sm text-[#5E6680]">Piezas entregadas y solicitudes canceladas. Las más recientes primero.</p>
      </div>
      <div role="group" aria-label="Filtrar historial" className="flex flex-wrap gap-2">
        {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${filter === item.value ? 'border-[#A9C8EE] bg-[#E6F0FB] text-[#002F80]' : 'border-[#D2CCC0] bg-white text-[#3C4663] hover:bg-[#F7F5F0]'}`}>{item.label}</button>)}
      </div>
    </header>

    <section aria-label="Solicitudes del historial" className="overflow-hidden rounded-xl border border-[#E7E4DC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-[#F7F5F0] text-xs text-[#5E6680]"><tr>
            <th scope="col" className="px-5 py-3 font-semibold">Solicitud</th>
            <th scope="col" className="px-3 py-3 font-semibold">Diseñador</th>
            <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">Entrega</th>
            <th scope="col" className="px-3 py-3 font-semibold">Plazo</th>
            <th scope="col" className="px-5 py-3 font-semibold">Estado actual</th>
          </tr></thead>
          <tbody className="divide-y divide-[#F0EDE6]">
            {visible.map((publication) => {
              const cancelled = publication.estatus === 'CANCELADO';
              const delivered = publication.fecha_entrega_diseno_real;
              return <tr key={publication.id} className="align-top hover:bg-[#FCFBF8]">
                <td className="px-5 py-3.5"><div className="font-semibold text-[#10233F]">{publication.titulo}</div><div className="mt-0.5 text-xs text-[#5E6680]">{publication.formato}{channels[publication.id]?.length ? ` · ${channels[publication.id].map(formatSocialPlatform).join(', ')}` : ''} · {formatDesignDate(publication.fecha_publicacion, { year: 'numeric', month: 'short', day: 'numeric' })}</div>{cancelled && cancellationReasons[publication.id] && <p className="mt-2 rounded-lg bg-[#F3F0E9] px-3 py-2 text-[13px] leading-5 text-[#3C4663]"><span className="font-semibold">Motivo de cancelación:</span> {cancellationReasons[publication.id]}</p>}</td>
                <td className="px-3 py-3.5 text-[#3C4663]">{designers[publication.id] || '—'}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-[#3C4663]">{delivered ? formatDesignDate(delivered, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin entrega'}</td>
                <td className="px-3 py-3.5"><SlaPill estimate={publication.fecha_entrega_diseno_estimada} delivered={delivered} cancelled={cancelled}/></td>
                <td className="px-5 py-3.5"><span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cancelled ? 'bg-[#EFEDE8] text-[#3C4663]' : publication.estatus === 'PUBLICADO' ? 'bg-[#E3F5EC] text-[#0B6B3F]' : publication.estatus === 'PROGRAMADO' ? 'bg-[#DFF5F3] text-[#0A5A55]' : 'bg-[#E6ECFC] text-[#1F3C9C]'}`}>{cancelled ? 'Cancelada' : statusLabel(publication.estatus)}</span></td>
              </tr>;
            })}
            {!visible.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#5E6680]">No hay solicitudes para este filtro en la página actual.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#E7E4DC] px-4 py-3 text-sm text-[#5E6680] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Página {page}</span>
        <nav aria-label="Páginas del historial" className="flex gap-2">
          <Link aria-disabled={page <= 1} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${page <= 1 ? 'pointer-events-none border-[#E7E4DC] bg-[#F7F5F0] text-[#5E6680]/60' : 'border-[#C9C3B6] bg-white text-[#10233F] hover:bg-[#F7F5F0]'}`} href={`/design/publications/history?page=${Math.max(1, page - 1)}`}>Anterior</Link>
          <Link aria-disabled={publications.length < 100} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${publications.length < 100 ? 'pointer-events-none border-[#E7E4DC] bg-[#F7F5F0] text-[#5E6680]/60' : 'border-[#C9C3B6] bg-white text-[#10233F] hover:bg-[#F7F5F0]'}`} href={`/design/publications/history?page=${page + 1}`}>Siguiente</Link>
        </nav>
      </div>
    </section>
    <p className="text-xs leading-5 text-[#5E6680]">Las cancelaciones aparecen solo si la solicitud ya había llegado a Diseño. La fecha mostrada corresponde a la última entrega.</p>
  </>;
}
