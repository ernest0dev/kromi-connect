"use client";

import React, { FormEvent, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createEfemerideAction,
  deleteEfemerideAction,
  getEfemeridesByYearAction,
  updateEfemerideAction,
} from "@/app/actions/efemerides/efemerides";
import type { Efemeride } from "@/app/actions/efemerides/efemerides";

interface Props {
  anioInicial: number;
  efemeridesIniciales: Efemeride[];
  errorInicial: string | undefined;
}

const inputClass = "ui-control ui-focus-ring mt-1 w-full px-3 py-2.5 text-[13px]";
const emptyForm = (anio: number) => ({ nombre: "", anio, fecha_inicio: "", fecha_fin: "", descripcion: "" });
const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("es-VE", {
  day: "numeric", month: "long", year: "numeric",
});

export default function EfemeridesClientView({ anioInicial, efemeridesIniciales, errorInicial }: Props) {
  const [anio, setAnio] = useState(anioInicial);
  const [anioDraft, setAnioDraft] = useState(String(anioInicial));
  const [efemerides, setEfemerides] = useState(efemeridesIniciales);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [edicion, setEdicion] = useState<Efemeride | null>(null);
  const [form, setForm] = useState(emptyForm(anioInicial));
  const [error, setError] = useState(errorInicial || "");
  const [isPending, startTransition] = useTransition();

  const cargarAnio = (nuevoAnio: number) => {
    setAnio(nuevoAnio);
    setAnioDraft(String(nuevoAnio));
    setError("");
    startTransition(async () => {
      const result = await getEfemeridesByYearAction(nuevoAnio);
      setEfemerides(result.data);
      if (!result.success) setError(result.error || "No se pudieron cargar las efemérides.");
    });
  };

  const refrescar = async () => {
    const result = await getEfemeridesByYearAction(anio);
    if (result.success) setEfemerides(result.data);
    else setError(result.error || "No se pudieron actualizar las efemérides.");
  };

  const abrirNueva = () => {
    setError("");
    setEdicion(null);
    setForm(emptyForm(anio));
    setModalAbierto(true);
  };

  const abrirEdicion = (efemeride: Efemeride) => {
    setError("");
    setEdicion(efemeride);
    setForm({
      nombre: efemeride.nombre,
      anio: efemeride.anio,
      fecha_inicio: efemeride.fecha_inicio,
      fecha_fin: efemeride.fecha_fin,
      descripcion: efemeride.descripcion || "",
    });
    setModalAbierto(true);
  };

  const guardar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = edicion
        ? await updateEfemerideAction(edicion.id, form)
        : await createEfemerideAction(form);
      if (!result.success) {
        setError(result.error || "No se pudo guardar la efeméride.");
        return;
      }
      setModalAbierto(false);
      if (form.anio !== anio) {
        setAnio(form.anio);
        setAnioDraft(String(form.anio));
      }
      const listResult = await getEfemeridesByYearAction(form.anio);
      if (listResult.success) setEfemerides(listResult.data);
      else setError(listResult.error || "Se guardó, pero no se pudo actualizar la lista.");
    });
  };

  const eliminar = (efemeride: Efemeride) => {
    if (!window.confirm(`¿Eliminar la efeméride “${efemeride.nombre}” de ${efemeride.anio}?`)) return;
    setError("");
    startTransition(async () => {
      const result = await deleteEfemerideAction(efemeride.id);
      if (!result.success) {
        setError(result.error || "No se pudo eliminar la efeméride.");
        return;
      }
      await refrescar();
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="ui-eyebrow block mb-1.75" style={{ color: "var(--azul)" }}>Planificación · Social media</span>
          <h1 className="mb-1.5 text-[21px] font-bold leading-[1.15] md:text-[25px]" style={{ fontFamily: "var(--font-display)", color: "var(--tinta)" }}>Efemérides anuales</h1>
          <p className="text-[13px] ui-text-muted">Administra fechas y periodos conmemorativos de cada año. Son independientes de las campañas.</p>
        </div>
        <button type="button" onClick={abrirNueva} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#ed8b19] px-3.5 py-2 text-sm font-bold text-[#2E1600] hover:brightness-95" aria-haspopup="dialog">
          <Plus size={16} aria-hidden="true" /> Nueva efeméride
        </button>
      </header>

      <section className="ui-card flex flex-wrap items-center justify-between gap-3 p-3.5" aria-label="Seleccionar año">
        <div className="flex items-center gap-2">
          <CalendarDays size={17} className="text-slate-500" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-700">Año de planificación</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Año anterior" disabled={isPending || anio <= 1} onClick={() => cargarAnio(anio - 1)} className="ui-control grid h-9 w-9 place-items-center rounded-lg disabled:opacity-50"><ChevronLeft size={17} /></button>
          <label className="sr-only" htmlFor="efemerides-year">Año</label>
          <input id="efemerides-year" type="number" min="1" max="9999" value={anioDraft} disabled={isPending} onChange={(event) => setAnioDraft(event.target.value)} onBlur={() => {
            const value = Number(anioDraft);
            if (Number.isInteger(value) && value >= 1 && value <= 9999 && value !== anio) cargarAnio(value);
            else setAnioDraft(String(anio));
          }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="ui-control w-25 rounded-lg px-2 py-2 text-center text-sm font-bold" />
          <button type="button" aria-label="Año siguiente" disabled={isPending || anio >= 9999} onClick={() => cargarAnio(anio + 1)} className="ui-control grid h-9 w-9 place-items-center rounded-lg disabled:opacity-50"><ChevronRight size={17} /></button>
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-xs text-rose-300">{error}</p>}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Efemérides de {anio}</h2>
        <span className="ui-badge">{efemerides.length} registradas</span>
      </div>
      {isPending ? <p role="status" className="ui-empty-state">Cargando…</p> : efemerides.length === 0 ? (
        <div className="ui-empty-state flex flex-col items-center gap-3 py-10 text-center">
          <CalendarDays size={24} aria-hidden="true" />
          <p>No hay efemérides registradas para {anio}.</p>
          <button type="button" onClick={abrirNueva} className="text-sm font-bold text-blue-700 hover:underline">Agregar la primera</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {efemerides.map((efemeride) => (
            <article key={efemeride.id} className="ui-card flex min-w-0 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-bold text-slate-900">{efemeride.nombre}</h3>
                  <p className="mt-1 text-xs font-medium text-blue-800">{efemeride.fecha_inicio === efemeride.fecha_fin ? dateLabel(efemeride.fecha_inicio) : `${dateLabel(efemeride.fecha_inicio)} – ${dateLabel(efemeride.fecha_fin)}`}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Editar ${efemeride.nombre}`} onClick={() => abrirEdicion(efemeride)} disabled={isPending} className="ui-control grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:text-blue-700"><Pencil size={14} /></button>
                  <button type="button" aria-label={`Eliminar ${efemeride.nombre}`} onClick={() => eliminar(efemeride)} disabled={isPending} className="ui-control grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:text-rose-700"><Trash2 size={14} /></button>
                </div>
              </div>
              {efemeride.descripcion && <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{efemeride.descripcion}</p>}
            </article>
          ))}
        </div>
      )}

      {modalAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) setModalAbierto(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="efemeride-form-title" className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <div>
            <h2 id="efemeride-form-title" className="text-base font-bold text-slate-900">{edicion ? "Editar efeméride" : "Nueva efeméride"}</h2>
            <p className="mt-1 text-xs text-slate-500">Las fechas deben corresponder al año del registro.</p>
          </div>
          <form onSubmit={guardar} className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">Nombre<input required maxLength={160} autoFocus value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className={inputClass} placeholder="Ej. Día Mundial del Medio Ambiente" /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">Año<input required type="number" min="1" max="9999" value={form.anio} onChange={(event) => setForm({ ...form, anio: Number(event.target.value) })} className={inputClass} /></label>
              <label className="text-xs font-medium text-slate-600">Fecha de inicio<input required type="date" value={form.fecha_inicio} onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value, fecha_fin: !form.fecha_fin || form.fecha_fin < event.target.value ? event.target.value : form.fecha_fin })} className={inputClass} /></label>
              <label className="text-xs font-medium text-slate-600">Fecha de fin<input required type="date" min={form.fecha_inicio || undefined} value={form.fecha_fin} onChange={(event) => setForm({ ...form, fecha_fin: event.target.value })} className={inputClass} /></label>
            </div>
            <label className="block text-xs font-medium text-slate-600">Descripción (opcional)<textarea maxLength={2000} rows={3} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} className={inputClass} /></label>
            {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={isPending} onClick={() => setModalAbierto(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800">Cancelar</button>
              <button type="submit" disabled={isPending} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50">{isPending ? "Guardando…" : edicion ? "Guardar cambios" : "Guardar efeméride"}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}
