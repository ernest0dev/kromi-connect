'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { archiveStoreTaskAction, transitionStoreTaskAction } from '@/app/actions/internal/tasks';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS, getUrgency, type InternalStore, type StoreTaskRow } from '@/lib/internalTasks';
import { StoreMapView } from './StoreMapView';
import { TaskDrawer } from './TaskDrawer';

type Props = { rows: StoreTaskRow[]; mapRows?: StoreTaskRow[]; stores: InternalStore[]; archived?: boolean; canCreate: boolean; filters?: { q?: string; tipo?: string; estado?: string; sede?: string }; page?: number; pageSize?: number };

export function TaskListView({ rows, mapRows = rows, stores, archived = false, canCreate, filters = {}, page = 1, pageSize = 25 }: Props) {
  const router = useRouter();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [drawer, setDrawer] = useState<{ task?: StoreTaskRow; storeId?: string; duplicate?: boolean } | null>(null);
  const [designFilter, setDesignFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, startTransition] = useTransition();
  const visibleRows = useMemo(() => {
    if (!designFilter) return rows;
    if (designFilter === 'REQUIRES') return rows.filter((row) => row.requiere_diseno);
    if (designFilter === 'NONE') return rows.filter((row) => !row.requiere_diseno);
    return rows.filter((row) => row.diseno_estatus === designFilter);
  }, [designFilter, rows]);
  const visibleMapRows = useMemo(() => {
    if (!designFilter) return mapRows;
    if (designFilter === 'REQUIRES') return mapRows.filter((row) => row.requiere_diseno);
    if (designFilter === 'NONE') return mapRows.filter((row) => !row.requiere_diseno);
    return mapRows.filter((row) => row.diseno_estatus === designFilter);
  }, [designFilter, mapRows]);

  async function archive(row: StoreTaskRow, restore = false) {
    setError('');
    const result = await archiveStoreTaskAction({ id: row.id, version: row.version, restore });
    if (!result.success) { setError(result.error); return; }
    startTransition(() => router.refresh());
  }

  async function advance(row: StoreTaskRow) {
    const next = row.estatus === 'PENDIENTE' ? 'EN_PROCESO' : row.estatus === 'EN_PROCESO' ? 'LISTO' : row.estatus === 'LISTO' ? 'ENTREGADO' : null;
    if (!next) return;
    setError('');
    const result = await transitionStoreTaskAction({ id: row.id, version: row.version, status: next });
    if (!result.success) { setError(result.error); return; }
    startTransition(() => router.refresh());
  }

  const openCount = rows.filter((row) => !['ENTREGADO', 'CANCELADO'].includes(row.estatus)).length;
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  function pageHref(targetPage: number, targetSize = pageSize) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.tipo) params.set('tipo', filters.tipo);
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.sede) params.set('sede', filters.sede);
    params.set('page', String(targetPage)); params.set('page_size', String(targetSize));
    return `${archived ? '/internal/pendientes/archive' : '/internal/pendientes'}?${params.toString()}`;
  }
  return <main className="mx-auto w-full max-w-[1500px] space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#0066D2]">Interno</p><h1 className="text-2xl font-extrabold tracking-tight text-[#10233F]">{archived ? 'Archivo de pendientes' : 'Pendientes'}</h1><p className="mt-1 text-sm text-[#566274]">{archived ? 'Pendientes entregados o cancelados.' : 'Tus pendientes de impresiones, insumos y necesidades por tienda.'}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {!archived && <div className="inline-flex rounded-lg border border-[#cbd3df] bg-white p-0.5" role="group" aria-label="Vista de pendientes"><button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')} className={`rounded-md px-3 py-2 text-sm font-bold ${view === 'map' ? 'bg-[#073b78] text-white' : 'text-slate-700'}`}>Mapa</button><button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`rounded-md px-3 py-2 text-sm font-bold ${view === 'list' ? 'bg-[#073b78] text-white' : 'text-slate-700'}`}>Listado</button></div>}
        <a className={`rounded-lg border px-3 py-2 text-sm font-semibold ${archived ? 'bg-[#073b78] text-white' : 'border-slate-300 bg-white text-slate-700'}`} href="/internal/pendientes/archive">Archivo</a>
        {canCreate && !archived && <button type="button" onClick={() => setDrawer({})} className="rounded-lg bg-[#0066D2] px-4 py-2 text-sm font-bold text-white">+ Nuevo pendiente</button>}
      </div>
    </header>

    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    {!archived && <form action="/internal/pendientes" method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-[#dce2ea] bg-white p-3"><input type="hidden" name="page_size" value={pageSize} />
      <label className="grid gap-1 text-xs font-semibold text-[#566274]">Buscar<input name="q" defaultValue={filters.q} placeholder="Título o detalle" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold text-[#566274]">Tipo<select name="tipo" defaultValue={filters.tipo} className="h-10 rounded-lg border border-slate-300 px-3 text-sm"><option value="">Todos</option><option value="IMPRESION">Impresión</option><option value="SONIDO_INTERNO">Sonido interno</option><option value="REPARACION">Reparación</option><option value="OTRO">Otro</option></select></label>
      <label className="grid gap-1 text-xs font-semibold text-[#566274]">Estado<select name="estado" defaultValue={filters.estado} className="h-10 rounded-lg border border-slate-300 px-3 text-sm"><option value="">Todos</option>{Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold text-[#566274]">Tienda<select name="sede" defaultValue={filters.sede} className="h-10 rounded-lg border border-slate-300 px-3 text-sm"><option value="">Todas</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.nombre}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold text-[#566274]">Diseño<select value={designFilter} onChange={(event) => setDesignFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm"><option value="">Todos</option><option value="REQUIRES">Requiere diseño</option><option value="NONE">Sin diseño</option><option value="SOLICITADO">Solicitado</option><option value="EN_DISENO">En diseño</option><option value="ENTREGADO">Entregado</option></select></label>
      <button className="h-10 rounded-lg bg-[#073b78] px-4 text-sm font-semibold text-white">Filtrar</button>
    </form>}

    {archived || view === 'list' ? <section className="overflow-hidden rounded-xl border border-[#dce2ea] bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3 font-bold">Tienda</th><th className="px-4 py-3 font-bold">Tipo</th><th className="px-4 py-3 font-bold">Pendiente</th><th className="px-4 py-3 font-bold">Estado</th><th className="px-4 py-3 font-bold">Diseño</th><th className="px-4 py-3 font-bold">Brief</th><th className="px-4 py-3 font-bold">Fecha requerida</th><th className="px-4 py-3 font-bold">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row) => { const next = row.estatus === 'PENDIENTE' ? 'EN_PROCESO' : row.estatus === 'EN_PROCESO' ? 'LISTO' : row.estatus === 'LISTO' ? 'ENTREGADO' : null; return <tr key={row.id} className="align-top hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 font-semibold">{row.sede_nombre}</td><td className="px-4 py-3">{TASK_TYPE_LABELS[row.tipo]}</td><td className="px-4 py-3"><button type="button" onClick={() => setDrawer({ task: row })} className="text-left font-bold text-[#10233F] hover:text-[#0066D2]">{row.titulo}</button>{row.detalle && <p className="mt-1 max-w-sm truncate text-xs text-slate-500">{row.detalle}</p>}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{TASK_STATUS_LABELS[row.estatus]}</span></td><td className="px-4 py-3">{row.requiere_diseno ? <span className="text-xs font-semibold text-blue-800">{row.diseno_estatus ?? 'Por solicitar'}</span> : <span className="text-xs text-slate-400">No aplica</span>}</td><td className="px-4 py-3 text-xs">{row.drive_brief_file_count ? `${row.drive_brief_file_count} archivo${row.drive_brief_file_count === 1 ? '' : 's'}` : 'Pendiente'}</td><td className="whitespace-nowrap px-4 py-3"><Urgency date={row.fecha_requerida} /></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{archived ? <><button type="button" onClick={() => setDrawer({ task: row })} className="rounded-md border px-2.5 py-1.5 text-xs font-semibold">Detalle</button>{canCreate && <button type="button" onClick={() => setDrawer({ task: row, duplicate: true })} className="rounded-md bg-[#0066D2] px-2.5 py-1.5 text-xs font-semibold text-white">Crear nuevo</button>}<button type="button" disabled={busy} onClick={() => void archive(row, true)} className="rounded-md border px-2.5 py-1.5 text-xs font-semibold">Restaurar</button></> : <><button type="button" onClick={() => setDrawer({ task: row })} className="rounded-md border px-2.5 py-1.5 text-xs font-semibold">Detalle</button>{next && <button type="button" disabled={busy} onClick={() => void advance(row)} className="rounded-md bg-[#073b78] px-2.5 py-1.5 text-xs font-semibold text-white">Marcar {TASK_STATUS_LABELS[next].toLowerCase()}</button>}{['ENTREGADO', 'CANCELADO'].includes(row.estatus) && <button type="button" disabled={busy} onClick={() => void archive(row)} className="rounded-md border px-2.5 py-1.5 text-xs font-semibold">Archivar</button>}</>}</div></td></tr>; })}</tbody></table></div>
      {visibleRows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{archived ? 'No hay pendientes archivados.' : openCount === 0 ? 'Todavía no hay pendientes. Crea el primero.' : 'No hay pendientes que coincidan con estos filtros.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>{totalCount} pendientes · fechas en hora de Caracas</span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">Filas por página<select aria-label="Filas por página" value={pageSize} onChange={(event) => { window.location.href = pageHref(1, Number(event.target.value)); }} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs">{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          <span>Página {page} de {totalPages}</span>
          <a aria-disabled={page <= 1} className={`rounded-md border px-2.5 py-1.5 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`} href={pageHref(Math.max(1, page - 1))}>Anterior</a>
          <a aria-disabled={page >= totalPages} className={`rounded-md border px-2.5 py-1.5 ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`} href={pageHref(Math.min(totalPages, page + 1))}>Siguiente</a>
        </div>
      </div>
    </section> : <StoreMapView stores={stores} rows={visibleMapRows} onOpenTask={(task) => setDrawer({ task })} onCreate={(storeId) => setDrawer({ storeId })} onAdvance={advance} />}

    {drawer && <TaskDrawer key={drawer.duplicate ? `duplicate-${drawer.task?.id}` : drawer.task?.id ?? `create-${drawer.storeId ?? 'new'}`} stores={stores} task={drawer.task} initialStoreId={drawer.storeId} duplicate={drawer.duplicate} onClose={() => setDrawer(null)} />}
  </main>;
}

function Urgency({ date }: { date: string | null }) {
  const urgency = getUrgency(date);
  const label = urgency === 'vencido' ? 'Vencido' : urgency === 'proximo' ? 'Próximo' : date ?? 'Sin fecha';
  const style = urgency === 'vencido' ? 'text-red-700' : urgency === 'proximo' ? 'text-amber-800' : 'text-slate-600';
  return <span className={`text-xs font-semibold ${style}`}>{label}</span>;
}
