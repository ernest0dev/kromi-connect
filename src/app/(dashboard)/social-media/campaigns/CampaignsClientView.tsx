"use client";

import React, { FormEvent, useEffect, useState, useTransition } from "react";
import {
  createCampaignAction,
  updateCampaignAction,
  archiveCampaignAction,
  restoreCampaignAction,
  getCampaignsAction,
  saveCampaignEvaluationAction,
  updateCampaignStatusAction,
} from "@/app/actions/campanas/campaigns";
import { getEfemeridesInYearRangeAction } from "@/app/actions/efemerides/efemerides";
import type { Campana, CampanaEstatus, EfemerideCampana } from "@/app/actions/campanas/campaigns";
import type { TipoCampanaEnum } from "@/types/enums";
import { Archive, CalendarDays, ChartNoAxesCombined, Pencil, Plus, RotateCcw } from "lucide-react";

interface Props { campanasIniciales: Campana[] }

const CATEGORIAS: { value: TipoCampanaEnum; label: string }[] = [
  { value: "TEMPORADA", label: "Temporada" },
  { value: "EVENTO", label: "Evento" },
  { value: "EFEMERIDE", label: "Efeméride" },
  { value: "LANZAMIENTO", label: "Lanzamiento" },
  { value: "OFERTA_PUNTUAL", label: "Oferta puntual" },
];
const ESTADOS: { value: CampanaEstatus; label: string }[] = [
  { value: "PLANIFICADA", label: "Planificada" },
  { value: "ACTIVA", label: "Activa" },
  { value: "FINALIZADA", label: "Finalizada" },
];
const inputClass = "ui-control ui-focus-ring mt-1 w-full px-3 py-2.5 text-[13px]";

const emptyCampaignForm = () => ({
  nombre: "", descripcion: "", tipo_campana: "TEMPORADA" as TipoCampanaEnum,
  fecha_inicio: "", fecha_fin: "", presupuesto: "", efemeride_ids: [] as string[],
  confirmar_desvinculacion: false,
});
const emptyEvaluationForm = () => ({
  alcance_total: "", interacciones_totales: "", presupuesto_ejecutado: "",
  informe_cualitativo: "", observaciones: "",
});
const money = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
const dateRangeLabel = (start: string, end: string) => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const shortDate = new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short" });
  const fullDate = new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", year: "numeric" });
  const firstDate = startDate.getFullYear() === endDate.getFullYear() ? shortDate.format(startDate) : fullDate.format(startDate);
  return `${firstDate} – ${fullDate.format(endDate)}`;
};

