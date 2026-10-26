'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DesignRequest } from '@/lib/designRequests';
import {
  filterHistoryEntries,
  formatHistoryDate,
  safeHistoryReferenceUrl,
  type HistoryFilter,
  type LegacyDesignHistoryRequest,
  type UnifiedHistoryEntry,
} from '@/lib/designHistory';
import { designRequestHref, designOutputLabel } from '@/lib/design/designLabels';
import { DesignWorkspaceNav } from '../DesignWorkspaceNav';
import { OriginChip, SlaPill } from '../../components/DesignBadges';

const filters: { value: HistoryFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'DELIVERED', label: 'Entregadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'LEGACY', label: 'Históricas (Excel)' },
];

const SOURCE_STATUS_LABELS: Record<string, string> = {
  EN_REVISION_CM: 'En revisión',
  PENDIENTE_APROBACION_GERENCIA: 'Pendiente de aprobación',
  APROBADO: 'Aprobado',
  PROGRAMADO: 'Programado',
  PUBLICADO: 'Publicado',
};

function statusLabel(request: DesignRequest) {
  if (request.design_status === 'CANCELLED') return 'Cancelada';
  if (request.source === 'SOCIAL_MEDIA' && request.source_status) {
    return SOURCE_STATUS_LABELS[request.source_status] ?? request.source_status.replaceAll('_', ' ');
  }
  return 'Entregada';
}

