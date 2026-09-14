'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { Publicacion, FormatoEnum, EstatusEnum } from '@/types';
import { recalcularFechasSLAAction } from '@/app/actions/recalcularFechasSLAAction';

interface Props {
  publicacionesIniciales: Publicacion[];
}

// Mapeos de Estilos para Badges según Formato (Consistencia Kromi UI)
const FORMATO_BADGES: Record<FormatoEnum, { bg: string; text: string; border: string }> = {
  CARRUSEL: { bg: 'bg-indigo-950/80', text: 'text-indigo-300', border: 'border-indigo-700/50' },
  POST: { bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-700/50' },
  REEL: { bg: 'bg-pink-950/80', text: 'text-pink-300', border: 'border-pink-700/50' },
  STORY: { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-700/50' },
};

// Indicadores LED de Estado
const ESTATUS_DOTS: Record<EstatusEnum, { color: string; label: string; badgeBg: string }> = {
  PENDIENTE_BRIEF: { color: 'bg-slate-400', label: 'Brief Pendiente', badgeBg: 'bg-slate-800 text-slate-300' },
  EN_RODAJE: { color: 'bg-amber-400', label: 'En Rodaje', badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-700/50' },
  EN_DISENO: { color: 'bg-sky-400', label: 'En Diseño', badgeBg: 'bg-sky-950/80 text-sky-300 border-sky-700/50' },
  EN_REVISION_CM: { color: 'bg-purple-400', label: 'En Revisión CM', badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-700/50' },
  RECHAZADO_DISENO: { color: 'bg-rose-500', label: 'Rechazado Diseño', badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-700/50' },
  PENDIENTE_APROBACION_GERENCIA: { color: 'bg-orange-400', label: 'Pendiente Gerencia', badgeBg: 'bg-orange-950/80 text-orange-300 border-orange-700/50' },
  APROBADO: { color: 'bg-emerald-400', label: 'Aprobado', badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50' },
  PROGRAMADO: { color: 'bg-teal-400', label: 'Programado', badgeBg: 'bg-teal-950/80 text-teal-300 border-teal-700/50' },
  PUBLICADO: { color: 'bg-blue-500', label: 'Publicado', badgeBg: 'bg-blue-950/80 text-blue-300 border-blue-700/50' },
};

export default function ParrillaClientView({ publicacionesIniciales }: Props) {
  const [isPending, startTransition] = useTransition();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1)); // Septiembre 2026 por defecto
  const [formatoFiltro, setFormatoFiltro] = useState<FormatoEnum | 'TODOS'>('TODOS');
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Navegación de Meses
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Generador de Celdas del Mes
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startingDay = firstDay.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateStr });
    }
    return days;
  }, [currentDate]);

  // Filtrado de Datos
  const publicacionesFiltradas = useMemo(() => {
    return publicacionesIniciales.filter((pub) => {
      if (formatoFiltro !== 'TODOS' && pub.formato !== formatoFiltro) return false;
      return true;
    });
  }, [publicacionesIniciales, formatoFiltro]);

  // Drag & Drop Quick Reschedule
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTicketId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    if (!draggedTicketId) return;
    const ticketId = draggedTicketId;
    setDraggedTicketId(null);

    startTransition(async () => {
      const res = await recalcularFechasSLAAction({
        publicacionId: ticketId,
        nuevaFechaPublicacion: targetDateStr,
      });
      if (!res.success) alert(`Error de reprogramación: ${res.error}`);
    });
  };

  // Focus Smooth Scroll a Card Inferior
  const scrollToTicketCard = (id: string) => {
    setSelectedTicketId(id);
    const el = document.getElementById(`ticket-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      {/* SECCIÓN SUPERIOR: CONTROLES & GRILLA MENSUAL */}
      <div className="space-y-4">
        {/* BARRA DE FILTROS & SELECTOR DE MES */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-2 uppercase tracking-wider">
              Filtrar Formato:
            </span>
            <button
              onClick={() => setFormatoFiltro('TODOS')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                formatoFiltro === 'TODOS'
                  ? 'bg-slate-700 text-white border-slate-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
              }`}
            >
              TODOS
            </button>
            {(['CARRUSEL', 'POST', 'REEL', 'STORY'] as FormatoEnum[]).map((fmt) => {
              const style = FORMATO_BADGES[fmt];
              const isSelected = formatoFiltro === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => setFormatoFiltro(fmt)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${style.bg} ${style.text} ${style.border} ${
                    isSelected ? 'ring-2 ring-indigo-500 scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              &#8592;
            </button>
            <span className="text-base font-bold capitalize text-white min-w-[140px] text-center">
              {monthName}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              &#8594;
            </button>
          </div>
        </div>

        {/* GRILLA MATRIZ */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/50 text-center py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
          </div>

          <div className={`grid grid-cols-7 divide-x divide-y divide-slate-800/60 bg-slate-900 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            {calendarDays.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} className="min-h-[110px] bg-slate-950/20" />;

              const itemsDelDia = publicacionesFiltradas.filter((p) => p.fecha_publicacion === cell.dateStr);

              return (
                <div
                  key={cell.dateStr}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, cell.dateStr)}
                  className="min-h-[110px] p-2 transition-colors hover:bg-slate-800/30 flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                      {cell.day}
                    </span>
                    {itemsDelDia.length > 0 && (
                      <span className="text-[10px] text-slate-500 font-mono">{itemsDelDia.length} pz</span>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[90px] scrollbar-thin">
                    {itemsDelDia.map((pub) => {
                      const badgeStyle = FORMATO_BADGES[pub.formato];
                      const dotStyle = ESTATUS_DOTS[pub.estatus];

                      return (
                        <div
                          key={pub.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, pub.id)}
                          onClick={() => scrollToTicketCard(pub.id)}
                          className={`p-1.5 rounded-md border text-xs cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${badgeStyle.bg} ${badgeStyle.border}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${badgeStyle.text} bg-black/30`}>
                              {pub.formato}
                            </span>
                            <span className={`h-2 w-2 rounded-full ${dotStyle.color}`} title={`Estatus: ${dotStyle.label}`} />
                          </div>
                          <p className="text-[11px] font-medium text-slate-200 line-clamp-1 leading-tight">
                            {pub.titulo}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: DETALLE DE ENTREGABLES / TICKETS */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Detalle de Tickets y Fichas de Entregables</h3>
            <p className="text-xs text-slate-400">Selección directa sincronizada con la grilla superior.</p>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            Total: {publicacionesFiltradas.length} ítems
          </span>
        </div>

        {/* GRID DE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {publicacionesFiltradas.map((pub) => {
            const badgeStyle = FORMATO_BADGES[pub.formato];
            const dotStyle = ESTATUS_DOTS[pub.estatus];
            const isSelected = selectedTicketId === pub.id;

            return (
              <article
                key={pub.id}
                id={`ticket-card-${pub.id}`}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                  isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-slate-850' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono text-slate-400 font-semibold">
                      Pub: {pub.fecha_publicacion}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dotStyle.badgeBg}`}>
                      {dotStyle.label}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-2 line-clamp-2">{pub.titulo}</h4>

                  {/* Detalle Técnico */}
                  <div className="space-y-1 text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 mb-3 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Formato:</span>
                      <span className={`font-bold ${badgeStyle.text}`}>{pub.formato}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Límite Brief:</span>
                      <span className="text-amber-400">{pub.fecha_limite_brief || 'S/D'}</span>
                    </div>
                    {pub.linea_contenido && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Línea:</span>
                        <span className="text-slate-300 truncate max-w-[120px]">{pub.linea_contenido}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer con Visor Google Drive */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Google Drive API</span>
                  {pub.drive_folder_url ? (
                    <a
                      href={pub.drive_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition"
                    >
                      <span>📁 Assets Drive</span>
                      <span>&#8599;</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-600 font-mono italic">Sin Carpeta Vinculada</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}