'use client';

import React, { useId, useState, useTransition } from 'react';
import { X, Loader2, TriangleAlert, FolderPlus } from 'lucide-react';
import { FormatoEnum } from '@/types';
import { createPostWithDriveAction } from '@/app/actions/publicaciones/create';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const FORMATO_OPCIONES: { value: FormatoEnum; label: string; hint: string }[] = [
  { value: 'REEL', label: 'Reel', hint: '9:16' },
  { value: 'CARRUSEL', label: 'Carrusel', hint: '1:1 / 4:5' },
  { value: 'POST', label: 'Post', hint: '1:1' },
  { value: 'STORY', label: 'Story', hint: '9:16' },
];

const inputStyle: React.CSSProperties = {
  background: 'var(--hueso)',
  borderColor: 'var(--borde)',
  color: 'var(--tinta)',
};

export default function NuevoTicketModal({ isOpen, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formId = useId();

  const [titulo, setTitulo] = useState('');
  const [formato, setFormato] = useState<FormatoEnum>('REEL');
  const [lineaContenido, setLineaContenido] = useState('');
  const [fechaPublicacion, setFechaPublicacion] = useState('');

  const [hookTexto, setHookTexto] = useState('');
  const [bodyTexto, setBodyTexto] = useState('');
  const [ctaTexto, setCtaTexto] = useState('');
  const [hashtagsRaw, setHashtagsRaw] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!titulo || !fechaPublicacion) {
      setErrorMessage('El título y la fecha de publicación son requeridos.');
      return;
    }

    const hashtagsArray = hashtagsRaw
      ? hashtagsRaw.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    startTransition(async () => {
      const res = await createPostWithDriveAction({
        titulo,
        formato,
        linea_contenido: lineaContenido,
        fecha_publicacion: fechaPublicacion,
        hook_texto: hookTexto || undefined,
        body_texto: bodyTexto || undefined,
        cta_texto: ctaTexto || undefined,
        hashtags: hashtagsArray,
      });

      if (res.success) {
        setTitulo('');
        setLineaContenido('');
        setFechaPublicacion('');
        setHookTexto('');
        setBodyTexto('');
        setCtaTexto('');
        setHashtagsRaw('');
        onClose();
      } else {
        setErrorMessage(res.error || 'Ocurrió un error al crear la publicación.');
      }
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
              Nuevo ticket de contenido
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gris)' }}>
              Se crea el ticket y su carpeta de assets en Google Drive automáticamente.
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div
              className="p-3 text-xs rounded-lg flex items-start gap-2 border"
              style={{ background: '#FCEBEB', borderColor: '#F09595', color: '#A32D2D' }}
            >
              <TriangleAlert size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bloque 1: Información principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor={`${formId}-titulo`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Título del entregable
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

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-formato`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Formato
              </label>
              <select
                id={`${formId}-formato`}
                value={formato}
                onChange={(e) => setFormato(e.target.value as FormatoEnum)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none"
                style={inputStyle}
              >
                {FORMATO_OPCIONES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.hint})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-linea`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Línea comercial
              </label>
              <input
                id={`${formId}-linea`}
                type="text"
                placeholder="Promociones, charcutería…"
                value={lineaContenido}
                onChange={(e) => setLineaContenido(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor={`${formId}-fecha`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Fecha de publicación
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
              <p className="text-[11px]" style={{ color: 'var(--gris)' }}>
                El límite de brief y rodaje se calcula automáticamente (regla SLA 3+2).
              </p>
            </div>
          </div>

          {/* Bloque 2: Copy */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--borde)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gris)' }}>
              Brief de copy
            </h3>

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-hook`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Hook
              </label>
              <input
                id={`${formId}-hook`}
                type="text"
                placeholder="3 cortes de carne que estás comprando mal"
                value={hookTexto}
                onChange={(e) => setHookTexto(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2 text-sm border focus:outline-none"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-body`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                Cuerpo del mensaje
              </label>
              <textarea
                id={`${formId}-body`}
                rows={3}
                placeholder="Detalle de las ofertas…"
                value={bodyTexto}
                onChange={(e) => setBodyTexto(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none resize-none"
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-cta`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                  CTA
                </label>
                <input
                  id={`${formId}-cta`}
                  type="text"
                  placeholder="Visítanos en Prebo o Mañongo"
                  value={ctaTexto}
                  onChange={(e) => setCtaTexto(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2 text-sm border focus:outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${formId}-hashtags`} className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
                  Hashtags (separados por coma)
                </label>
                <input
                  id={`${formId}-hashtags`}
                  type="text"
                  placeholder="KromiMarket, Prebo"
                  value={hashtagsRaw}
                  onChange={(e) => setHashtagsRaw(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2 text-sm border focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="pt-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--borde)' }}>
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
              style={{ background: 'var(--naranja)', color: '#2E1600' }}
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  <span>Creando carpeta en Drive…</span>
                </>
              ) : (
                <>
                  <FolderPlus size={14} aria-hidden="true" />
                  <span>Crear ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}