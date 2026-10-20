'use client';

import Link from 'next/link';
import { DesignWorkspaceNav } from '../DesignWorkspaceNav';
import type { DesignRequest } from '@/lib/designRequests';
import { designRequestHref, DESIGN_SOURCE_LABELS } from '@/lib/design/designLabels';
import { formatDesignDate } from '@/lib/designSla';


export function UnifiedHistoryView({ requests, page }: { requests: DesignRequest[]; page: number }) {
  return <><DesignWorkspaceNav active="history"/><header><p className="text-[11px] font-bold uppercase tracking-[.08em] text-[#0066D2]">Diseño</p><h1 className="mt-1 text-[28px] font-bold text-[#10233F]">Historial de solicitudes</h1><p className="text-sm text-[#5E6680]">Entregas y cancelaciones de todos los orígenes.</p></header><section className="overflow-hidden rounded-xl border bg-white">{requests.length ? requests.map((r) => <article key={r.request_id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><h2 className="font-semibold text-[#10233F]">{r.title}</h2><p className="text-sm text-[#5E6680]">{DESIGN_SOURCE_LABELS[r.source]} · {formatDesignDate(r.target_date)}</p></div><div className="flex items-center gap-3"><span className="text-xs text-[#5E6680]">{r.design_status === 'CANCELLED' ? 'Cancelada' : 'Entregada'}</span><Link href={designRequestHref(r)} className="text-sm font-semibold text-[#0066D2] underline">Ver ficha</Link></div></article>) : <p className="p-8 text-center text-sm text-[#5E6680]">Todavía no hay solicitudes finalizadas.</p>}</section><p className="text-xs text-[#5E6680]">Página {page}</p></>;
}
