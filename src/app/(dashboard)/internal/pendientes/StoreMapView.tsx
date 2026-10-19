'use client';

import { useMemo, useState } from 'react';
import { STORE_MAP_INFO, TASK_STATUS_LABELS, getUrgency, type InternalStore, type StoreTaskRow } from '@/lib/internalTasks';

// Calibrado con la imagen public/maps/valencia-tiendas.webp (1124 x 821 px): ajuste lineal sobre los pines de
// Mañongo, Trigal Norte, Trigal Sur, Prebo y Guataparo, con error menor a 1 px. Si se cambia la imagen, recalibrar.
const BOUNDS = { latMin: 10.18216, latMax: 10.24430, lngMin: -68.04744, lngMax: -67.96091 };
const MAP_ASPECT = 1124 / 821;
const MAP_IMAGE = '/maps/valencia-tiendas.webp';
const TYPE_ORDER = ['IMPRESION', 'SONIDO_INTERNO', 'REPARACION', 'OTRO', 'INSUMO', 'NECESIDAD'] as const;
const TYPE_GROUP_LABELS: Record<(typeof TYPE_ORDER)[number], string> = { IMPRESION: 'Impresiones', SONIDO_INTERNO: 'Sonido interno', REPARACION: 'Reparaciones', OTRO: 'Otros', INSUMO: 'Insumos (anteriores)', NECESIDAD: 'Necesidades (anteriores)' };

function urgencyTone(rows: StoreTaskRow[]) {
  const values = rows.map((row) => getUrgency(row.fecha_requerida));
  if (values.includes('vencido')) return 'bg-red-600 text-white';
  if (values.includes('proximo')) return 'bg-orange-500 text-white';
  return rows.length ? 'bg-[#0066D2] text-white' : 'bg-slate-300 text-slate-600';
}

