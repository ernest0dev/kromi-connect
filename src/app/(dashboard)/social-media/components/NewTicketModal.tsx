'use client';

import React, { useEffect, useId, useState, useTransition } from 'react';
import { X, Loader2, TriangleAlert, FolderPlus } from 'lucide-react';
import { FormatoEnum, PublicacionConCuentas, SedeEnum, SocialAccountOption } from '@/types';
import { createPostWithDriveAction } from '@/app/actions/publicaciones/create';
import { ContentCategorySelector } from '../grid/components/ContentCategorySelector';
import type { ContentCategoryOption } from '../grid/components/ContentCategorySelector';
import type { CampanaPublicacionGrid } from '@/app/actions/campanas/campaigns';
import { SocialAccountSelector } from './SocialAccountSelector';
import { parseHashtags } from '@/utils/hashtags';
import { calcularMatrizSLA } from '@/utils/sla';
import { getFormatoDisplayLabel } from '../grid/utils/constants';
import { todayInCaracas } from '../grid/utils/today';
import { retryPublicacionDriveFolderAction } from '@/app/actions/publicaciones/drive';
import { PublicationDriveFiles } from '../grid/components/PublicationDriveFiles';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (publicacion: PublicacionConCuentas) => void;
  categories: ContentCategoryOption[];
  campaigns: CampanaPublicacionGrid[];
  accounts: SocialAccountOption[];
  initialDate?: string;
}

const FORMATO_OPCIONES: { value: FormatoEnum; label: string; hint: string }[] = [
  { value: 'REEL', label: 'Reel', hint: '9:16' },
  { value: 'CARRUSEL', label: 'Carrusel', hint: '1:1 / 4:5' },
  { value: 'POST', label: 'Post', hint: '1:1' },
  { value: 'STORY', label: 'Story', hint: '9:16' },
];

const LAST_ACCOUNTS_KEY = 'kromi:last-social-account-ids';

const inputStyle: React.CSSProperties = {
  background: 'var(--hueso)',
  borderColor: 'var(--borde)',
  color: 'var(--tinta)',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}

