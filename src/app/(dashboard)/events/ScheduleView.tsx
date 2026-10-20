'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, RotateCcw, Search, X } from 'lucide-react';
import {
  archiveEventAction, createEventAction, getEventDetailAction, restoreEventAction,
  rescheduleEventAction, saveEventClosureAction, transitionEventAction, updateEventAction,
} from '@/app/actions/events/schedule';
import { requestEventDesignAction, retractEventDesignAction } from '@/app/actions/events/design';
import { caracasInputToIso, EVENTO_ESTATUS, EVENTO_ESTATUS_LABEL, EVENTO_ORIGENES, EVENTO_TIPOS, formatEventDate, getCaracasDay, toCaracasInput } from '@/lib/events';
import { suggestedEventDesignDate } from '@/lib/eventDesign';
import type { EventoDetalle, EventoHistorial, EventoIndicadores, EventoPermisos, EventoResponsable, EventoRow, EventoSedeCatalogo } from '@/types';

type ViewMode = 'month' | 'week' | 'list' | 'archive';
type Props = {
  initialRows: EventoRow[]; initialError: string | null; total: number; mode: ViewMode;
  month: string; weekStart?: string; filters: { sede: string; estatus: string; tipo: string; origen: string; q: string; page: number };
  sedes: EventoSedeCatalogo[]; responsables: EventoResponsable[]; permissions: EventoPermisos; currentUserId: string;
  campaigns: { id: string; nombre: string }[];
};
type FormValue = {
  nombre: string; descripcion: string; tipo: string; tipo_otro: string; origen: string; proveedor_nombre: string;
  inicio: string; fin: string; responsable_id: string; presupuesto_estimado: string; requiere_inscripcion: boolean;
  inscripcion_cupo: string; inscripcion_limite: string; inscripcion_info: string; asistentes_esperados: string;
  patrocinadores: string; materiales: string; motivo: string; campana_id: string; sedes: { sede_id: string; zona: string }[];
  requiere_diseno: boolean; diseno_formatos: ('DIGITAL' | 'IMPRESION')[]; instrucciones_diseno: string; fecha_entrega_diseno: string;
};
const blankForm = (currentUserId: string): FormValue => ({ nombre: '', descripcion: '', tipo: 'DEGUSTACION', tipo_otro: '', origen: 'PROPIO', proveedor_nombre: '', inicio: '', fin: '', responsable_id: currentUserId, presupuesto_estimado: '', requiere_inscripcion: false, inscripcion_cupo: '', inscripcion_limite: '', inscripcion_info: '', asistentes_esperados: '', patrocinadores: '', materiales: '', motivo: '', campana_id: '', sedes: [], requiere_diseno: false, diseno_formatos: [], instrucciones_diseno: '', fecha_entrega_diseno: '' });
const fmtMoney = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
const idDate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const eventDate = (value: string | null) => value ? getCaracasDay(value) : '';
const defaultRange = (month: string) => {
  const [year, mon] = month.slice(0, 7).split('-').map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1, 4));
  const offset = (first.getUTCDay() + 6) % 7;
  const from = new Date(first.getTime() - offset * 86400000);
  const last = new Date(Date.UTC(year, mon, 0, 4));
  const after = new Date(last.getTime() + (7 - ((last.getUTCDay() + 6) % 7)) * 86400000);
  return { from, days: Math.round((after.getTime() - from.getTime()) / 86400000) };
};
const STATUS_COLOR: Record<string, string> = { EN_PLANIFICACION: 'bg-slate-100 text-slate-700', PROGRAMADO: 'bg-blue-100 text-blue-800', EN_CURSO: 'bg-amber-100 text-amber-900', TERMINADO: 'bg-emerald-100 text-emerald-800', CANCELADO: 'bg-rose-100 text-rose-800' };