export function StoreMapView({ stores, rows, onOpenTask, onCreate, onAdvance }: {
  stores: InternalStore[]; rows: StoreTaskRow[];
  onOpenTask: (task: StoreTaskRow) => void; onCreate: (storeId?: string) => void; onAdvance: (task: StoreTaskRow) => void;
}) {
  const [selectedId, setSelectedId] = useState(stores[0]?.id ?? '');
  const grouped = useMemo(() => {
    const map = new Map<string, StoreTaskRow[]>();
    for (const store of stores) map.set(store.id, rows.filter((row) => row.sede_id === store.id && !['ENTREGADO', 'CANCELADO'].includes(row.estatus)));
    return map;
  }, [rows, stores]);
  const inFrame = stores.filter((store) => {
    const info = STORE_MAP_INFO[store.codigo];
    return info && info.lat >= BOUNDS.latMin && info.lat <= BOUNDS.latMax && info.lng >= BOUNDS.lngMin && info.lng <= BOUNDS.lngMax;
  });
  const outOfFrame = stores.filter((store) => !inFrame.includes(store));
  const selected = stores.find((store) => store.id === selectedId) ?? stores[0];
  const selectedRows = selected ? grouped.get(selected.id) ?? [] : [];
  const overdue = rows.filter((row) => !['ENTREGADO', 'CANCELADO'].includes(row.estatus) && getUrgency(row.fecha_requerida) === 'vencido').length;
  const ready = rows.filter((row) => row.estatus === 'LISTO').length;
  const storesWithOpenTasks = stores.filter((store) => (grouped.get(store.id)?.length ?? 0) > 0).length;

  function point(store: InternalStore) {
    const info = STORE_MAP_INFO[store.codigo];
    return { left: `${((info.lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * 100}%`, top: `${((BOUNDS.latMax - info.lat) / (BOUNDS.latMax - BOUNDS.latMin)) * 100}%` };
  }

  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de pendientes">
      <Kpi label="Pendientes abiertos" value={rows.filter((row) => !['ENTREGADO', 'CANCELADO'].includes(row.estatus)).length} />
      <Kpi label="Vencidos" value={overdue} accent="text-red-700" />
      <Kpi label="Listos para entregar" value={ready} accent="text-green-700" />
      <Kpi label="Tiendas con pendientes" value={`${storesWithOpenTasks} de ${stores.length}`} />
    </section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-xl border border-[#dce2ea] bg-white p-3 sm:p-4" aria-label="Mapa de tiendas">
        <div className="relative w-full overflow-hidden rounded-lg border border-[#dce2ea] bg-[#e9edf2]" style={{ aspectRatio: MAP_ASPECT }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MAP_IMAGE} alt="Mapa de Valencia, Naguanagua y San Diego con las tiendas de Kromi" className="absolute inset-0 h-full w-full select-none object-fill" draggable={false} />
          {inFrame.map((store) => {
            const storeRows = grouped.get(store.id) ?? [];
            return <button key={store.id} type="button" onClick={() => setSelectedId(store.id)} style={point(store)} aria-pressed={selected?.id === store.id} aria-label={`${store.nombre}: ${storeRows.length} pendientes abiertos`} className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-orange-400">
              <span className={`grid h-10 min-w-10 place-items-center rounded-full border-[3px] border-white px-2 text-sm font-extrabold shadow-md ${urgencyTone(storeRows)} ${selected?.id === store.id ? 'ring-2 ring-[#10233F] ring-offset-2' : ''}`}>{storeRows.length}{storeRows.some((row) => getUrgency(row.fecha_requerida) === 'vencido') && <span className="ml-0.5">!</span>}</span>
              <span className="rounded bg-white/90 px-1.5 py-0.5 text-xs font-bold text-[#10233F] shadow-sm group-hover:bg-white">{store.nombre}</span>
            </button>;
          })}
          {inFrame.length === 0 && <p className="absolute inset-0 grid place-items-center rounded bg-white/90 text-sm text-slate-500">No hay tiendas para mostrar con estos filtros.</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-600">
          <Legend color="bg-red-600" label="Con vencidos (!)" /><Legend color="bg-orange-500" label="Próximos a vencer" /><Legend color="bg-[#0066D2]" label="Sin urgencia" /><Legend color="bg-slate-300" label="Sin pendientes" />
        </div>
        {outOfFrame.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3">{outOfFrame.map((store) => <button key={store.id} type="button" onClick={() => setSelectedId(store.id)} aria-pressed={selected?.id === store.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${selected?.id === store.id ? 'border-[#0066D2] bg-blue-50' : 'border-slate-200 bg-slate-50'}`}><span className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-bold ${urgencyTone(grouped.get(store.id) ?? [])}`}>{grouped.get(store.id)?.length ?? 0}</span><span><span className="block text-sm font-bold">{store.nombre}</span><span className="block text-xs text-slate-500">Fuera del encuadre · {STORE_MAP_INFO[store.codigo]?.zone ?? 'Sin ubicación'}</span></span></button>)}</div>}
        <p className="mt-3 text-xs text-slate-500">Mapa estático de referencia. Imagen © Google Maps.</p>
      </section>
      <aside className="max-xl:fixed max-xl:inset-x-0 max-xl:bottom-0 max-xl:z-30 max-xl:max-h-[56vh] max-xl:overflow-y-auto max-xl:rounded-t-[18px] max-xl:border-b-0 max-xl:pb-8 max-xl:shadow-[0_-6px_20px_rgba(16,35,63,0.12)] rounded-xl border border-[#dce2ea] bg-white p-4" aria-live="polite">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-300 xl:hidden" aria-hidden="true" />
        {selected ? <>
          <p className="text-xs font-bold uppercase tracking-[.1em] text-slate-500">{STORE_MAP_INFO[selected.codigo]?.zone ?? 'Tienda'}</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#10233F]">{selected.nombre}</h2>
          {STORE_MAP_INFO[selected.codigo]?.address && <p className="mt-1 text-xs text-slate-500">{STORE_MAP_INFO[selected.codigo].address}</p>}
          <p className="mt-4 text-sm font-bold">{selectedRows.length} pendientes abiertos</p>
          {selectedRows.length ? TYPE_ORDER.map((type) => {
            const typedRows = selectedRows.filter((row) => row.tipo === type);
            return typedRows.length ? <div key={type} className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{TYPE_GROUP_LABELS[type]}</h3><div className="divide-y divide-slate-100">{typedRows.map((row) => { const next = row.estatus === 'PENDIENTE' ? 'EN_PROCESO' : row.estatus === 'EN_PROCESO' ? 'LISTO' : row.estatus === 'LISTO' ? 'ENTREGADO' : null; return <article key={row.id} className="py-3"><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{TASK_STATUS_LABELS[row.estatus]}</span><UrgencyChip date={row.fecha_requerida} />{row.requiere_diseno && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">Diseño: {row.diseno_estatus ?? 'Por solicitar'}</span>}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{row.drive_brief_file_count ? `${row.drive_brief_file_count} brief` : 'Sin brief'}</span></div><h4 className="mt-1 text-sm font-bold">{row.titulo}</h4>{row.detalle && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{row.detalle}</p>}<div className="mt-2 flex flex-wrap gap-3"><button type="button" onClick={() => onOpenTask(row)} className="text-xs font-bold text-[#0066D2] underline">Detalle</button>{next && <button type="button" onClick={() => onAdvance(row)} className="text-xs font-bold text-[#073b78] underline">Marcar {TASK_STATUS_LABELS[next].toLowerCase()}</button>}</div></article>; })}</div></div> : null;
          }) : <p className="py-8 text-center text-sm text-slate-500">Esta tienda no tiene pendientes abiertos.</p>}
          <button type="button" onClick={() => onCreate(selected.id)} className="mt-4 w-full rounded-lg bg-[#0066D2] px-4 py-2.5 text-sm font-bold text-white">+ Nuevo pendiente en {selected.nombre}</button>
        </> : <p className="text-sm text-slate-500">Selecciona una tienda en el mapa.</p>}
      </aside>
    </div>
  </div>;
}

function Kpi({ label, value, accent = 'text-[#10233F]' }: { label: string; value: number | string; accent?: string }) {
  return <div className="rounded-xl border border-[#dce2ea] bg-white p-3 sm:px-4"><span className="text-xs text-slate-500">{label}</span><b className={`mt-1 block text-2xl leading-none ${accent}`}>{value}</b></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><i className={`h-3 w-3 rounded-full ${color}`} />{label}</span>;
}

function UrgencyChip({ date }: { date: string | null }) {
  const urgency = getUrgency(date);
  const label = urgency === 'vencido' ? 'Vencido' : urgency === 'proximo' ? 'Próximo' : date ? `Para el ${date}` : 'Sin fecha';
  const style = urgency === 'vencido' ? 'bg-red-50 text-red-700' : urgency === 'proximo' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}
