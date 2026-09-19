'use client';

import React, { useState, useTransition } from 'react';
import { Publicacion, EstatusEnum, FormatoEnum } from '@/types';
import { recalculateSlaDates } from '@/app/actions/publicaciones/recalculateSla';

interface Props {
  publicacionesIniciales: Publicacion[];
}

// Configuración de las 7 Columnas del Flujo Operativo
const KANBAN_COLUMNAS: { id: EstatusEnum; label: string; color: string }[] = [
  { id: 'PENDIENTE_BRIEF', label: 'Brief Pendiente', color: 'border-slate-500' },
  { id: 'EN_RODAJE', label: 'En Rodaje', color: 'border-amber-500' },
  { id: 'EN_DISENO', label: 'En Diseño', color: 'border-sky-500' },
  { id: 'EN_REVISION_CM', label: 'En Revisión CM', color: 'border-purple-500' },
  { id: 'APROBADO', label: 'Aprobado', color: 'border-emerald-500' },
  { id: 'PROGRAMADO', label: 'Programado', color: 'border-teal-500' },
  { id: 'PUBLICADO', label: 'Publicado', color: 'border-blue-500' },
];

const FORMATO_BADGES: Record<FormatoEnum, { bg: string; text: string }> = {
  CARRUSEL: { bg: 'bg-indigo-950/80', text: 'text-indigo-300' },
  POST: { bg: 'bg-emerald-950/80', text: 'text-emerald-300' },
  REEL: { bg: 'bg-pink-950/80', text: 'text-pink-300' },
  STORY: { bg: 'bg-amber-950/80', text: 'text-amber-300' },
};

export default function KanbanClientView({ publicacionesIniciales }: Props) {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>(publicacionesIniciales);
  const [isPending, startTransition] = useTransition();
  const [ticketSeleccionado, setTicketSeleccionado] = useState<Publicacion | null>(null);

  // Manejador de reprogamación SLA desde el modal de detalles
  const handleReprogramar = (publicacionId: string, nuevaFecha: string) => {
    startTransition(async () => {
      const res = await recalculateSlaDates({
        publicacionId,
        nuevaFechaPublicacion: nuevaFecha,
      });

      if (res.success && res.data) {
        setPublicaciones((prev) =>
          prev.map((item) => (item.id === publicacionId ? res.data! : item))
        );
        setTicketSeleccionado(res.data);
      } else {
        alert(res.error || 'No se pudo recalcular la fecha SLA');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* KANBAN BOARD CONTAINER */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin min-h-[70vh]">
        {KANBAN_COLUMNAS.map((col) => {
          const ticketsEnColumna = publicaciones.filter((p) => p.estatus === col.id);

          return (
            <div
              key={col.id}
              className="w-80 shrink-0 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col max-h-[78vh]"
            >
              {/* Header de Columna */}
              <div className={`p-3 border-b-2 ${col.color} bg-slate-950/50 flex items-center justify-between rounded-t-xl`}>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                  {col.label}
                </h3>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  {ticketsEnColumna.length}
                </span>
              </div>

              {/* Lista de Cards en Columna */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin">
                {ticketsEnColumna.map((ticket) => {
                  const badgeStyle = FORMATO_BADGES[ticket.formato];

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setTicketSeleccionado(ticket)}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.01] shadow-md group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${badgeStyle.bg} ${badgeStyle.text}`}>
                          {ticket.formato}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Pub: {ticket.fecha_publicacion}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition line-clamp-2 mb-2">
                        {ticket.titulo}
                      </h4>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-800/60 pt-2 mt-2">
                        <span>Brief: {ticket.fecha_limite_brief || 'S/D'}</span>
                        {ticket.drive_folder_url && <span className="text-emerald-400">📁 Drive</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* DRAWER / MODAL DE FICHA TÉCNICA Y COPY */}
      {ticketSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-full max-w-xl bg-slate-900 h-full border-l border-slate-800 p-6 overflow-y-auto flex flex-col justify-between space-y-6 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-700/50">
                      {ticketSeleccionado.formato}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Estatus: {ticketSeleccionado.estatus}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {ticketSeleccionado.titulo}
                  </h2>
                </div>
                <button
                  onClick={() => setTicketSeleccionado(null)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              {/* Matriz de Fechas y Cronograma SLA */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs">
                <div>
                  <label className="text-slate-500 block text-[10px] uppercase font-bold">Fecha Publicación:</label>
                  <input
                    type="date"
                    disabled={isPending}
                    value={ticketSeleccionado.fecha_publicacion}
                    onChange={(e) => handleReprogramar(ticketSeleccionado.id, e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-emerald-400 font-bold px-2 py-1 rounded w-full mt-1 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Límite Brief (SLA):</span>
                  <span className="text-amber-400 font-bold block mt-2">{ticketSeleccionado.fecha_limite_brief || 'S/D'}</span>
                </div>
              </div>

              {/* Ficha Técnica de Copy Granular */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Estructura de Copy / Brefeado
                </h3>

                <div className="space-y-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-bold text-indigo-400 block mb-1 uppercase">
                      🪝 Hook (Gancho Visual)
                    </span>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap">
                      {ticketSeleccionado.hook_texto || 'Sin hook definido.'}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-bold text-emerald-400 block mb-1 uppercase">
                      📝 Body (Cuerpo del mensaje)
                    </span>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap">
                      {ticketSeleccionado.body_texto || 'Sin cuerpo definido.'}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-bold text-amber-400 block mb-1 uppercase">
                      📢 CTA (Llamada a la Acción)
                    </span>
                    <p className="text-xs text-slate-200">
                      {ticketSeleccionado.cta_texto || 'Sin CTA definido.'}
                    </p>
                  </div>

                  {ticketSeleccionado.hashtags && ticketSeleccionado.hashtags.length > 0 && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] font-bold text-sky-400 block mb-1 uppercase">
                        # Hashtags
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ticketSeleccionado.hashtags.map((tag, idx) => (
                          <span key={idx} className="text-[11px] text-sky-300 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal con enlace empaquetado a Google Drive */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              {ticketSeleccionado.drive_folder_url ? (
                <a
                  href={ticketSeleccionado.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2"
                >
                  <span>📁 Abrir Carpeta en Google Drive</span>
                  <span>&#8599;</span>
                </a>
              ) : (
                <span className="text-xs text-slate-500 font-mono italic text-center w-full">
                  Sin carpeta asignada en Google Drive
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}