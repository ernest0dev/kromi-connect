'use client';

import React, { useState, useTransition } from 'react';
import { FormatoEnum } from '@/types';
import { createPostWithDriveAction } from '@/app/actions/createPostWithDrive';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NuevoTicketModal({ isOpen, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados del Formulario
  const [titulo, setTitulo] = useState('');
  const [formato, setFormato] = useState<FormatoEnum>('REEL');
  const [lineaContenido, setLineaContenido] = useState('');
  const [fechaPublicacion, setFechaPublicacion] = useState('');
  
  // Copy Táctico / Brefeado Granular
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

    // Procesar array de hashtags desde el string delimitado por comas
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>✨</span> Nuevo Ticket de Contenido
            </h2>
            <p className="text-xs text-slate-400">
              Crea el ticket y genera automáticamente su carpeta en Google Drive API[cite: 4].
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 scrollbar-thin">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs rounded-lg font-mono">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Bloque 1: Información Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Título del Entregable *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Reel Ofertas de Carnicería Prebo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Formato *
              </label>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as FormatoEnum)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="REEL">🎥 REEL (9:16)</option>
                <option value="CARRUSEL">📚 CARRUSEL (1:1 / 4:5)</option>
                <option value="POST">🖼️ POST (1:1)</option>
                <option value="STORY">📱 STORY (9:16)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Línea Comercial
              </label>
              <input
                type="text"
                placeholder="Ej. Promociones, Charcutería"
                value={lineaContenido}
                onChange={(e) => setLineaContenido(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Fecha de Publicación * (SLA 3+2)[cite: 4, 6]
              </label>
              <input
                type="date"
                required
                value={fechaPublicacion}
                onChange={(e) => setFechaPublicacion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Bloque 2: Estructura de Copy */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Brefeado y Estructura de Copy[cite: 4]
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-indigo-400">🪝 Hook (Gancho)</label>
              <input
                type="text"
                placeholder="Ej. ¡3 cortes de carne que estás comprando mal!"
                value={hookTexto}
                onChange={(e) => setHookTexto(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-emerald-400">📝 Cuerpo del Mensaje</label>
              <textarea
                rows={3}
                placeholder="Detalle de las ofertas..."
                value={bodyTexto}
                onChange={(e) => setBodyTexto(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-amber-400">📢 CTA</label>
                <input
                  type="text"
                  placeholder="Ej. Visítanos en Prebo o Mañongo"
                  value={ctaTexto}
                  onChange={(e) => setCtaTexto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-sky-400"># Hashtags (coma)</label>
                <input
                  type="text"
                  placeholder="KromiMarket, Prebo"
                  value={hashtagsRaw}
                  onChange={(e) => setHashtagsRaw(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Footer Acciones */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creando Carpeta en Drive...</span>
                </>
              ) : (
                <span>Crear Ticket + Drive Folder</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}