'use client';

import { FormEvent, ReactNode, CSSProperties, useId, useState, useTransition } from 'react';
import { Loader2, X } from 'lucide-react';
import { EstatusEnum, FormatoEnum, PublicacionConCuentas, SocialAccountOption } from '@/types';
import type { CampanaPublicacionGrid } from '@/app/actions/campanas/campaigns';
import { editPublicacionAction, EditPublicacionInput } from '@/app/actions/publicaciones/edit';
import { ESTATUS_STYLE, FORMATO_LABEL_UPPER, getFormatoDisplayLabel } from '../utils/constants';
import { ContentCategorySelector } from './ContentCategorySelector';
import type { ContentCategoryOption } from './ContentCategorySelector';
import { SocialAccountSelector } from '../../components/SocialAccountSelector';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';
import { parseHashtags } from '@/utils/hashtags';

const FORMATOS: FormatoEnum[] = ['CARRUSEL', 'POST', 'REEL', 'STORY'];
const controlClass = 'ui-control w-full rounded-lg px-3 py-2 text-sm';
const controlStyle: CSSProperties = { background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' };
const TABS = [
  { label: 'Contenido', enabled: true },
  { label: 'Producci\u00f3n', enabled: false },
  { label: 'Flujo y SLA', enabled: true },
  { label: 'Historial', enabled: false },
] as const;
type EditTab = (typeof TABS)[number]['label'];

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pendiente';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Pendiente';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' }).format(date);
}

interface Props {
  publicacion: PublicacionConCuentas;
  campanas: CampanaPublicacionGrid[];
  categories: ContentCategoryOption[];
  accounts: SocialAccountOption[];
  onClose: () => void;
  onSaved: (publicacion: PublicacionConCuentas) => void;
}