export function ScheduleView(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<{ evento: EventoDetalle; historial: EventoHistorial[] } | null>(null);
  const [form, setForm] = useState<{ value: FormValue; id?: string; version?: number } | null>(null);
  const [closure, setClosure] = useState(false);
  const month = props.month.slice(0, 7);
  const range = useMemo(() => {
    if (props.mode !== 'week') return defaultRange(month);
    const [y, m, d] = props.month.slice(0, 10).split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, d, 4));
    first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    return { from: first, days: 7 };
  }, [month, props.month, props.mode]);
  const rows = props.initialRows;
  const visibleRows = useMemo(() => rows.filter((r) => r.inicio && r.fin && Date.parse(r.fin) > range.from.getTime() && Date.parse(r.inicio) < range.from.getTime() + range.days * 86400000), [rows, range]);

  const openDetail = (id: string) => startTransition(async () => {
    setNotice(''); const result = await getEventDetailAction(id);
    if (result.success) setDetail({ evento: result.evento, historial: result.historial }); else setNotice(result.error);
  });
  const mutateEventDesign = (event: EventoDetalle, retract: boolean) => startTransition(async () => {
    const result = retract ? await retractEventDesignAction(event.id, event.version) : await requestEventDesignAction(event.id);
    if (!result.success) { toast(result.error); return; }
    await openDetail(event.id); router.refresh();
  });
  const openForm = (event?: EventoDetalle) => {
    const value = blankForm(props.currentUserId);
    if (event) Object.assign(value, {
      nombre: event.nombre, descripcion: event.descripcion ?? '', tipo: event.tipo, tipo_otro: event.tipo_otro ?? '', origen: event.origen,
      proveedor_nombre: event.proveedor_nombre ?? '', inicio: toCaracasInput(event.inicio), fin: toCaracasInput(event.fin), responsable_id: event.responsable_id ?? '',
      presupuesto_estimado: event.presupuesto_estimado == null ? '' : String(event.presupuesto_estimado), requiere_inscripcion: event.requiere_inscripcion,
      inscripcion_cupo: event.inscripcion_cupo == null ? '' : String(event.inscripcion_cupo), inscripcion_limite: toCaracasInput(event.inscripcion_limite),
      inscripcion_info: event.inscripcion_info ?? '', asistentes_esperados: event.asistentes_esperados == null ? '' : String(event.asistentes_esperados),
      patrocinadores: event.patrocinadores ?? '', materiales: event.materiales ?? '', campana_id: event.campana_id ?? '', sedes: event.sedes.map((s) => ({ sede_id: s.sede_id, zona: s.zona ?? '' })),
      requiere_diseno: event.requiere_diseno, diseno_formatos: event.diseno_formatos ?? [], instrucciones_diseno: event.instrucciones_diseno ?? '', fecha_entrega_diseno: event.fecha_entrega_diseno ?? '',
    });
    setDetail(null); setForm({ value, id: event?.id, version: event?.version });
  };
  const updateValue = (key: keyof FormValue, value: unknown) => setForm((f) => f ? ({ ...f, value: { ...f.value, [key]: value } }) : f);
  const toast = (message: string) => { setNotice(message); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const selectedSede = props.sedes.find((s) => s.id === props.filters.sede)?.codigo ?? '';
  const params = new URLSearchParams();
  if (selectedSede) params.set('sede', selectedSede);
  if (props.filters.estatus) params.set('estatus', props.filters.estatus);
  if (props.filters.tipo) params.set('tipo', props.filters.tipo);
  if (props.filters.origen) params.set('origen', props.filters.origen);
  if (props.filters.q) params.set('q', props.filters.q);
  const url = (path: string, patch: Record<string, string>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k)); const q = p.toString(); return q ? `${path}?${q}` : path; };
  const monthNav = (offset: number) => { const d = new Date(`${props.month.slice(0, 10)}T12:00:00`); if (props.mode === 'week') d.setDate(d.getDate() + offset * 7); else d.setMonth(d.getMonth() + offset); router.push(url('/events/calendar', { fecha: d.toISOString().slice(0, 10), vista: props.mode === 'week' ? 'semana' : '' })); };

  async function saveEvent(confirmOverlap = false) {
    if (!form) return;
    const data = form.value;
    const { motivo, ...eventFields } = data;
    const payload: Record<string, unknown> = {
      ...eventFields, inicio: caracasInputToIso(data.inicio), fin: caracasInputToIso(data.fin),
      inscripcion_limite: data.requiere_inscripcion ? caracasInputToIso(data.inscripcion_limite) : null,
      presupuesto_estimado: data.presupuesto_estimado.trim() ? Number(data.presupuesto_estimado) : null,
      asistentes_esperados: data.asistentes_esperados.trim() ? Number(data.asistentes_esperados) : null,
      inscripcion_cupo: data.inscripcion_cupo.trim() ? Number(data.inscripcion_cupo) : null,
      moneda: 'USD', campana_id: data.campana_id || null,
      sedes: data.sedes.map((s) => ({ sede_id: s.sede_id, zona: s.zona.trim() || null })),
      tipo_otro: data.tipo === 'OTRO' ? data.tipo_otro : null,
      proveedor_nombre: data.origen === 'PROVEEDOR' ? data.proveedor_nombre : null,
    };
    startTransition(async () => {
      const result = form.id
        ? await updateEventAction({ id: form.id, expectedVersion: form.version!, datos: payload, motivo, confirmarCruce: confirmOverlap })
        : await createEventAction(payload, confirmOverlap);
      if (!result.success) {
        if (result.code === 'POSIBLE_CRUCE' && window.confirm(`${result.error}\n${(result.cruces ?? []).map((c) => typeof c === 'object' && c && 'nombre' in c ? String(c.nombre) : '').join(', ')}\n¿Guardar de todos modos?`)) { await saveEvent(true); return; }
        toast(result.error); return;
      }
      setForm(null); setNotice('Evento guardado.'); router.refresh();
      if ('id' in result) openDetail(result.id);
    });
  }

  const mutateStatus = (event: EventoRow | EventoDetalle, status: string) => startTransition(async () => {
    const requiresReason = ['CANCELADO', 'EN_PLANIFICACION'].includes(status) || (event.estatus === 'CANCELADO' && status === 'EN_PLANIFICACION');
    const motivo = requiresReason ? window.prompt('Escribe el motivo:') : null;
    if (requiresReason && !motivo?.trim()) return;
    let result = await transitionEventAction({ id: event.id, expectedVersion: event.version, estatus: status, motivo: motivo ?? '' });
    if (!result.success && result.code === 'POSIBLE_CRUCE' && window.confirm(`${result.error}\n${(result.cruces ?? []).map((c) => typeof c === 'object' && c && 'nombre' in c ? String(c.nombre) : '').join(', ')}\n¿Continuar?`)) {
      result = await transitionEventAction({ id: event.id, expectedVersion: event.version, estatus: status, motivo: motivo ?? '', confirmarCruce: true });
    }
    if (!result.success) { toast(result.error); return; }
    setNotice('Estado actualizado.'); setDetail(null); router.refresh();
  });

  const moveEvent = (id: string, day: string) => {
    const event = rows.find((r) => r.id === id);
    if (!event?.inicio || !event.fin || !props.permissions.update || !['EN_PLANIFICACION', 'PROGRAMADO'].includes(event.estatus)) return;
    const localStart = toCaracasInput(event.inicio)!;
    const newStart = caracasInputToIso(`${day}T${localStart.slice(11, 16)}`);
    if (!newStart) return;
    const duration = Date.parse(event.fin) - Date.parse(event.inicio);
    const newEnd = new Date(Date.parse(newStart) + duration).toISOString();
    const motivo = event.estatus === 'PROGRAMADO' ? window.prompt('Motivo de la reprogramación:') : null;
    if (event.estatus === 'PROGRAMADO' && !motivo?.trim()) return;
    startTransition(async () => {
      let result = await rescheduleEventAction({ id, expectedVersion: event.version, inicio: newStart, fin: newEnd, motivo: motivo ?? '' });
      if (!result.success && result.code === 'POSIBLE_CRUCE' && window.confirm(`${result.error}\n¿Continuar con el cruce?`)) {
        result = await rescheduleEventAction({ id, expectedVersion: event.version, inicio: newStart, fin: newEnd, motivo: motivo ?? '', confirmarCruce: true });
      }
      if (!result.success) { toast(result.error); return; }
      setNotice('Evento reprogramado.'); router.refresh();
    });
  };

  const handleArchive = (event: EventoDetalle) => startTransition(async () => {
    const result = event.archivado_en ? await restoreEventAction(event.id, event.version) : await archiveEventAction(event.id, event.version);
    if (!result.success) { toast(result.error); return; }
    setDetail(null); setNotice(event.archivado_en ? 'Evento restaurado.' : 'Evento archivado.'); router.refresh();
  });

  const navLinks = <div className="flex flex-wrap gap-2">{[
    ['/events/calendar', 'Calendario', 'month'], ['/events/calendar/list', 'Listado', 'list'], ['/events/calendar/archive', 'Archivo', 'archive'],
  ].map(([href, label, key]) => <Link key={href} href={url(href, { fecha: key === 'month' ? month : '', vista: '' })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${props.mode === key || (props.mode === 'week' && key === 'month') ? 'bg-[#073b78] text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{label}</Link>)}</div>;

  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#0066d2]">Eventos</p><h1 className="mt-1 text-2xl font-bold text-[#10233f]">{props.mode === 'archive' ? 'Archivo de eventos' : props.mode === 'list' ? 'Listado de eventos' : 'Programación'}</h1><p className="mt-1 text-sm text-slate-500">Planifica actividades en las tiendas y consulta su estado.</p></div>
      {props.permissions.create && props.mode !== 'archive' && <button onClick={() => openForm()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#ed8b19] px-4 font-bold text-[#2E1600] hover:bg-amber-500"><Plus size={18}/> Nuevo evento</button>}
    </header>
    {notice && <div role="status" className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={16}/></button></div>}
    <div className="flex flex-wrap items-center justify-between gap-3">{navLinks}<form action="/events/calendar/list" className="flex flex-wrap gap-2">
      <select name="sede" defaultValue={selectedSede} aria-label="Filtrar por tienda" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todas las tiendas</option>{props.sedes.map((s) => <option key={s.id} value={s.codigo}>{s.nombre}</option>)}</select>
      <select name="estatus" defaultValue={props.filters.estatus} aria-label="Filtrar por estado" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todos los estados</option>{EVENTO_ESTATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      <select name="tipo" defaultValue={props.filters.tipo} aria-label="Filtrar por tipo" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todos los tipos</option>{EVENTO_TIPOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      <select name="origen" defaultValue={props.filters.origen} aria-label="Filtrar por origen" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Todos los orígenes</option>{EVENTO_ORIGENES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search size={16} className="text-slate-400"/><input name="q" defaultValue={props.filters.q} placeholder="Buscar eventos" className="w-36 text-sm outline-none"/></label>
      <button className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">Filtrar</button>
    </form></div>
    {props.initialError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{props.initialError}</div>}
    {!props.initialError && rows.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><CalendarDays className="mx-auto text-slate-400"/><h2 className="mt-3 font-bold text-slate-800">No hay eventos para mostrar</h2><p className="mt-1 text-sm text-slate-500">Prueba cambiar los filtros o crea el primer evento.</p></div>}
    {rows.length > 0 && props.mode === 'list' || props.mode === 'archive' ? <EventTable rows={rows} openDetail={openDetail} archived={props.mode === 'archive'}/> : null}
    {rows.length > 0 && (props.mode === 'month' || props.mode === 'week') && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div className="flex items-center gap-2"><button onClick={() => monthNav(-1)} className="rounded-md p-2 hover:bg-slate-100" aria-label={props.mode === 'week' ? 'Semana anterior' : 'Mes anterior'}><ChevronLeft size={18}/></button><button onClick={() => monthNav(1)} className="rounded-md p-2 hover:bg-slate-100" aria-label={props.mode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}><ChevronRight size={18}/></button><h2 className="ml-2 font-bold capitalize text-slate-800">{props.mode === 'week' ? `${idDate(range.from)} – ${idDate(new Date(range.from.getTime() + 6 * 86400000))}` : new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))}</h2></div><Link href={url('/events/calendar', { fecha: props.mode === 'week' ? month : props.month, vista: props.mode === 'week' ? '' : 'semana' })} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"><Clock3 size={16}/>{props.mode === 'week' ? 'Vista mensual' : 'Vista semanal'}</Link></div>
      {props.mode === 'week' ? <WeekTimeline from={range.from} events={visibleRows} openDetail={openDetail} onMove={moveEvent} canMove={props.permissions.update} onCreate={(key) => { const d = `${key}T09:00`; const v = blankForm(props.currentUserId); v.inicio = d; v.fin = `${key}T10:00`; v.sedes = props.filters.sede ? [{ sede_id: props.filters.sede, zona: '' }] : []; setForm({ value: v }); }} canCreate={props.permissions.create}/> : <>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} className="py-3">{d}</div>)}</div>
        <div className="grid grid-cols-7">{Array.from({ length: range.days }, (_, index) => { const day = new Date(range.from.getTime() + index * 86400000); const key = idDate(day); const dayEvents = visibleRows.filter((e) => e.inicio && e.fin && eventDate(e.inicio) <= key && eventDate(e.fin) >= key); const inMonth = key.slice(0, 7) === month; return <div key={key} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/event-id'); if (id) moveEvent(id, key); }} className={`min-h-28 border-b border-r border-slate-100 p-2 ${!inMonth ? 'bg-slate-50/70 text-slate-400' : ''}`}><div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold">{day.getUTCDate()}</span>{props.permissions.create && inMonth && <button aria-label={`Crear evento el ${key}`} onClick={() => { const d = `${key}T09:00`; const v = blankForm(props.currentUserId); v.inicio = d; v.fin = `${key}T10:00`; v.sedes = props.filters.sede ? [{ sede_id: props.filters.sede, zona: '' }] : []; setForm({ value: v }); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Plus size={14}/></button>}</div><div className="space-y-1">{dayEvents.slice(0, 4).map((e) => <button key={e.id} draggable={props.permissions.update && ['EN_PLANIFICACION', 'PROGRAMADO'].includes(e.estatus)} onDragStart={(ev) => ev.dataTransfer.setData('text/event-id', e.id)} onClick={() => openDetail(e.id)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-semibold ${STATUS_COLOR[e.estatus]}`} title={`${e.nombre} · ${formatEventDate(e.inicio, { hour: '2-digit', minute: '2-digit' })}`}>{e.inicio && <span>{formatEventDate(e.inicio, { hour: '2-digit', minute: '2-digit' })} </span>}{e.nombre}</button>)}{dayEvents.length > 4 && <p className="text-[10px] text-slate-500">+{dayEvents.length - 4} más</p>}</div></div>; })}</div>
      </>}
    </div>}
    <div className="flex items-center justify-between text-xs text-slate-500"><span>{props.total} evento{props.total === 1 ? '' : 's'} · Fechas en hora de Caracas</span>{(props.mode === 'list' || props.mode === 'archive') && props.total > 100 && <div className="flex gap-2"><Link aria-disabled={props.filters.page <= 1} href={url(props.mode === 'archive' ? '/events/calendar/archive' : '/events/calendar/list', { page: props.filters.page > 1 ? String(props.filters.page - 1) : '' })} className={`rounded border px-3 py-2 ${props.filters.page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>Anterior</Link><span className="self-center">Página {props.filters.page}</span><Link href={url(props.mode === 'archive' ? '/events/calendar/archive' : '/events/calendar/list', { page: String(props.filters.page + 1) })} className="rounded border px-3 py-2">Siguiente</Link></div>}</div>
    {form && <EventForm form={form.value} set={updateValue} sedes={props.sedes} responsables={props.responsables} campaigns={props.campaigns} canUpdate={!!form.id && props.permissions.update} pending={pending} onClose={() => setForm(null)} onSave={() => saveEvent(false)} />}
    {detail && <EventDetail event={detail.evento} history={detail.historial} permissions={props.permissions} pending={pending} onClose={() => setDetail(null)} onEdit={() => openForm(detail.evento)} onStatus={mutateStatus} onArchive={() => handleArchive(detail.evento)} onClosure={() => setClosure(true)} onDesignRequest={() => mutateEventDesign(detail.evento, false)} onDesignRetract={() => mutateEventDesign(detail.evento, true)} />}
    {closure && detail && <ClosureForm event={detail.evento} pending={pending} onClose={() => setClosure(false)} onSave={(value) => startTransition(async () => { const result = await saveEventClosureAction({ id: detail.evento.id, expectedVersion: detail.evento.version, ...value }); if (!result.success) { toast(result.error); return; } setClosure(false); setDetail(null); router.refresh(); })} />}
    {pending && <div className="fixed bottom-4 right-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">Guardando…</div>}
  </section>;
}

function EventTable({ rows, openDetail, archived }: { rows: EventoRow[]; openDetail: (id: string) => void; archived: boolean }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tiendas</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Presupuesto</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((e) => <tr key={e.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(e.id)}><td className="px-4 py-3"><span className="font-semibold text-slate-800">{e.nombre}</span><span className="block text-xs text-slate-500">{e.tipo === 'OTRO' ? e.tipo_otro : EVENTO_TIPOS.find((t) => t.value === e.tipo)?.label} · {e.origen === 'PROVEEDOR' ? e.proveedor_nombre : 'Propio'}</span></td><td className="px-4 py-3">{formatEventDate(e.inicio)}</td><td className="px-4 py-3">{e.sedes.map((s) => s.nombre).join(', ') || '—'}</td><td className="px-4 py-3">{e.responsable_nombre ?? 'Sin asignar'}</td><td className="px-4 py-3">{fmtMoney(e.presupuesto_estimado)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[e.estatus]}`}>{EVENTO_ESTATUS_LABEL[e.estatus]}</span>{archived && e.archivado_en && <span className="ml-2 text-xs text-slate-400">Archivado</span>}</td></tr>)}</tbody></table></div></div>;
}

function WeekTimeline({ from, events, openDetail, onMove, canMove, onCreate, canCreate }: { from: Date; events: EventoRow[]; openDetail: (id: string) => void; onMove: (id: string, day: string) => void; canMove: boolean; onCreate: (day: string) => void; canCreate: boolean }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(from.getTime() + i * 86400000));
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  return <div className="overflow-x-auto"><div className="grid min-w-[900px]" style={{ gridTemplateColumns: '58px repeat(7, minmax(110px, 1fr))', gridTemplateRows: `42px repeat(${hours.length}, 54px)` }}>
    <div className="border-b border-r bg-slate-50" style={{ gridColumn: 1, gridRow: 1 }} />
    {days.map((day, i) => { const key = idDate(day); return <div key={key} className="flex items-center justify-between border-b border-r bg-slate-50 px-2 text-xs font-semibold text-slate-700" style={{ gridColumn: i + 2, gridRow: 1 }}><span>{new Intl.DateTimeFormat('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(day)}</span>{canCreate && <button aria-label={`Crear evento ${key}`} onClick={() => onCreate(key)} className="rounded p-1 hover:bg-slate-200"><Plus size={14}/></button>}</div>; })}
    {hours.map((hour, i) => <div key={hour} className="border-b border-r pr-2 pt-1 text-right text-[10px] text-slate-400" style={{ gridColumn: 1, gridRow: i + 2 }}>{String(hour).padStart(2, '0')}:00</div>)}
    {days.flatMap((day, dayIndex) => {
      const key = idDate(day);
      return events.filter((e) => e.inicio && e.fin && eventDate(e.inicio) <= key && eventDate(e.fin) >= key).map((e) => {
        const startsToday = eventDate(e.inicio) === key;
        const startHour = startsToday ? Number(toCaracasInput(e.inicio)!.slice(11, 13)) : 7;
        const endHour = eventDate(e.fin!) > key ? 23 : Number(toCaracasInput(e.fin)!.slice(11, 13));
        const startRow = Math.max(0, Math.min(15, startHour - 7));
        const span = Math.max(1, Math.min(16 - startRow, endHour - Math.max(7, startHour) + (Number(toCaracasInput(e.fin)!.slice(14, 16)) > 0 ? 1 : 0)));
        return <button key={`${key}-${e.id}`} draggable={canMove && startsToday && ['EN_PLANIFICACION', 'PROGRAMADO'].includes(e.estatus)} onDragStart={(ev) => ev.dataTransfer.setData('text/event-id', e.id)} onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData('text/event-id'); if (id) onMove(id, key); }} onClick={() => openDetail(e.id)} title={`${e.nombre} · ${formatEventDate(e.inicio)}`} className={`z-10 m-1 overflow-hidden rounded-lg border border-white/70 p-1.5 text-left text-[11px] font-semibold shadow-sm ${STATUS_COLOR[e.estatus]}`} style={{ gridColumn: dayIndex + 2, gridRow: `${startRow + 2} / span ${span}` }}><span className="block truncate">{startsToday ? formatEventDate(e.inicio, { hour: '2-digit', minute: '2-digit' }) : 'En curso'}</span><span className="line-clamp-2">{e.nombre}</span><span className="block truncate font-normal">{e.sedes.map((s) => s.nombre).join(', ')}</span></button>;
      });
    })}
    {days.flatMap((day, dayIndex) => hours.map((hour, hourIndex) => <div key={`${dayIndex}-${hour}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/event-id'); if (id) onMove(id, idDate(day)); }} className="border-b border-r border-slate-100" style={{ gridColumn: dayIndex + 2, gridRow: hourIndex + 2 }} />))}
  </div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}{children}</label>; }
const inputClass = 'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function EventForm({ form, set, sedes, responsables, campaigns, pending, onClose, onSave }: { form: FormValue; set: (key: keyof FormValue, value: unknown) => void; sedes: EventoSedeCatalogo[]; responsables: EventoResponsable[]; campaigns: { id: string; nombre: string }[]; canUpdate: boolean; pending: boolean; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label="Formulario de evento"><div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Programación</p><h2 className="text-xl font-bold">{form.nombre ? 'Editar evento' : 'Nuevo evento'}</h2></div><button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-slate-100"><X/></button></div><div className="grid gap-4 p-5 sm:grid-cols-2">
    <Field label="Nombre *"><input className={inputClass} maxLength={160} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} /></Field>
    <Field label="Tipo *"><select className={inputClass} value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>{EVENTO_TIPOS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
    {form.tipo === 'OTRO' && <Field label="Especifica el tipo *"><input className={inputClass} maxLength={60} value={form.tipo_otro} onChange={(e) => set('tipo_otro', e.target.value)} /></Field>}
    <Field label="Origen *"><select className={inputClass} value={form.origen} onChange={(e) => set('origen', e.target.value)}>{EVENTO_ORIGENES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
    {form.origen === 'PROVEEDOR' && <Field label="Proveedor *"><input className={inputClass} maxLength={120} value={form.proveedor_nombre} onChange={(e) => set('proveedor_nombre', e.target.value)} /></Field>}
    <Field label="Inicio"><input type="datetime-local" className={inputClass} value={form.inicio} onChange={(e) => set('inicio', e.target.value)} /></Field>
    <Field label="Fin"><input type="datetime-local" className={inputClass} value={form.fin} onChange={(e) => set('fin', e.target.value)} /></Field>
    <Field label="Responsable"><select className={inputClass} value={form.responsable_id} onChange={(e) => set('responsable_id', e.target.value)}><option value="">Sin asignar</option>{responsables.map((r) => <option key={r.user_id} value={r.user_id}>{r.email ?? r.full_name ?? r.user_id}</option>)}</select></Field>
    <Field label="Presupuesto estimado (USD)"><input type="number" min="0" step="0.01" className={inputClass} value={form.presupuesto_estimado} onChange={(e) => set('presupuesto_estimado', e.target.value)} /></Field>
    <section className="sm:col-span-2 space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4" aria-labelledby="event-design-fields">
      <div><h3 id="event-design-fields" className="font-bold text-slate-800">Solicitud de diseño</h3><p className="text-xs text-slate-600">Las instrucciones son obligatorias. El brief se puede adjuntar después.</p></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.requiere_diseno} onChange={(e) => set('requiere_diseno', e.target.checked)} />Este evento requiere diseño</label>
      {form.requiere_diseno && <><div className="flex flex-wrap gap-4 text-sm">{(['DIGITAL', 'IMPRESION'] as const).map((format) => <label key={format} className="flex items-center gap-2"><input type="checkbox" checked={form.diseno_formatos.includes(format)} onChange={(e) => set('diseno_formatos', e.target.checked ? [...form.diseno_formatos, format] : form.diseno_formatos.filter((item) => item !== format))}/>{format === 'IMPRESION' ? 'Impresión' : 'Digital'}</label>)}</div><Field label="Instrucciones para Diseño *"><textarea rows={4} maxLength={4000} className={inputClass} value={form.instrucciones_diseno} onChange={(e) => set('instrucciones_diseno', e.target.value)} /></Field><Field label="Fecha en que debe estar listo *"><input type="date" className={inputClass} min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })} max={form.inicio.slice(0, 10) || undefined} value={form.fecha_entrega_diseno} onChange={(e) => set('fecha_entrega_diseno', e.target.value)} /><span className="text-xs font-normal text-slate-500">{form.inicio ? `Sugerencia: ${suggestedEventDesignDate(form.inicio)}. Puedes elegir otra fecha.` : 'Asigna primero la fecha del evento.'}</span></Field></>}
    </section>
    <Field label="Campaña relacionada"><select className={inputClass} value={form.campana_id} onChange={(e) => set('campana_id', e.target.value)}><option value="">Sin campaña</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
    <div className="sm:col-span-2"><Field label="Tiendas *"><div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">{sedes.map((s) => { const checked = form.sedes.some((x) => x.sede_id === s.id); return <div key={s.id} className="flex items-center gap-2"><input id={`sede-${s.id}`} type="checkbox" checked={checked} onChange={(e) => set('sedes', e.target.checked ? [...form.sedes, { sede_id: s.id, zona: '' }] : form.sedes.filter((x) => x.sede_id !== s.id))} /><label htmlFor={`sede-${s.id}`} className="text-sm">{s.nombre}</label>{checked && <input aria-label={`Zona en ${s.nombre}`} placeholder="Zona (opcional)" className={`${inputClass} ml-auto max-w-48`} value={form.sedes.find((x) => x.sede_id === s.id)?.zona ?? ''} onChange={(e) => set('sedes', form.sedes.map((x) => x.sede_id === s.id ? { ...x, zona: e.target.value } : x))} />}</div>; })}</div></Field></div>
    <div className="sm:col-span-2"><Field label="Descripción"><textarea rows={3} maxLength={2000} className={inputClass} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></Field></div>
    <div className="sm:col-span-2"><Field label="Materiales (texto libre)"><textarea rows={3} maxLength={2000} className={inputClass} value={form.materiales} onChange={(e) => set('materiales', e.target.value)} placeholder="Materiales necesarios y cantidades…" /></Field></div>
    <div className="sm:col-span-2"><Field label="Patrocinadores (texto libre)"><textarea rows={3} maxLength={2000} className={inputClass} value={form.patrocinadores} onChange={(e) => set('patrocinadores', e.target.value)} /></Field></div>
    <div className="sm:col-span-2"><Field label="Motivo de reprogramación (si cambian fecha u horario)"><input maxLength={300} className={inputClass} value={form.motivo} onChange={(e) => set('motivo', e.target.value)} /></Field></div>
    <Field label="Asistencia esperada"><input type="number" min="0" step="1" className={inputClass} value={form.asistentes_esperados} onChange={(e) => set('asistentes_esperados', e.target.value)} /></Field>
    <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" checked={form.requiere_inscripcion} onChange={(e) => set('requiere_inscripcion', e.target.checked)} />Requiere inscripción</label>
    {form.requiere_inscripcion && <><Field label="Cupo"><input type="number" min="1" step="1" className={inputClass} value={form.inscripcion_cupo} onChange={(e) => set('inscripcion_cupo', e.target.value)} /></Field><Field label="Fecha límite"><input type="datetime-local" className={inputClass} value={form.inscripcion_limite} onChange={(e) => set('inscripcion_limite', e.target.value)} /></Field><div className="sm:col-span-2"><Field label="Información de inscripción"><textarea maxLength={500} rows={2} className={inputClass} value={form.inscripcion_info} onChange={(e) => set('inscripcion_info', e.target.value)} /></Field></div></>}
  </div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button><button disabled={pending} onClick={onSave} className="rounded-lg bg-[#073b78] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Guardar evento</button></div></div></div>;
}

function EventDetail({ event, history, permissions, pending, onClose, onEdit, onStatus, onArchive, onClosure, onDesignRequest, onDesignRetract }: { event: EventoDetalle; history: EventoHistorial[]; permissions: EventoPermisos; pending: boolean; onClose: () => void; onEdit: () => void; onStatus: (e: EventoDetalle, status: string) => void; onArchive: () => void; onClosure: () => void; onDesignRequest: () => void; onDesignRetract: () => void }) {
  const action = (label: string, status: string, cls = 'border-slate-300') => <button key={status} disabled={pending} onClick={() => onStatus(event, status)} className={`rounded-lg border ${cls} px-3 py-2 text-sm font-semibold`}>{label}</button>;
  const historyLabel = (h: EventoHistorial) => h.tipo === 'ESTATUS'
    ? EVENTO_ESTATUS_LABEL[String(h.nuevo.estatus) as keyof typeof EVENTO_ESTATUS_LABEL] ?? 'Estado actualizado'
    : h.tipo === 'REPROGRAMACION' ? 'Evento reprogramado'
      : `Diseño: ${String(h.nuevo.estatus ?? 'solicitud retirada').replaceAll('_', ' ').toLowerCase()}`;
  return <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label={`Detalle de ${event.nombre}`}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4"><div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLOR[event.estatus]}`}>{EVENTO_ESTATUS_LABEL[event.estatus]}</span><h2 className="mt-2 text-xl font-bold">{event.nombre}</h2></div><button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X/></button></div><div className="space-y-5 p-5">
    {Object.entries(event.indicadores ?? {}).filter(([, v]) => v).length > 0 && <div className="flex flex-wrap gap-2">{Object.entries(event.indicadores ?? {}).filter(([, v]) => v).map(([k]) => <span key={k} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{{ proximo: 'Próximo', fecha_vencida: 'Fecha vencida', incompleto: 'Incompleto', materiales_sin_declarar: 'Materiales sin declarar', cierre_pendiente: 'Cierre pendiente', diseno_atrasado: 'Diseño atrasado', diseno_posterior_al_evento: 'Entrega posterior al evento', diseno_sin_solicitar: 'Diseño sin solicitar' }[k as keyof EventoIndicadores]}</span>)}</div>}
    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><Info label="Inicio" value={formatEventDate(event.inicio)}/><Info label="Fin" value={formatEventDate(event.fin)}/><Info label="Responsable" value={event.responsable_nombre ?? 'Sin asignar'}/><Info label="Presupuesto" value={fmtMoney(event.presupuesto_estimado)}/><Info label="Tipo" value={event.tipo === 'OTRO' ? event.tipo_otro ?? 'Otro' : EVENTO_TIPOS.find((x) => x.value === event.tipo)?.label ?? event.tipo}/><Info label="Origen" value={event.origen === 'PROVEEDOR' ? `Proveedor · ${event.proveedor_nombre}` : 'Propio'}/></div>
    <section><h3 className="mb-2 font-bold">Tiendas</h3><div className="flex flex-wrap gap-2">{event.sedes.map((s) => <span key={s.sede_id} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm"><MapPin size={14}/>{s.nombre}{s.zona ? ` · ${s.zona}` : ''}</span>)}</div></section>
    {event.descripcion && <TextBlock title="Descripción" text={event.descripcion}/>}<TextBlock title="Materiales" text={event.materiales}/><TextBlock title="Patrocinadores" text={event.patrocinadores}/>
    {event.requiere_inscripcion && <section className="rounded-xl border p-4"><h3 className="font-bold">Inscripción</h3><p className="mt-1 text-sm">{event.inscripcion_cupo ? `Cupo ${event.inscripcion_cupo}` : 'Cupo abierto'}{event.inscripcion_limite ? ` · Límite ${formatEventDate(event.inscripcion_limite)}` : ''}</p>{event.inscripcion_info && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{event.inscripcion_info}</p>}</section>}
    {(event.estatus === 'TERMINADO' || event.asistentes_reales != null || event.gasto_real != null || event.notas_cierre) && <section className="rounded-xl border p-4"><h3 className="font-bold">Cierre</h3><p className="mt-2 text-sm">Asistentes: {event.asistentes_reales ?? 'Sin registrar'} · Gasto: {fmtMoney(event.gasto_real)}</p>{event.notas_cierre && <p className="mt-2 whitespace-pre-wrap text-sm">{event.notas_cierre}</p>}{permissions.update && !event.archivado_en && event.estatus === 'TERMINADO' && <button onClick={onClosure} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold">Registrar cierre</button>}</section>}
    {event.cruces?.length > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 className="font-bold text-amber-950">Cruces de horario</h3>{event.cruces.map((c) => <p key={`${c.evento_id}-${c.sede_id}`} className="mt-1 text-sm">{c.nombre} · {c.sede_nombre} · {formatEventDate(c.inicio)}</p>)}</section>}
    {event.requiere_diseno && <section className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-bold text-slate-900">Diseño</h3><p className="text-sm">Estado: <strong>{event.diseno_estatus ?? 'Sin solicitar'}</strong></p><p className="text-sm">Formatos: {(event.diseno_formatos ?? []).map((format) => format === 'IMPRESION' ? 'Impresión' : 'Digital').join(', ') || 'Sin formatos'}</p><p className="text-sm">Fecha de entrega: {event.fecha_entrega_diseno ?? 'Sin definir'}</p><p className="whitespace-pre-wrap text-sm">{event.instrucciones_diseno || 'Sin instrucciones'}</p>{event.disenador_nombre && <p className="text-sm">Diseñador: {event.disenador_nombre}</p>}{event.drive_brief_file_count > 0 && <p className="text-sm">Archivos de brief: {event.drive_brief_file_count}</p>}{permissions.design && !event.archivado_en && (event.diseno_estatus === null || event.diseno_estatus === 'CANCELADO') && ['EN_PLANIFICACION','PROGRAMADO'].includes(event.estatus) && <button disabled={pending} onClick={onDesignRequest} className="rounded-lg bg-[#073b78] px-3 py-2 text-sm font-semibold text-white">Solicitar a Design</button>}{permissions.design && event.diseno_estatus === 'SOLICITADO' && <button disabled={pending} onClick={onDesignRetract} className="rounded-lg border px-3 py-2 text-sm font-semibold">Retirar solicitud</button>}</section>}
    <section><h3 className="mb-2 font-bold">Historial</h3>{history.length ? <ol className="space-y-3 border-l border-slate-200 pl-4">{history.map((h) => <li key={h.id} className="relative text-sm before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-blue-500"><p className="font-semibold">{historyLabel(h)}</p><p className="text-xs text-slate-500">{formatEventDate(h.cambiado_en)} · {h.cambiado_por_nombre ?? 'Sistema'}{h.motivo ? ` · ${h.motivo}` : ''}</p></li>)}</ol> : <p className="text-sm text-slate-500">Sin cambios registrados.</p>}</section>
    <div className="flex flex-wrap gap-2 border-t pt-4">{permissions.update && !event.archivado_en && !['TERMINADO', 'CANCELADO'].includes(event.estatus) && <button onClick={onEdit} className="rounded-lg bg-[#073b78] px-3 py-2 text-sm font-bold text-white">Editar evento</button>}{permissions.status && !event.archivado_en && event.estatus === 'EN_PLANIFICACION' && action('Programar', 'PROGRAMADO', 'border-blue-200 bg-blue-50 text-blue-800')}{permissions.status && !event.archivado_en && event.estatus === 'PROGRAMADO' && action('Volver a planificación', 'EN_PLANIFICACION')}{permissions.status && !event.archivado_en && event.estatus === 'CANCELADO' && action('Volver a planificación', 'EN_PLANIFICACION')}{permissions.status && !event.archivado_en && ['EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO'].includes(event.estatus) && action('Cancelar evento', 'CANCELADO', 'border-rose-200 bg-rose-50 text-rose-800')}{permissions.status && !event.archivado_en && event.estatus === 'EN_CURSO' && action('Terminar ahora', 'TERMINADO', 'border-emerald-200 bg-emerald-50 text-emerald-800')}{permissions.update && !event.archivado_en && event.estatus === 'TERMINADO' && <button onClick={onClosure} className="rounded-lg border px-3 py-2 text-sm font-semibold">Registrar cierre</button>}{permissions.archive && (event.estatus === 'TERMINADO' || event.estatus === 'CANCELADO') && <button onClick={onArchive} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">{event.archivado_en ? <RotateCcw size={15}/> : <Archive size={15}/>} {event.archivado_en ? 'Restaurar' : 'Archivar'}</button>}</div>
  </div></aside></div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 font-semibold text-slate-800">{value}</p></div>; }
function TextBlock({ title, text }: { title: string; text: string | null }) { return <section><h3 className="mb-1 font-bold">{title}</h3><p className="whitespace-pre-wrap text-sm text-slate-700">{text || 'Sin declarar'}</p></section>; }
function ClosureForm({ event, pending, onClose, onSave }: { event: EventoDetalle; pending: boolean; onClose: () => void; onSave: (v: { asistentes: number | null; gasto: number | null; notas: string }) => void }) {
  const [asistentes, setAsistentes] = useState(event.asistentes_reales == null ? '' : String(event.asistentes_reales)); const [gasto, setGasto] = useState(event.gasto_real == null ? '' : String(event.gasto_real)); const [notas, setNotas] = useState(event.notas_cierre ?? '');
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Registrar cierre"><div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-blue-700">Cierre</p><h2 className="text-lg font-bold">{event.nombre}</h2></div><button onClick={onClose} aria-label="Cerrar"><X/></button></div><Field label="Asistentes reales"><input type="number" min="0" step="1" className={inputClass} value={asistentes} onChange={(e) => setAsistentes(e.target.value)}/></Field><Field label="Gasto real (USD)"><input type="number" min="0" step="0.01" className={inputClass} value={gasto} onChange={(e) => setGasto(e.target.value)}/></Field><Field label="Notas de cierre"><textarea rows={4} maxLength={2000} className={inputClass} value={notas} onChange={(e) => setNotas(e.target.value)}/></Field><div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={pending} onClick={() => onSave({ asistentes: asistentes.trim() ? Number(asistentes) : null, gasto: gasto.trim() ? Number(gasto) : null, notas })} className="rounded-lg bg-[#073b78] px-4 py-2 text-sm font-bold text-white">Guardar cierre</button></div></div></div>;
}