export default function CampaignsClientView({ campanasIniciales }: Props) {
  const [campanas, setCampanas] = useState<Campana[]>(campanasIniciales);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campana | null>(null);
  const [showArchived, setShowArchived] = useState(true);
  const [evaluationCampaign, setEvaluationCampaign] = useState<Campana | null>(null);
  const [form, setForm] = useState(emptyCampaignForm);
  const [evaluationForm, setEvaluationForm] = useState(emptyEvaluationForm);
  const [efemeridesOptions, setEfemeridesOptions] = useState<EfemerideCampana[]>([]);
  const [efemeridesConocidas, setEfemeridesConocidas] = useState<EfemerideCampana[]>(() =>
    campanasIniciales.flatMap((campaign) => campaign.efemerides || [])
  );
  const [loadingEfemerides, setLoadingEfemerides] = useState(false);
  const [efemeridesLoadError, setEfemeridesLoadError] = useState("");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    if (form.tipo_campana !== "EFEMERIDE") {
      setEfemeridesOptions([]);
      setEfemeridesLoadError("");
      setLoadingEfemerides(false);
      return;
    }
    const startYear = Number(form.fecha_inicio.slice(0, 4));
    const endYear = Number(form.fecha_fin.slice(0, 4));
    if (!form.fecha_inicio || !form.fecha_fin || !Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
      setEfemeridesOptions([]);
      setLoadingEfemerides(false);
      return;
    }
    let active = true;
    setLoadingEfemerides(true);
    setEfemeridesLoadError("");
    getEfemeridesInYearRangeAction(startYear, endYear).then((result) => {
      if (!active) return;
      setEfemeridesOptions(result.data as EfemerideCampana[]);
      setEfemeridesConocidas((current) => {
        const byId = new Map(current.map((efemeride) => [efemeride.id, efemeride]));
        for (const efemeride of result.data) byId.set(efemeride.id, efemeride as EfemerideCampana);
        return [...byId.values()];
      });
      if (!result.success) setEfemeridesLoadError(result.error || "No se pudieron cargar las efemérides.");
      setLoadingEfemerides(false);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setEfemeridesLoadError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las efemérides.");
      setLoadingEfemerides(false);
    });
    return () => { active = false; };
  }, [form.tipo_campana, form.fecha_inicio, form.fecha_fin]);
  const activeCampaigns = campanas.filter((campaign) => campaign.estatus !== "ARCHIVADA");
  const archivedCampaigns = campanas.filter((campaign) => campaign.estatus === "ARCHIVADA");
  const activeCount = activeCampaigns.filter((campaign) => campaign.estatus === "ACTIVA").length;
  const plannedCount = activeCampaigns.filter((campaign) => campaign.estatus === "PLANIFICADA").length;
  const activeBudget = activeCampaigns
    .filter((campaign) => campaign.estatus === "ACTIVA" || campaign.estatus === "PLANIFICADA")
    .reduce((sum, campaign) => sum + (campaign.presupuesto || 0), 0);
  const pendingEvaluations = campanas.filter((campaign) => campaign.estatus === "FINALIZADA" && !campaign.evaluacion).length;

  const refreshCampaigns = async () => {
    const result = await getCampaignsAction();
    if (result.success) setCampanas(result.data);
    else setError(result.error || "No se pudieron actualizar las campañas.");
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const payload = {
        ...form,
        efemeride_ids: form.tipo_campana === "EFEMERIDE" ? form.efemeride_ids : [],
        presupuesto: form.presupuesto ? Number(form.presupuesto) : undefined,
      };
      const result = editingCampaign
        ? await updateCampaignAction(editingCampaign.id, payload)
        : await createCampaignAction(payload);
      if (!result.success) { setError(result.error || "No se pudo guardar la campaña."); return; }
      setShowCreateModal(false);
      setEditingCampaign(null);
      setForm(emptyCampaignForm());
      await refreshCampaigns();
    });
  };

  const efemeridesVisibles = [
    ...efemeridesOptions,
    ...efemeridesConocidas.filter((efemeride) =>
      form.efemeride_ids.includes(efemeride.id) &&
      !efemeridesOptions.some((option) => option.id === efemeride.id)
    ),
  ];

  const openCreate = () => {
    setError("");
    setEditingCampaign(null);
    setForm(emptyCampaignForm());
    setShowCreateModal(true);
  };

  const openEdit = (campaign: Campana) => {
    setError("");
    setEditingCampaign(campaign);
    setForm({
      nombre: campaign.nombre,
      descripcion: campaign.descripcion || "",
      tipo_campana: campaign.tipo_campana,
      fecha_inicio: campaign.fecha_inicio,
      fecha_fin: campaign.fecha_fin,
      presupuesto: campaign.presupuesto?.toString() || "",
      efemeride_ids: campaign.efemerides?.map((efemeride) => efemeride.id) || [],
      confirmar_desvinculacion: false,
    });
    setShowCreateModal(true);
  };

  const handleArchive = (campaign: Campana) => {
    if (!window.confirm(`¿Archivar “${campaign.nombre}”? La campaña se ocultará de la lista activa y podrás restaurarla después.`)) return;
    setError("");
    startTransition(async () => {
      const result = await archiveCampaignAction(campaign.id);
      if (!result.success) { setError(result.error || "No se pudo archivar la campaña."); return; }
      await refreshCampaigns();
    });
  };

  const handleRestore = (campaign: Campana) => {
    setError("");
    startTransition(async () => {
      const result = await restoreCampaignAction(campaign.id);
      if (!result.success) { setError(result.error || "No se pudo restaurar la campaña."); return; }
      await refreshCampaigns();
    });
  };

  const handleStatusChange = (campaign: Campana, status: CampanaEstatus) => {
    setError("");
    startTransition(async () => {
      const result = await updateCampaignStatusAction(campaign.id, status);
      if (!result.success) { setError(result.error || "No se pudo actualizar el estado."); return; }
      setCampanas((current) => current.map((item) => item.id === campaign.id
        ? { ...item, estatus: status, activo: status !== "FINALIZADA" } : item));
    });
  };

  const openEvaluation = (campaign: Campana) => {
    const report = campaign.evaluacion;
    setEvaluationForm(report ? {
      alcance_total: report.alcance_total?.toString() || "",
      interacciones_totales: report.interacciones_totales?.toString() || "",
      presupuesto_ejecutado: report.presupuesto_ejecutado?.toString() || "",
      informe_cualitativo: report.informe_cualitativo || "",
      observaciones: report.observaciones || "",
    } : emptyEvaluationForm());
    setEvaluationCampaign(campaign);
    setError("");
  };

  const handleSaveEvaluation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!evaluationCampaign) return;
    setError("");
    startTransition(async () => {
      const result = await saveCampaignEvaluationAction({
        campana_id: evaluationCampaign.id,
        alcance_total: evaluationForm.alcance_total ? Number(evaluationForm.alcance_total) : null,
        interacciones_totales: evaluationForm.interacciones_totales ? Number(evaluationForm.interacciones_totales) : null,
        presupuesto_ejecutado: evaluationForm.presupuesto_ejecutado ? Number(evaluationForm.presupuesto_ejecutado) : null,
        informe_cualitativo: evaluationForm.informe_cualitativo,
        observaciones: evaluationForm.observaciones,
      });
      if (!result.success) { setError(result.error || "No se pudo guardar el informe."); return; }
      setEvaluationCampaign(null);
      await refreshCampaigns();
    });
  };

  return (
    <div className="campaigns-page mx-auto max-w-[1400px] space-y-6">
      <header className="campaigns-header">
        <div>
          <span className="ui-eyebrow">Planificación · Social media</span>
          <h2>Campañas</h2>
          <p>Agrupa publicaciones por temporada, evento o lanzamiento y evalúa su resultado al cerrar.</p>
        </div>
        <button type="button" onClick={openCreate} disabled={isPending} className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#ed8b19] px-3.5 py-2 text-sm font-bold text-[#2E1600] transition hover:brightness-95 disabled:opacity-50" aria-haspopup="dialog">
          <Plus size={16} aria-hidden="true" /> Nueva campaña
        </button>
      </header>

      <section className="campaigns-summary" aria-label="Resumen de campañas">
        <article className="ui-card campaigns-summary-card"><strong className="summary-green">{activeCount}</strong><span>Campañas activas</span></article>
        <article className="ui-card campaigns-summary-card"><strong className="summary-blue">{plannedCount}</strong><span>Planificadas</span></article>
        <article className="ui-card campaigns-summary-card"><strong>{money(activeBudget)}</strong><span>Presupuesto activo total</span></article>
        <article className="ui-card campaigns-summary-card"><strong className="summary-orange">{pendingEvaluations}</strong><span>Finalizadas sin evaluación</span></article>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-xs text-rose-300">{error}</p>}

      <div className="campaigns-section-label"><h2>Campañas activas y planificadas</h2><span>{activeCampaigns.length} campañas</span></div>
      <div className="campaigns-grid">
        {activeCampaigns.length === 0 ? (
          <div className="ui-empty-state campaigns-empty-state col-span-full">No hay campañas registradas actualmente.</div>
        ) : activeCampaigns.map((campaign) => (
          <article key={campaign.id} className={`campaign-card status-${campaign.estatus.toLowerCase()}`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="campaign-category">{CATEGORIAS.find((item) => item.value === campaign.tipo_campana)?.label || campaign.tipo_campana}</span>
                  <span className={`ui-status-badge ${campaign.estatus === "ACTIVA" ? "ui-status-active" : campaign.estatus === "PLANIFICADA" ? "ui-status-planned" : "ui-status-finished"}`}>{ESTADOS.find((item) => item.value === campaign.estatus)?.label || campaign.estatus}</span>
                </div>
              </div>
              <h3 className="text-base font-bold text-white">{campaign.nombre}</h3>
              <div className="campaign-description-wrap">
                <p className="campaign-description">{!campaign.descripcion ? "Sin descripcion." : campaign.descripcion.length <= 120 || expandedDescriptions[campaign.id] ? campaign.descripcion : `${campaign.descripcion.slice(0, 120).trimEnd()}…`}</p>
                {campaign.descripcion && campaign.descripcion.length > 120 && <button type="button" className="campaign-read-more" onClick={() => setExpandedDescriptions((current) => ({ ...current, [campaign.id]: !current[campaign.id] }))}>{expandedDescriptions[campaign.id] ? "Leer menos" : "Leer más"}</button>}
              </div>
              <div className="campaign-dates">
                <CalendarDays size={15} aria-hidden="true" />
                <span>{dateRangeLabel(campaign.fecha_inicio, campaign.fecha_fin)}</span>
              </div>
              {!!campaign.efemerides?.length && <div className="flex flex-wrap gap-1.5" aria-label="Efemérides vinculadas">
                {campaign.efemerides.map((efemeride) => <span key={efemeride.id} className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] text-white/90">{efemeride.nombre} · {efemeride.anio}</span>)}
              </div>}
            </div>

            <section className="campaign-metrics">
              <div><span>Presupuesto</span><strong>{money(campaign.presupuesto)}</strong></div>
              <div><span>Publicaciones</span><strong>{campaign.publicaciones?.length || 0} vinculadas</strong></div>
            </section>


            {campaign.estatus === "ACTIVA" && !campaign.evaluacion && <div className="campaign-postmortem-pending"><span aria-hidden="true">!</span> Sin evaluacion post-mortem todavia</div>}

            {campaign.estatus === "FINALIZADA" && (campaign.evaluacion ? (
              <div className="campaign-postmortem-summary">
                <ChartNoAxesCombined size={14} aria-hidden="true" />
                <span>Alcance: {campaign.evaluacion.alcance_total?.toLocaleString("es-VE") ?? "—"} · Interacciones: {campaign.evaluacion.interacciones_totales?.toLocaleString("es-VE") ?? "—"}</span>
              </div>
            ) : <div className="campaign-postmortem-pending">Evaluación pendiente</div>)}

            <div className="campaign-card-actions">
              <select aria-label={`Estado de ${campaign.nombre}`} value={campaign.estatus} disabled={isPending} onChange={(event) => handleStatusChange(campaign, event.target.value as CampanaEstatus)} className={inputClass}>
                {ESTADOS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
              <div className="campaign-icon-actions">
                <button aria-label="Evaluar campaña" title="Evaluar campaña" disabled={isPending || campaign.estatus === "PLANIFICADA"} onClick={() => openEvaluation(campaign)} className="campaign-icon-button eval-btn"><ChartNoAxesCombined size={16} aria-hidden="true" /></button>
                <button aria-label="Editar campaña" title="Editar campaña" disabled={isPending} onClick={() => openEdit(campaign)} className="campaign-icon-button"><Pencil size={15} aria-hidden="true" /></button>
                <button aria-label="Archivar campaña" title="Archivar campaña" disabled={isPending} onClick={() => handleArchive(campaign)} className="campaign-icon-button"><Archive size={15} aria-hidden="true" /></button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="campaigns-archive-section">
        <button type="button" onClick={() => setShowArchived((value) => !value)} aria-expanded={showArchived} className="campaigns-archive-toggle">
          <span className="text-sm font-bold text-slate-200">Campañas archivadas <span className="ml-1 text-xs font-normal text-slate-500">({archivedCampaigns.length})</span></span>
          <span className="text-xs text-slate-400">{showArchived ? "Ocultar" : "Mostrar"}</span>
        </button>
        {showArchived && <div className="campaigns-archive-list">
          {archivedCampaigns.length === 0 ? <p className="py-3 text-center text-xs text-slate-500">No hay campañas archivadas.</p> :
            <div className="campaigns-archived-grid">{archivedCampaigns.map((campaign) => <article key={campaign.id} className="campaign-archived-card">
              <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-slate-200">{campaign.nombre}</h3></div>
              <p className="mt-1 text-[11px] text-slate-500">{CATEGORIAS.find((item) => item.value === campaign.tipo_campana)?.label} · {dateLabel(campaign.fecha_inicio)} – {dateLabel(campaign.fecha_fin)}</p>
              {!!campaign.efemerides?.length && <p className="mt-1 text-[10px] text-slate-400">Efemérides: {campaign.efemerides.map((item) => `${item.nombre} (${item.anio})`).join(", ")}</p>}
              <div className="campaign-archived-actions"><button aria-label="Editar campaña" title="Editar campaña" disabled={isPending} onClick={() => openEdit(campaign)}><Pencil size={14} aria-hidden="true" /></button><button aria-label="Restaurar campaña" title="Restaurar campaña" disabled={isPending} onClick={() => handleRestore(campaign)}><RotateCcw size={14} aria-hidden="true" /></button></div>
            </article>)}</div>}
        </div>}
      </section>

      {showCreateModal && <div className="campaign-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="create-campaign-title" className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
          <h3 id="create-campaign-title" className="text-base font-bold text-white">{editingCampaign ? "Editar campaña" : "Crear nueva campaña"}</h3>
          <form onSubmit={handleCreate} className="campaign-form">
            <label className="block text-xs text-slate-400">Nombre<input type="text" required maxLength={120} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className={`${inputClass} mt-1`} placeholder="ej. Aniversario 2026" /></label>
            <div className="campaign-form-row">
              <label>Categoría<select required value={form.tipo_campana} onChange={(event) => {
                const tipo = event.target.value as TipoCampanaEnum;
                setForm({ ...form, tipo_campana: tipo, confirmar_desvinculacion: false });
              }} className={inputClass}>{CATEGORIAS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label>Presupuesto (USD)<input type="number" min="0" step="0.01" value={form.presupuesto} onChange={(event) => setForm({ ...form, presupuesto: event.target.value })} className={inputClass} placeholder="0.00" /></label>
            </div>
            <div className="campaign-form-row">
              <label>Fecha de inicio<input type="date" required value={form.fecha_inicio} onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value })} className={inputClass} /></label>
              <label>Fecha de fin<input type="date" required min={form.fecha_inicio || undefined} value={form.fecha_fin} onChange={(event) => setForm({ ...form, fecha_fin: event.target.value })} className={inputClass} /></label>
            </div>
            {form.tipo_campana === "EFEMERIDE" && <section className="campaign-form-full space-y-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3" aria-label="Efemérides asociadas">
              <div>
                <h4 className="text-xs font-bold text-slate-100">Efemérides vinculadas</h4>
                <p className="mt-1 text-[11px] text-slate-400">Se muestran las efemérides de los años que abarca esta campaña. Puedes elegir varias.</p>
              </div>
              {!form.fecha_inicio || !form.fecha_fin ? <p className="text-[11px] text-amber-300">Indica primero las fechas de la campaña.</p> : loadingEfemerides ? <p role="status" className="text-[11px] text-slate-400">Cargando efemérides…</p> : efemeridesLoadError ? <p role="alert" className="text-[11px] text-rose-300">{efemeridesLoadError}</p> : efemeridesVisibles.length === 0 ? <p className="text-[11px] text-slate-400">No hay efemérides registradas para esos años.</p> : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {efemeridesVisibles.map((efemeride) => {
                    const selected = form.efemeride_ids.includes(efemeride.id);
                    const startYear = Number(form.fecha_inicio.slice(0, 4));
                    const endYear = Number(form.fecha_fin.slice(0, 4));
                    const outsideRange = efemeride.anio < startYear || efemeride.anio > endYear;
                    return <label key={efemeride.id} className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[11px] ${outsideRange ? "bg-amber-950/40 text-amber-200" : "text-slate-200 hover:bg-white/5"}`}>
                      <input type="checkbox" checked={selected} disabled={outsideRange && !selected || isPending} onChange={(event) => setForm({ ...form, efemeride_ids: event.target.checked ? [...form.efemeride_ids, efemeride.id] : form.efemeride_ids.filter((id) => id !== efemeride.id) })} className="mt-0.5 accent-emerald-500" />
                      <span>{efemeride.nombre}<span className="ml-1 text-slate-400">· {efemeride.anio}</span>{outsideRange && <span className="ml-1">(fuera del rango; desmarca para desvincular)</span>}</span>
                    </label>;
                  })}
                </div>
              )}
            </section>}
            {editingCampaign?.tipo_campana === "EFEMERIDE" && form.tipo_campana !== "EFEMERIDE" && !!editingCampaign.efemerides?.length && <label className="campaign-form-full flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-[11px] text-amber-200">
              <input type="checkbox" checked={form.confirmar_desvinculacion} onChange={(event) => setForm({ ...form, confirmar_desvinculacion: event.target.checked })} className="mt-0.5 accent-amber-400" />
              <span>Esta campaña tiene {editingCampaign.efemerides.length} efeméride(s) vinculada(s). Confirmo que al cambiar la categoría se quitarán esos vínculos.</span>
            </label>}
            <label className="campaign-form-full">Descripción<textarea value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} className={inputClass} rows={3} /></label>
            {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowCreateModal(false); setEditingCampaign(null); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white">Cancelar</button>
              <button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg disabled:opacity-50">{isPending ? "Guardando…" : editingCampaign ? "Guardar cambios" : "Guardar campaña"}</button>
            </div>
          </form>
        </div>
      </div>}

      {evaluationCampaign && <div className="campaign-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="evaluation-title" className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
          <div><h3 id="evaluation-title" className="text-base font-bold text-white">Post-mortem: {evaluationCampaign.nombre}</h3><p className="mt-1 text-xs text-slate-400">Guarda una nueva evaluación. El historial anterior se conserva.</p></div>
          <form onSubmit={handleSaveEvaluation} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 campaign-evaluation-fields">
              <label className="text-[11px] text-slate-400">Alcance<input type="number" min="0" step="1" value={evaluationForm.alcance_total} onChange={(event) => setEvaluationForm({ ...evaluationForm, alcance_total: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[11px] text-slate-400">Interacciones<input type="number" min="0" step="1" value={evaluationForm.interacciones_totales} onChange={(event) => setEvaluationForm({ ...evaluationForm, interacciones_totales: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[11px] text-slate-400">Gasto (USD)<input type="number" min="0" step="0.01" value={evaluationForm.presupuesto_ejecutado} onChange={(event) => setEvaluationForm({ ...evaluationForm, presupuesto_ejecutado: event.target.value })} className={`${inputClass} mt-1`} /></label>
            </div>
            <label className="block text-xs text-slate-400">Informe cualitativo<textarea rows={4} value={evaluationForm.informe_cualitativo} onChange={(event) => setEvaluationForm({ ...evaluationForm, informe_cualitativo: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <label className="block text-xs text-slate-400">Observaciones<textarea rows={2} value={evaluationForm.observaciones} onChange={(event) => setEvaluationForm({ ...evaluationForm, observaciones: event.target.value })} className={`${inputClass} mt-1`} /></label>
            {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEvaluationCampaign(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white">Cancelar</button>
              <button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg disabled:opacity-50">{isPending ? "Guardando…" : "Guardar informe"}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}