export function TicketEditModal({ publicacion, campanas, categories, accounts, onClose, onSaved }: Props) {
  const formId = useId();
  const [activeTab, setActiveTab] = useState<EditTab>('Contenido');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [titulo, setTitulo] = useState(publicacion.titulo);
  const [formato, setFormato] = useState(publicacion.formato);
  const [categoryIds, setCategoryIds] = useState(() => (publicacion.linea_contenido || '').split(', ').flatMap((name) => {
    const category = categories.find((item) => item.nombre === name);
    return category ? [category.id] : [];
  }));
  const [fechaPublicacion, setFechaPublicacion] = useState(publicacion.fecha_publicacion);
  const [horaPublicacion, setHoraPublicacion] = useState(publicacion.hora_publicacion?.slice(0, 5) || '');
  const [hook, setHook] = useState(publicacion.hook_texto || '');
  const [body, setBody] = useState(publicacion.body_texto || '');
  const [cta, setCta] = useState(publicacion.cta_texto || '');
  const [hashtags, setHashtags] = useState((publicacion.hashtags || []).join(', '));
  const [campanaId, setCampanaId] = useState(publicacion.campana_id || '');
  const [socialAccountIds, setSocialAccountIds] = useState(publicacion.social_account_ids);
  const [copyFeedback, setCopyFeedback] = useState('');
  const slaWillChange = publicacion.fecha_publicacion !== fechaPublicacion;
  const selectedAccounts = socialAccountIds.map((id) => accounts.find((account) => account.id === id)?.platform);

  const field = (label: string, control: ReactNode, full = false) => (
    <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>{label}</label>
      {control}
    </div>
  );

  const transition = async (status: EstatusEnum, reason?: string) => {
    setError('');
    const result = await transitionPublicationAction({ publicationId: publicacion.id, status, reason });
    if (!result.success) { setError(result.error); return; }
    onSaved({ ...publicacion, estatus: status,
      fecha_solicitud_diseno: status === 'SOLICITADO' && !publicacion.fecha_solicitud_diseno ? new Date().toISOString() : publicacion.fecha_solicitud_diseno,
      fecha_entrega_diseno_real: status === 'EN_REVISION_CM' ? new Date().toISOString() : publicacion.fecha_entrega_diseno_real,
      fecha_aprobacion_gerencia: status === 'APROBADO' ? new Date().toISOString() : publicacion.fecha_aprobacion_gerencia,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!titulo.trim() || !fechaPublicacion) {
      setError('El título y la fecha de publicación son obligatorios.');
      setActiveTab('Contenido');
      return;
    }
    const input: EditPublicacionInput = {
      publicacionId: publicacion.id,
      titulo,
      formato,
      categoria_ids: categoryIds,
      social_account_ids: socialAccountIds,
      fecha_publicacion: fechaPublicacion,
      hora_publicacion: horaPublicacion || null,
      fecha_solicitud_diseno: publicacion.fecha_solicitud_diseno,
      fecha_entrega_diseno_real: publicacion.fecha_entrega_diseno_real,
      fecha_aprobacion_gerencia: publicacion.fecha_aprobacion_gerencia,
      estatus: publicacion.estatus,
      hook_texto: hook,
      body_texto: body,
      cta_texto: cta,
      hashtags: parseHashtags(hashtags),
      campana_id: campanaId || null,
    };

    startTransition(async () => {
      const result = await editPublicacionAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved({ ...result.data, linea_contenido: categories.filter((category) => categoryIds.includes(category.id)).map((category) => category.nombre).join(', ') || null });
    });
  };

  const copyCaption = async () => {
    const caption = [hook, body, cta, parseHashtags(hashtags).join(' ')].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(caption);
      setCopyFeedback('Texto copiado.');
    } catch {
      setCopyFeedback('No se pudo copiar el texto.');
    }
  };


  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="shrink-0 border-b border-slate-200 px-5 pt-4 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Editar publicación</p>
              <h2 id={`${formId}-title`} className="mt-1 break-words text-xl font-bold text-slate-900">{publicacion.titulo}</h2>
              <div className="mt-2 flex flex-wrap gap-2 pb-3">
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: ESTATUS_STYLE[publicacion.estatus].bgVar, color: ESTATUS_STYLE[publicacion.estatus].textVar }}>{ESTATUS_STYLE[publicacion.estatus].label}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{getFormatoDisplayLabel(formato, selectedAccounts)} · {formatDate(fechaPublicacion)}</span>
              </div>
            </div>
            <button type="button" disabled={isPending} onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
          </div>
          <nav aria-label="Secciones de edición" role="tablist" className="-mb-px flex gap-5 overflow-x-auto">
            {TABS.map(({ label, enabled }) => <button key={label} type="button" role="tab" aria-selected={activeTab === label} aria-disabled={!enabled} disabled={!enabled} title={!enabled ? 'Fuera del alcance actual' : undefined} onClick={() => enabled && setActiveTab(label)} className={`shrink-0 border-b-2 px-1 py-3 text-sm font-semibold transition ${activeTab === label ? 'border-blue-700 text-slate-900' : enabled ? 'border-transparent text-slate-500 hover:text-slate-800' : 'cursor-not-allowed border-transparent text-slate-300'}`}>{label}</button>)}
          </nav>
        </header>

        <form id={`${formId}-form`} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

            {activeTab === 'Contenido' && <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
                {field('Título *', <input required maxLength={200} value={titulo} onChange={(event) => setTitulo(event.target.value)} className={controlClass} style={controlStyle} />)}
                {field('Formato *', <select value={formato} onChange={(event) => { const value = event.target.value as FormatoEnum; setFormato(value); if (value === 'STORY') setSocialAccountIds((ids) => ids.filter((id) => accounts.find((account) => account.id === id)?.platform !== 'YOUTUBE')); }} className={controlClass} style={controlStyle}>{FORMATOS.map((value) => <option key={value} value={value}>{value === 'REEL' ? getFormatoDisplayLabel(value, selectedAccounts) : FORMATO_LABEL_UPPER[value]}</option>)}</select>)}
                {field('Campaña', <select value={campanaId} onChange={(event) => setCampanaId(event.target.value)} className={controlClass} style={controlStyle}><option value="">Sin campaña</option>{campanas.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.nombre}{campaign.estatus === 'ARCHIVADA' ? ' · Archivada' : ''}</option>)}</select>)}
              </div>
              <ContentCategorySelector categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
              <SocialAccountSelector accounts={accounts} selectedIds={socialAccountIds} onChange={setSocialAccountIds} disableYoutube={formato === 'STORY'} />
              {formato === 'STORY' ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">Las Stories no llevan copy</p><p className="mt-1 text-xs text-slate-600">El texto que ya exista se conserva, pero no aplica a este formato.</p></div> : <section className="space-y-4 border-t border-slate-200 pt-5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Brief de copy</h3>
                {field('Hook', <input value={hook} onChange={(event) => setHook(event.target.value)} className={controlClass} style={controlStyle} />, true)}
                <div className="grid gap-4 md:grid-cols-2">
                  {field('Cuerpo', <textarea rows={8} value={body} onChange={(event) => setBody(event.target.value)} className={`${controlClass} resize-y`} style={controlStyle} />)}
                  {field('CTA', <textarea rows={8} value={cta} onChange={(event) => setCta(event.target.value)} className={`${controlClass} resize-y`} style={controlStyle} />)}
                </div>
                {field('Hashtags · separar por espacio o coma', <div className="space-y-2"><input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#Uno #Dos, #Tres" className={controlClass} style={controlStyle} /><div className="flex flex-wrap gap-1.5">{parseHashtags(hashtags).map((tag) => <span key={tag.toLowerCase()} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">{tag}</span>)}</div></div>, true)}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-700"><span>Caption armado: hook + cuerpo + CTA + hashtags · {[hook, body, cta, parseHashtags(hashtags).join(' ')].filter(Boolean).join(' ').length} caracteres</span><button type="button" onClick={() => void copyCaption()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-blue-700">Vista previa y copiar</button>{copyFeedback && <span role="status" className="text-slate-500">{copyFeedback}</span>}</div>
              </section>}
            </div>}

            {activeTab === 'Flujo y SLA' && <div className="space-y-6">
              <section className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-2">
                {field('Fecha de publicación *', <input type="date" required value={fechaPublicacion} onChange={(event) => setFechaPublicacion(event.target.value)} className={controlClass} style={controlStyle} />)}
                {field('Hora de publicación (opcional)', <input type="time" value={horaPublicacion} onChange={(event) => setHoraPublicacion(event.target.value)} className={controlClass} style={controlStyle} />)}
              </section>
              <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado actual</p><p className="mt-1 text-base font-bold text-slate-900">{ESTATUS_STYLE[publicacion.estatus].label}</p></div></div>
                {publicacion.estatus === 'EN_REVISION_CM' && <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="block space-y-1 text-xs font-semibold text-amber-950">Observación para Design<textarea rows={3} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className={controlClass} placeholder="Describe los cambios necesarios." /></label>
                  <button type="button" disabled={isPending || !correctionReason.trim()} onClick={() => startTransition(() => transition('EN_CORRECCION', correctionReason))} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Pedir corrección</button>
                </div>}
                {publicacion.estatus === 'EN_REVISION_CM' && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={isPending} onClick={() => startTransition(() => transition('PENDIENTE_APROBACION_GERENCIA'))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Por aprobación</button><button type="button" disabled={isPending} onClick={() => startTransition(() => transition('PROGRAMADO'))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Programado</button><button type="button" disabled={isPending} onClick={() => startTransition(() => transition('PUBLICADO'))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Publicado</button></div>}
                {publicacion.estatus === 'PENDIENTE_APROBACION_GERENCIA' && <button type="button" disabled={isPending} onClick={() => startTransition(() => transition('APROBADO'))} className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Registrar aprobación recibida</button>}
                {publicacion.estatus === 'APROBADO' && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={isPending} onClick={() => startTransition(() => transition('PROGRAMADO'))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Programado</button><button type="button" disabled={isPending} onClick={() => startTransition(() => transition('PUBLICADO'))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Publicado</button></div>}
                {publicacion.estatus === 'PROGRAMADO' && <button type="button" disabled={isPending} onClick={() => startTransition(() => transition('PUBLICADO'))} className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Confirmar publicado</button>}
                {publicacion.estatus !== 'CANCELADO' && <div className="mt-4 space-y-2 rounded-lg border border-red-200 p-3"><label className="block space-y-1 text-xs font-semibold text-red-800">Motivo de cancelación<textarea rows={2} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={controlClass} placeholder="Motivo obligatorio para cancelar desde cualquier estado." /></label><button type="button" disabled={isPending || !cancelReason.trim()} onClick={() => startTransition(() => transition('CANCELADO', cancelReason))} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Cancelar publicación</button></div>}
                <p className="mt-4 text-xs text-slate-500">Las fechas reales se registran automáticamente al solicitar, entregar o aprobar; no se editan aquí.</p>
              </section>
              <section><h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">SLA de producción</h3><div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-900">Brief</p><p className="mt-1 text-sm font-bold text-emerald-950">{formatDate(slaWillChange ? null : publicacion.fecha_limite_brief)}</p><p className="text-xs text-emerald-800">{slaWillChange ? 'Se recalcula al guardar' : 'Límite calculado'}</p></div>
                <div className="rounded-lg bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-700">Rodaje</p><p className="mt-1 text-sm font-bold text-slate-900">{publicacion.requiere_rodaje ? formatDate(publicacion.fecha_rodaje) : 'No requerido'}</p><p className="text-xs text-slate-600">{publicacion.requiere_rodaje ? 'Fecha sugerida' : 'Actívalo en Producción'}</p></div>
                <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Diseño</p><p className="mt-1 text-sm font-bold text-amber-950">{publicacion.fecha_solicitud_diseno ? formatDate(publicacion.fecha_entrega_diseno_estimada) : 'Sin solicitud'}</p><p className="text-xs text-amber-800">{publicacion.fecha_solicitud_diseno ? 'Entrega estimada' : 'Se calcula al solicitar'}</p></div>
              </div></section>
              <section><h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Fechas del flujo · hora de Caracas</h3><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Publicación', formatDate(fechaPublicacion)],
                  ['Límite del brief · automático', slaWillChange ? 'Se recalculará al guardar' : formatDate(publicacion.fecha_limite_brief)],
                  ['Solicitud de diseño · real', formatTimestamp(publicacion.fecha_solicitud_diseno)],
                  ['Entrega de diseño · estimada', formatDate(publicacion.fecha_entrega_diseno_estimada)],
                  ['Entrega de diseño · real', formatTimestamp(publicacion.fecha_entrega_diseno_real)],
                  ['Aprobación · real', formatTimestamp(publicacion.fecha_aprobacion_gerencia)],
                ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>)}
              </dl></section>
            </div>}

          </main>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-7">
            <p className="hidden text-[11px] text-slate-500 sm:block">Creado {formatTimestamp(publicacion.created_at)} · Actualizado {formatTimestamp(publicacion.updated_at)}</p>
            <div className="ml-auto flex gap-2"><button type="button" disabled={isPending} onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancelar</button><button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}{isPending ? 'Guardando…' : 'Guardar cambios'}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
