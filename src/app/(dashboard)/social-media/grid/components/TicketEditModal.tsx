'use client';

import { FormEvent, ReactNode, CSSProperties, useId, useState, useTransition } from 'react';
import { Loader2, X } from 'lucide-react';
import { EstatusEnum, FormatoEnum, Publicacion } from '@/types';
import type { CampanaPublicacionGrid } from '@/app/actions/campanas/campaigns';
import { editPublicacionAction, EditPublicacionInput } from '@/app/actions/publicaciones/edit';
import { ESTATUS_ORDEN, ESTATUS_STYLE, FORMATO_LABEL_UPPER } from '../utils/constants';

const FORMATOS: FormatoEnum[] = ['CARRUSEL', 'POST', 'REEL', 'STORY'];
const controlClass = 'ui-control w-full rounded-lg px-3 py-2 text-sm';
const controlStyle: CSSProperties = { background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' };

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoTimestamp(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface Props {
  publicacion: Publicacion;
  campanas: CampanaPublicacionGrid[];
  onClose: () => void;
  onSaved: (publicacion: Publicacion) => void;
}

export function TicketEditModal({ publicacion, campanas, onClose, onSaved }: Props) {
  const formId = useId();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [titulo, setTitulo] = useState(publicacion.titulo);
  const [formato, setFormato] = useState(publicacion.formato);
  const [linea, setLinea] = useState(publicacion.linea_contenido || '');
  const [fechaPublicacion, setFechaPublicacion] = useState(publicacion.fecha_publicacion);
  const [fechaSolicitudDiseno, setFechaSolicitudDiseno] = useState(toLocalDateTime(publicacion.fecha_solicitud_diseno));
  const [fechaEntregaReal, setFechaEntregaReal] = useState(toLocalDateTime(publicacion.fecha_entrega_diseno_real));
  const [fechaAprobacion, setFechaAprobacion] = useState(toLocalDateTime(publicacion.fecha_aprobacion_gerencia));
  const [estatus, setEstatus] = useState(publicacion.estatus);
  const [hook, setHook] = useState(publicacion.hook_texto || '');
  const [body, setBody] = useState(publicacion.body_texto || '');
  const [cta, setCta] = useState(publicacion.cta_texto || '');
  const [hashtags, setHashtags] = useState((publicacion.hashtags || []).join(', '));
  const [campanaId, setCampanaId] = useState(publicacion.campana_id || '');
  const slaWillChange = publicacion.fecha_publicacion !== fechaPublicacion
    || toLocalDateTime(publicacion.fecha_solicitud_diseno) !== fechaSolicitudDiseno;

  const field = (label: string, control: ReactNode, full = false) => (
    <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>{label}</label>
      {control}
    </div>
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const input: EditPublicacionInput = {
      publicacionId: publicacion.id,
      titulo,
      formato,
      linea_contenido: linea,
      fecha_publicacion: fechaPublicacion,
      fecha_solicitud_diseno: toIsoTimestamp(fechaSolicitudDiseno),
      fecha_entrega_diseno_real: toIsoTimestamp(fechaEntregaReal),
      fecha_aprobacion_gerencia: toIsoTimestamp(fechaAprobacion),
      estatus,
      hook_texto: hook,
      body_texto: body,
      cta_texto: cta,
      hashtags: hashtags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
      campana_id: campanaId || null,
    };

    startTransition(async () => {
      const result = await editPublicacionAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
    });
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Editar publicación</p>
            <h2 id={`${formId}-title`} className="mt-1 text-lg font-bold text-slate-900">{publicacion.titulo}</h2>
          </div>
          <button type="button" disabled={isPending} onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500">Contenido</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('Título *', <input required maxLength={200} value={titulo} onChange={(event) => setTitulo(event.target.value)} className={controlClass} style={controlStyle} />, true)}
              {field('Formato', <select value={formato} onChange={(event) => setFormato(event.target.value as FormatoEnum)} className={controlClass} style={controlStyle}>{FORMATOS.map((value) => <option key={value} value={value}>{FORMATO_LABEL_UPPER[value]}</option>)}</select>)}
              {field('Campaña', <select value={campanaId} onChange={(event) => setCampanaId(event.target.value)} className={controlClass} style={controlStyle}><option value="">Sin campaña</option>{campanas.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.nombre}{campaign.estatus === 'ARCHIVADA' ? ' · Archivada' : ''}</option>)}</select>)}
              {field('Línea de contenido', <input value={linea} onChange={(event) => setLinea(event.target.value)} className={controlClass} style={controlStyle} />, true)}
              {field('Hook', <input value={hook} onChange={(event) => setHook(event.target.value)} className={controlClass} style={controlStyle} />, true)}
              {field('Cuerpo', <textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} className={controlClass} style={controlStyle} />)}
              {field('CTA', <textarea rows={4} value={cta} onChange={(event) => setCta(event.target.value)} className={controlClass} style={controlStyle} />)}
              {field('Hashtags', <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="Uno, dos, tres" className={controlClass} style={controlStyle} />, true)}
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-200 pt-4">
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500">Programación y flujo</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('Fecha de publicación *', <input type="date" required value={fechaPublicacion} onChange={(event) => setFechaPublicacion(event.target.value)} className={controlClass} style={controlStyle} />)}
              {field('Estado', <select value={estatus} onChange={(event) => setEstatus(event.target.value as EstatusEnum)} className={controlClass} style={controlStyle}>{ESTATUS_ORDEN.map((value) => <option key={value} value={value}>{ESTATUS_STYLE[value].label}</option>)}</select>)}
              {field('Solicitud a diseño', <input type="datetime-local" value={fechaSolicitudDiseno} onChange={(event) => setFechaSolicitudDiseno(event.target.value)} className={controlClass} style={controlStyle} />)}
              {field('Entrega real de diseño', <input type="datetime-local" value={fechaEntregaReal} onChange={(event) => setFechaEntregaReal(event.target.value)} className={controlClass} style={controlStyle} />)}
              {field('Aprobación de gerencia', <input type="datetime-local" value={fechaAprobacion} onChange={(event) => setFechaAprobacion(event.target.value)} className={controlClass} style={controlStyle} />)}
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-200 pt-4">
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500">Calculados y sistema</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('Límite del brief · automático', <input readOnly value={slaWillChange ? 'Se recalculará al guardar' : publicacion.fecha_limite_brief || '—'} className={controlClass} style={controlStyle} />)}
              {field('Entrega estimada · automática', <input readOnly value={slaWillChange ? 'Se recalculará al guardar' : publicacion.fecha_entrega_diseno_estimada || '—'} className={controlClass} style={controlStyle} />)}
              {field('Versión del copy · informativa', <input readOnly value={String(publicacion.version_copy)} className={controlClass} style={controlStyle} />)}
              {field('Identificador', <input readOnly value={publicacion.id} className={controlClass} style={controlStyle} />)}
              {field('Creado', <input readOnly value={publicacion.created_at} className={controlClass} style={controlStyle} />)}
              {field('Última actualización', <input readOnly value={publicacion.updated_at} className={controlClass} style={controlStyle} />)}
              {field('ID de Drive', <input readOnly value={publicacion.drive_folder_id || '—'} className={controlClass} style={controlStyle} />)}
              {field('Creador (ID)', <input readOnly value={publicacion.creador_id || '—'} className={controlClass} style={controlStyle} />)}
              {field('Diseñador (ID)', <input readOnly value={publicacion.disenador_id || '—'} className={controlClass} style={controlStyle} />)}
            </div>
            {publicacion.drive_folder_url && <a href={publicacion.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold text-blue-700 underline">Abrir carpeta de Google Drive</a>}
            <p className="text-[11px] text-slate-500">La versión del copy es informativa y no cambia al editar. El límite del brief y la entrega estimada se calculan automáticamente.</p>
          </fieldset>

          <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white pt-3">
            <button type="button" disabled={isPending} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