export default function NuevoTicketModal({ isOpen, onClose, onCreated, categories, campaigns, accounts, initialDate }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formId = useId();

  const [titulo, setTitulo] = useState('');
  const [formato, setFormato] = useState<FormatoEnum>('REEL');
  const [fechaPublicacion, setFechaPublicacion] = useState(initialDate || '');
  const [horaPublicacion, setHoraPublicacion] = useState('');

  const [copyTexto, setCopyTexto] = useState('');
  const [hashtagsRaw, setHashtagsRaw] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [campanaId, setCampanaId] = useState('');
  const [socialAccountIds, setSocialAccountIds] = useState<string[]>([]);
  const [requiereDiseno, setRequiereDiseno] = useState(true);
  const [instruccionesDiseno, setInstruccionesDiseno] = useState('');
  const [requiereRodaje, setRequiereRodaje] = useState(false);
  const [sedes, setSedes] = useState<SedeEnum[]>([]);
  const [prioridad, setPrioridad] = useState(2);
  const [drivePendingPost, setDrivePendingPost] = useState<PublicacionConCuentas | null>(null);
  const [createdBriefPost, setCreatedBriefPost] = useState<PublicacionConCuentas | null>(null);
  const fechaLimiteBrief = fechaPublicacion ? calcularMatrizSLA(fechaPublicacion).fecha_limite_brief : null;
  const briefVencido = requiereDiseno && !!fechaLimiteBrief && fechaLimiteBrief < todayInCaracas();

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => setFechaPublicacion(initialDate || ''), 0);
    return () => window.clearTimeout(timer);
  }, [initialDate, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (accounts.length === 1) { setSocialAccountIds([accounts[0].id]); return; }
      try {
        const saved = JSON.parse(window.localStorage.getItem(LAST_ACCOUNTS_KEY) || '[]');
        const valid = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && accounts.some((account) => account.id === id)) : [];
        setSocialAccountIds(valid);
      } catch {
        setSocialAccountIds([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accounts, isOpen]);

  if (!isOpen) return null;

  if (createdBriefPost) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby={`${formId}-brief-title`} className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><header><h2 id={`${formId}-brief-title`} className="text-lg font-bold text-slate-900">Publicación creada</h2><p className="mt-1 text-sm text-slate-600">{createdBriefPost.titulo} · agrega los archivos del brief ahora o continúa después desde el detalle.</p></header><PublicationDriveFiles publicationId={createdBriefPost.id} onBriefState={(count,checkedAt)=>{const updated={...createdBriefPost,drive_brief_file_count:Math.min(count,10),drive_brief_checked_at:checkedAt};setCreatedBriefPost(updated);onCreated?.(updated);}}/><div className="flex justify-end"><button type="button" onClick={()=>{setCreatedBriefPost(null);onClose();}} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Listo</button></div></section></div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!titulo || !fechaPublicacion) {
      setErrorMessage('El título y la fecha de publicación son requeridos.');
      return;
    }
    if (!socialAccountIds.length) {
      setErrorMessage('Selecciona al menos una cuenta de destino.');
      return;
    }

    const hashtagsArray = parseHashtags(hashtagsRaw);

    startTransition(async () => {
      const res = await createPostWithDriveAction({
        titulo,
        formato,
        categoria_ids: categoryIds,
        social_account_ids: socialAccountIds,
        campana_id: campanaId || null,
        fecha_publicacion: fechaPublicacion,
        hora_publicacion: horaPublicacion || null,
        requiere_diseno: requiereDiseno,
        instrucciones_diseno: instruccionesDiseno,
        requiere_rodaje: requiereRodaje,
        sedes,
        prioridad,
        body_texto: formato === 'STORY' ? undefined : copyTexto || undefined,
        hashtags: formato === 'STORY' ? [] : hashtagsArray,
      });

      if (res.success) {
        try { window.localStorage.setItem(LAST_ACCOUNTS_KEY, JSON.stringify(socialAccountIds)); } catch { /* preferencia opcional */ }
        setTitulo('');
        setFechaPublicacion('');
        setHoraPublicacion('');
        setCopyTexto('');
        setHashtagsRaw('');
        setCategoryIds([]);
        setCampanaId('');
        setSocialAccountIds([]);
        setRequiereDiseno(true);
        setInstruccionesDiseno('');
        setRequiereRodaje(false);
        setSedes([]);
        setPrioridad(2);
        if (res.data) onCreated?.(res.data);
        if (res.data && !res.data.drive_folder_id) setDrivePendingPost(res.data);
        else if (res.data && requiereDiseno) setCreatedBriefPost(res.data);
        else onClose();
      } else {
        setErrorMessage(res.error || 'Ocurrió un error al crear la publicación.');
      }
    });
  };

  const retryDrive = () => {
    if (!drivePendingPost) return;
    startTransition(async () => {
      const result = await retryPublicacionDriveFolderAction(drivePendingPost.id);
      if (!result.success) { setErrorMessage(result.error); return; }
      onCreated?.({ ...drivePendingPost, drive_folder_id: result.data.drive_folder_id, drive_folder_url: result.data.drive_folder_url });
      setDrivePendingPost(null);
      if (drivePendingPost.requiere_diseno) setCreatedBriefPost({ ...drivePendingPost, drive_folder_id: result.data.drive_folder_id, drive_folder_url: result.data.drive_folder_url });
      else onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border"
        style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--borde)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}>
              Nueva publicación
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gris)' }}>
              Organiza el contenido, define su destino y prepara el brief.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--gris)' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Formulario: el contenido hace scroll; error y acciones quedan fijos abajo */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {drivePendingPost && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><span>La publicación quedó guardada. Drive está pendiente; puedes reintentar la carpeta ahora o cerrar.</span><button type="button" disabled={isPending} onClick={retryDrive} className="shrink-0 rounded-lg bg-amber-700 px-3 py-2 font-bold text-white disabled:opacity-50">{isPending ? 'Creando…' : 'Reintentar Drive'}</button></div>}

          {/* Bloque 1: Información principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor={`${formId}-titulo`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Título de la publicación *
              </label>
              <input
                id={`${formId}-titulo`}
                type="text"
                required
                placeholder="Reel ofertas de charcutería Prebo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none"
                style={inputStyle}
              />
            </div>

            <fieldset className="space-y-2 md:col-span-2"><legend className="mb-2 text-xs font-semibold text-slate-800">Formato *</legend><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{FORMATO_OPCIONES.map((option) => <button key={option.value} type="button" aria-pressed={formato === option.value} onClick={() => { setFormato(option.value); if (option.value === 'STORY') setSocialAccountIds((ids) => ids.filter((id) => accounts.find((account) => account.id === id)?.platform !== 'YOUTUBE')); }} className={`rounded-lg border p-3 text-left transition ${formato === option.value ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700' : 'border-slate-200 bg-white hover:border-blue-300'}`}><span className="block text-sm font-bold text-slate-900">{option.value === 'REEL' ? getFormatoDisplayLabel(option.value, socialAccountIds.map((id) => accounts.find((account) => account.id === id)?.platform)) : option.label}</span><span className="mt-1 block text-[11px] text-slate-500">{option.value === 'POST' || option.value === 'CARRUSEL' ? '4:5' : '9:16'} · {option.hint === '4:5' ? '1080 × 1350' : option.value === 'CARRUSEL' || option.value === 'POST' ? '1080 × 1350' : '1080 × 1920'}</span></button>)}</div></fieldset>

            {formato === 'STORY' && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2">Story es solo imagen/diseño y no lleva copy.</p>}

            <div className="md:col-span-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_1fr_.7fr]">
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-campaign`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>Campaña (opcional)</label>
                <select id={`${formId}-campaign`} value={campanaId} onChange={(event) => setCampanaId(event.target.value)} className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none" style={inputStyle}>
                  <option value="">Sin campaña</option>
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.nombre}{campaign.estatus === 'ARCHIVADA' ? ' · Archivada' : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
              <label htmlFor={`${formId}-fecha`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Fecha de publicación *
              </label>
              <input
                id={`${formId}-fecha`}
                type="date"
                required
                value={fechaPublicacion}
                onChange={(e) => setFechaPublicacion(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none"
                style={inputStyle}
              />
              {fechaPublicacion && <p className="mt-1 text-xs font-semibold text-blue-800">{new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${fechaPublicacion}T12:00:00Z`))}</p>}
              </div>
              <div className="space-y-1.5"><label htmlFor={`${formId}-hora`} className="text-xs font-semibold text-slate-800">Hora (opcional)</label><input id={`${formId}-hora`} type="time" value={horaPublicacion} onChange={(event) => setHoraPublicacion(event.target.value)} className="w-full rounded-lg border px-3.5 py-2.5 text-sm" style={inputStyle} /></div>
              </div>
            </div>
            {fechaPublicacion && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:col-span-2">
              <div className={`rounded-lg border p-3 ${briefVencido ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}><p className="text-xs font-semibold">Límite del brief</p><p className="mt-1 text-sm font-bold">{requiereDiseno ? formatDate(fechaLimiteBrief) : 'No aplica'}</p><p className="text-[11px]">{!requiereDiseno ? 'Material opcional · sin SLA de Design' : briefVencido ? 'Vencido · puedes continuar' : '5 días antes de publicar'}</p></div>
              <div className="rounded-lg bg-slate-100 p-3 text-slate-800"><p className="text-xs font-semibold">Rodaje sugerido</p><p className="mt-1 text-sm font-bold">{requiereRodaje ? formatDate(new Date(new Date(`${fechaPublicacion}T12:00:00Z`).getTime() - 3 * 86400000).toISOString().slice(0, 10)) : 'No requerido'}</p><p className="text-[11px] text-slate-600">{requiereRodaje ? '3 días antes' : 'Actívalo en Producción'}</p></div>
              <div className="rounded-lg bg-slate-100 p-3 text-slate-800"><p className="text-xs font-semibold">Diseño</p><p className="mt-1 text-sm font-bold">{requiereDiseno ? '2 días' : 'No aplica'}</p><p className="text-[11px] text-slate-600">{requiereDiseno ? 'desde la solicitud' : 'flujo directo a aprobación'}</p></div>
            </div>}
            {briefVencido && fechaLimiteBrief && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 md:col-span-2">El brief debía estar listo el {formatDate(fechaLimiteBrief)}. Puedes continuar y guardar igualmente.</p>}
            <ContentCategorySelector categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
            <SocialAccountSelector accounts={accounts} selectedIds={socialAccountIds} onChange={setSocialAccountIds} disableYoutube={formato === 'STORY'} />
          </div>

          <details open className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-800">Producción y diseño</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input type="checkbox" checked={requiereDiseno} onChange={(event) => setRequiereDiseno(event.target.checked)} /><span><span className="block">Requiere diseño de Design</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Desactívalo si Social Media ya tiene el material. La publicación podrá avanzar directamente a aprobación; los archivos de Drive son opcionales.</span></span></label>
            {requiereDiseno && <section className="space-y-3 rounded-xl border border-[#E7E4DC] border-t-4 border-t-[#0066D2] bg-white p-4 sm:col-span-2"><div className="flex flex-wrap items-baseline justify-between gap-2"><label htmlFor={`${formId}-design-instructions`} className="text-sm font-bold text-[#10233F]">Instrucciones para Diseño</label><span className="text-xs text-[#5E6680]">Obligatorias para solicitar a Design</span></div><textarea id={`${formId}-design-instructions`} rows={4} maxLength={4000} value={instruccionesDiseno} onChange={(event) => setInstruccionesDiseno(event.target.value)} placeholder="Describe el objetivo, las referencias, el formato o los detalles que debe respetar Diseño." className="w-full resize-y rounded-lg border px-3.5 py-2.5 text-sm leading-6 focus:border-[#0066D2] focus:outline-none focus:ring-2 focus:ring-[#A9C8EE]" style={inputStyle}/><p className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5E6680]"><span>Al solicitar, las instrucciones quedan fijas. Los cambios posteriores se envían como corrección.</span><span className="shrink-0">{instruccionesDiseno.length}/4000</span></p></section>}
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={requiereRodaje} onChange={(event) => setRequiereRodaje(event.target.checked)} />Requiere rodaje</label>
            {requiereRodaje && <div className="text-xs text-slate-600">Fecha sugerida de rodaje: {fechaPublicacion ? new Date(new Date(`${fechaPublicacion}T00:00:00Z`).getTime() - 3 * 86400000).toISOString().slice(0, 10) : 'se calcula al seleccionar publicación'}</div>}
            <fieldset className="space-y-2 sm:col-span-2"><legend className="text-xs font-semibold text-slate-700">Tiendas donde se graba</legend><div className="flex flex-wrap gap-2">{(['PREBO', 'MANONGO'] as const).map((sede) => { const selected = sedes.includes(sede); return <button key={sede} type="button" aria-pressed={selected} onClick={() => setSedes((current) => selected ? current.filter((item) => item !== sede) : [...current, sede])} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${selected ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700'}`}>{sede === 'MANONGO' ? 'Mañongo' : 'Prebo'}</button>; })}</div><p className="text-[11px] text-slate-500">Puedes elegir más de una tienda.</p></fieldset>
            <label className="space-y-1 text-xs font-semibold text-slate-700">Prioridad<select value={prioridad} onChange={(event) => setPrioridad(Number(event.target.value))} className="ui-control w-full rounded-lg px-3 py-2 text-sm"><option value={1}>Alta</option><option value={2}>Normal</option><option value={3}>Baja</option></select></label>
          </div></details>

          {/* Bloque 2: Copy */}
          {formato !== 'STORY' && <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--borde)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gris)' }}>
              Copy de la publicación
            </h3>

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-copy`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Texto (gancho, mensaje y llamada a la acción)
              </label>
              <textarea
                id={`${formId}-copy`}
                rows={8}
                placeholder={'3 cortes de carne que estás comprando mal\n\nDetalle de las ofertas…\n\nVisítanos en Prebo o Mañongo'}
                value={copyTexto}
                onChange={(e) => setCopyTexto(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none resize-y"
                style={inputStyle}
              />
              <p className="flex justify-between gap-2 text-[11px] text-slate-500"><span>Escríbelo tal como se publicará. Separa los párrafos con una línea en blanco.</span><span className="shrink-0">{copyTexto.length} caracteres</span></p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-hashtags`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Hashtags
              </label>
              <input
                id={`${formId}-hashtags`}
                type="text"
                placeholder="#KromiMarket #Prebo, #Ofertas"
                value={hashtagsRaw}
                onChange={(e) => setHashtagsRaw(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2 text-sm border focus:outline-none"
                style={inputStyle}
              />
              <p className="text-[11px] text-slate-500">Separa con espacios o comas. Se agrega # y se quitan duplicados.</p>
              <div className="flex flex-wrap gap-1">{parseHashtags(hashtagsRaw).map((tag) => <span key={tag.toLowerCase()} className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-800">{tag}</span>)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"><b>Vista previa</b><p className="mt-2 whitespace-pre-wrap">{[copyTexto, parseHashtags(hashtagsRaw).join(' ')].filter(Boolean).join('\n\n') || 'El texto de la publicación aparecerá aquí.'}</p><p className="mt-2 text-[10px] text-slate-500">Los límites de caracteres se validarán según la plataforma cuando se defina la configuración oficial.</p></div>
          </div>}

          </div>

          {/* Acciones (fijas) */}
          <div className="shrink-0 space-y-3 border-t px-6 py-4" style={{ borderColor: 'var(--borde)', background: 'var(--papel)' }}>
            {errorMessage && (
              <div
                role="alert"
                className="p-3 text-xs rounded-lg flex items-start gap-2 border"
                style={{ background: '#FCEBEB', borderColor: '#F09595', color: '#A32D2D' }}
              >
                <TriangleAlert size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-full text-sm font-semibold transition"
              style={{ background: 'var(--hueso)', color: 'var(--gris)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--azul)', color: '#fff' }}
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  <span>Creando carpeta en Drive…</span>
                </>
              ) : (
                <>
                  <FolderPlus size={14} aria-hidden="true" />
                  <span>Crear publicación</span>
                </>
              )}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