function LegacyDetails({ request }: { request: LegacyDesignHistoryRequest }) {
  const referenceUrl = safeHistoryReferenceUrl(request.reference_url);
  const details = [
    ['Objetivo', request.objective],
    ['Publicación solicitada', request.publication_request],
    ['Publicación adicional', request.publication_details_2],
    ['Impresión solicitada', request.print_request],
    ['Impresión adicional', request.print_details_2],
    ['Medio', request.medium_raw],
    ['Cantidad de diseños', request.design_quantity_raw],
    ['Cantidad de piezas', request.pieces_quantity_raw],
    ['Material', request.material],
    ['Medidas', request.dimensions],
    ['Solicitante histórico', request.requester_name_raw],
  ].filter(([, value]) => value?.trim());

  if (!details.length && !referenceUrl) return null;

  return <details className="mt-2 text-xs text-[#3C4663]">
    <summary className="w-fit cursor-pointer font-semibold text-[#0066D2]">Ver brief histórico</summary>
    <dl className="mt-2 grid gap-x-4 gap-y-2 rounded-lg bg-[#F7F5F0] p-3 sm:grid-cols-2">
      {details.map(([label, value]) => <div key={label}>
        <dt className="font-semibold">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
      </div>)}
      {referenceUrl && <div>
        <dt className="font-semibold">Referencia</dt>
        <dd className="mt-0.5"><a href={referenceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[#0066D2] underline">Abrir referencia externa</a></dd>
      </div>}
    </dl>
  </details>;
}

function LegacyHistoryRow({ request }: { request: LegacyDesignHistoryRequest }) {
  const metadata = [
    request.priority_raw && `Prioridad: ${request.priority_raw}`,
    request.department_raw && `Departamento: ${request.department_raw}`,
    request.area_raw && `Área: ${request.area_raw}`,
  ].filter(Boolean);

  return <tr className="align-top hover:bg-[#FCFBF8]">
    <td className="px-5 py-3.5">
      <span className="font-semibold text-[#10233F]">{request.title?.trim() || 'Sin nombre disponible'}</span>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#5E6680]">
        <span className="inline-flex min-h-6 items-center rounded-full bg-[#F3F0E9] px-2.5 py-0.5 font-semibold text-[#3C4663]">Histórico · Excel</span>
        {metadata.map((value) => <span key={value}>{value}</span>)}
      </div>
      <LegacyDetails request={request}/>
    </td>
    <td className="px-3 py-3.5 text-[#3C4663]">{request.designer_name_raw?.trim() || 'Sin dato'}</td>
    <td className="whitespace-nowrap px-3 py-3.5 text-[#3C4663]">{formatHistoryDate(request.source_timestamp)}</td>
    <td className="whitespace-nowrap px-3 py-3.5 text-[#3C4663]">{formatHistoryDate(request.due_date)}</td>
    <td className="whitespace-nowrap px-3 py-3.5 text-[#3C4663]">{formatHistoryDate(request.completed_at)}</td>
    <td className="px-5 py-3.5"><span className="inline-flex min-h-6 items-center rounded-full bg-[#EFEDE8] px-2.5 py-0.5 text-xs font-semibold text-[#3C4663]">{request.status_raw?.trim() || 'Sin dato'}</span></td>
  </tr>;
}

function OperationalHistoryRow({ request }: { request: DesignRequest }) {
  const context = request.source_context;
  const channels = Array.isArray(context.channels) ? context.channels.filter((value): value is string => typeof value === 'string') : [];
  const outputs = [...new Set([...request.requested_outputs.map((output) => output.label), ...channels])].map(designOutputLabel);

  return <tr className="align-top hover:bg-[#FCFBF8]">
    <td className="px-5 py-3.5">
      <Link href={designRequestHref(request)} className="font-semibold text-[#10233F] underline decoration-[#C9C3B6] underline-offset-2">{request.title}</Link>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#5E6680]">
        <OriginChip source={request.source}/>
        <span>{outputs.join(', ') || 'Sin formato'}</span>
        {request.usage_date?.value && <span>· {request.usage_date.label.toLowerCase()} {formatHistoryDate(request.usage_date.value)}</span>}
      </div>
      {request.design_status === 'CANCELLED' && request.cancellation_reason && <p className="mt-2 rounded-lg bg-[#F3F0E9] px-3 py-2 text-[13px] leading-5 text-[#3C4663]"><span className="font-semibold">Motivo de cancelación:</span> {request.cancellation_reason}</p>}
    </td>
    <td className="px-3 py-3.5 text-[#3C4663]">{request.designer_name || '—'}</td>
    <td className="whitespace-nowrap px-3 py-3.5 text-[#3C4663]">{formatHistoryDate(request.requested_at)}</td>
    <td className="whitespace-nowrap px-3 py-3.5 text-[#3C4663]">{formatHistoryDate(request.delivered_at)}</td>
    <td className="px-3 py-3.5"><SlaPill estimate={request.target_date} delivered={request.delivered_at} cancelled={request.design_status === 'CANCELLED'}/></td>
    <td className="px-5 py-3.5"><span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${request.design_status === 'CANCELLED' ? 'bg-[#EFEDE8] text-[#3C4663]' : 'bg-[#E3F5EC] text-[#0B6B3F]'}`}>{statusLabel(request)}</span></td>
  </tr>;
}

export function UnifiedHistoryView({ entries, page, hasNextPage }: { entries: UnifiedHistoryEntry[]; page: number; hasNextPage: boolean }) {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const visible = useMemo(() => filterHistoryEntries(entries, filter), [entries, filter]);

  return <>
    <DesignWorkspaceNav active="history"/>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] font-bold uppercase tracking-[.08em] text-[#0066D2]">Diseño</p><h1 className="mt-1 text-[28px] font-bold leading-tight text-[#10233F]">Historial de solicitudes</h1><p className="mt-1 text-sm text-[#5E6680]">Historial operativo y solicitudes históricas importadas desde Excel.</p></div>
      <div role="group" aria-label="Filtrar historial" className="flex flex-wrap gap-2">
        {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${filter === item.value ? 'border-[#A9C8EE] bg-[#E6F0FB] text-[#002F80]' : 'border-[#D2CCC0] bg-white text-[#3C4663] hover:bg-[#F7F5F0]'}`}>{item.label}</button>)}
      </div>
    </header>
    <section aria-label="Solicitudes del historial" className="overflow-hidden rounded-xl border border-[#E7E4DC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <thead className="bg-[#F7F5F0] text-xs text-[#5E6680]"><tr>
            <th scope="col" className="px-5 py-3 font-semibold">Solicitud</th><th scope="col" className="px-3 py-3 font-semibold">Diseñador</th><th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">Fecha de solicitud</th><th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">Entrega prevista / real</th><th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">Término / plazo</th><th scope="col" className="px-5 py-3 font-semibold">Estado original / actual</th>
          </tr></thead>
          <tbody className="divide-y divide-[#F0EDE6]">
            {visible.map((entry) => entry.source === 'LEGACY'
              ? <LegacyHistoryRow key={`legacy:${entry.id}`} request={entry}/>
              : <OperationalHistoryRow key={entry.request.request_id} request={entry.request}/>)}
            {!visible.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#5E6680]">No hay solicitudes para este filtro en la página actual.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#E7E4DC] px-4 py-3 text-sm text-[#5E6680] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Página {page} (por origen)</span>
        <nav aria-label="Páginas del historial" className="flex gap-2">
          <Link aria-disabled={page <= 1} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${page <= 1 ? 'pointer-events-none border-[#E7E4DC] bg-[#F7F5F0] text-[#5E6680]/60' : 'border-[#C9C3B6] bg-white text-[#10233F] hover:bg-[#F7F5F0]'}`} href={`/design/publications/history?page=${Math.max(1, page - 1)}`}>Anterior</Link>
          <Link aria-disabled={!hasNextPage} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${!hasNextPage ? 'pointer-events-none border-[#E7E4DC] bg-[#F7F5F0] text-[#5E6680]/60' : 'border-[#C9C3B6] bg-white text-[#10233F] hover:bg-[#F7F5F0]'}`} href={`/design/publications/history?page=${page + 1}`}>Siguiente</Link>
        </nav>
      </div>
    </section>
    <p className="text-xs leading-5 text-[#5E6680]">La página y el desplazamiento se aplican por separado a cada origen: se cargan hasta 100 registros operativos de cada fuente y hasta 100 históricos, y luego se ordenan juntos por fecha. Por eso cada página no representa un bloque global de 100 solicitudes.</p>
  </>;
}
