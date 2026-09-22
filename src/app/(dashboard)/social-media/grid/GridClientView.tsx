'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { Publicacion, FormatoEnum, EstatusEnum } from '@/types';
import { recalcularFechasSLAAction } from '@/app/actions/publicaciones/recalculateSla';
import {
  actualizarEstatusTicketAction,
  editarCamposRapidosTicketAction,
} from '@/app/actions/publicaciones/ticket-quick-actions';

interface Props {
  publicacionesIniciales: Publicacion[];
}

const FORMATO_LABEL: Record<FormatoEnum, string> = {
  CARRUSEL: 'Carrusel',
  POST: 'Post',
  REEL: 'Reel',
  STORY: 'Story',
};

/**
 * Único eje cromático con significado semántico en la vista: 4 familias
 * (gris = pendiente, azul = en proceso, naranja = requiere atención/
 * rechazo, verde = aprobado o publicado), todas tomadas de las variables
 * de marca en globals.css — no hex sueltos.
 */
const ESTATUS_ORDEN: EstatusEnum[] = [
  'PENDIENTE_BRIEF',
  'EN_RODAJE',
  'EN_DISENO',
  'EN_REVISION_CM',
  'RECHAZADO_DISENO',
  'PENDIENTE_APROBACION_GERENCIA',
  'APROBADO',
  'PROGRAMADO',
  'PUBLICADO',
];

const ESTATUS_STYLE: Record<
  EstatusEnum,
  { label: string; dotVar: string; bgVar: string; textVar: string }
> = {
  PENDIENTE_BRIEF: { label: 'Brief pendiente', dotVar: 'var(--gris)', bgVar: 'var(--hueso)', textVar: 'var(--gris)' },
  EN_RODAJE: { label: 'En rodaje', dotVar: 'var(--azul)', bgVar: 'color-mix(in srgb, var(--azul) 12%, white)', textVar: 'var(--azul-osc)' },
  EN_DISENO: { label: 'En diseño', dotVar: 'var(--azul)', bgVar: 'color-mix(in srgb, var(--azul) 12%, white)', textVar: 'var(--azul-osc)' },
  EN_REVISION_CM: { label: 'En revisión CM', dotVar: 'var(--azul)', bgVar: 'color-mix(in srgb, var(--azul) 12%, white)', textVar: 'var(--azul-osc)' },
  RECHAZADO_DISENO: { label: 'Rechazado', dotVar: 'var(--naranja)', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)', textVar: '#8A4B0C' },
  PENDIENTE_APROBACION_GERENCIA: { label: 'Pendiente gerencia', dotVar: 'var(--naranja)', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)', textVar: '#8A4B0C' },
  APROBADO: { label: 'Aprobado', dotVar: 'var(--verde)', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', textVar: '#256B3A' },
  PROGRAMADO: { label: 'Programado', dotVar: 'var(--verde)', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', textVar: '#256B3A' },
  PUBLICADO: { label: 'Publicado', dotVar: 'var(--verde)', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)', textVar: '#256B3A' },
};

type SlaState = 'vencido' | 'hoy' | 'proximo' | 'ok' | 'sin-fecha';

function calcularSlaState(fechaLimiteBrief: string | null | undefined): SlaState {
  if (!fechaLimiteBrief) return 'sin-fecha';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimiteBrief + 'T00:00:00');
  const diffDias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);

  if (diffDias < 0) return 'vencido';
  if (diffDias === 0) return 'hoy';
  if (diffDias <= 2) return 'proximo';
  return 'ok';
}

const SLA_META: Record<SlaState, { label: string; textVar: string; bgVar: string }> = {
  vencido: { label: 'Brief vencido', textVar: '#A32D2D', bgVar: '#FCEBEB' },
  hoy: { label: 'Brief vence hoy', textVar: '#8A4B0C', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)' },
  proximo: { label: 'Brief próximo a vencer', textVar: '#8A4B0C', bgVar: 'color-mix(in srgb, var(--naranja) 15%, white)' },
  ok: { label: 'En plazo', textVar: '#256B3A', bgVar: 'color-mix(in srgb, var(--verde) 12%, white)' },
  'sin-fecha': { label: 'Sin fecha límite', textVar: 'var(--gris)', bgVar: 'var(--hueso)' },
};

export default function GridClientView({ publicacionesIniciales }: Props) {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>(publicacionesIniciales);
  const [isPending, startTransition] = useTransition();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1));
  const [formatoFiltro, setFormatoFiltro] = useState<FormatoEnum | 'TODOS'>('TODOS');
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPublicaciones((prev) => {
      if (prev.length !== publicacionesIniciales.length) return publicacionesIniciales;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].id !== publicacionesIniciales[i].id) return publicacionesIniciales;
      }
      return prev;
    });
  }, [publicacionesIniciales]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

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

  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((pub) => {
      if (formatoFiltro !== 'TODOS' && pub.formato !== formatoFiltro) return false;
      return true;
    });
  }, [publicaciones, formatoFiltro]);

  const hoyStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTicketId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    if (!draggedTicketId) return;
    const ticketId = draggedTicketId;
    setDraggedTicketId(null);

    setPublicaciones((prev) =>
      prev.map((p) => (p.id === ticketId ? { ...p, fecha_publicacion: targetDateStr } : p))
    );

    startTransition(async () => {
      const res = await recalcularFechasSLAAction({
        publicacionId: ticketId,
        nuevaFechaPublicacion: targetDateStr,
      });
      if (!res.success) {
        alert(`Error de reprogramación: ${res.error}`);
        setPublicaciones(publicacionesIniciales);
      }
    });
  };

  const scrollToTicketCard = (id: string) => {
    setSelectedTicketId(id);
    const el = document.getElementById(`ticket-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  /**
   * Cambio de estatus inline vía <select>. Optimista en UI; revierte si la
   * Server Action falla. La acción está como placeholder — ver
   * ticket-quick-actions.ts — así que hoy siempre revertirá con un aviso.
   */
  const handleEstatusChange = (pub: Publicacion, nuevoEstatus: EstatusEnum) => {
    const estatusAnterior = pub.estatus;
    setPublicaciones((prev) =>
      prev.map((p) => (p.id === pub.id ? { ...p, estatus: nuevoEstatus } : p))
    );

    startTransition(async () => {
      const res = await actualizarEstatusTicketAction({
        publicacionId: pub.id,
        nuevoEstatus,
      });
      if (!res.success) {
        setPublicaciones((prev) =>
          prev.map((p) => (p.id === pub.id ? { ...p, estatus: estatusAnterior } : p))
        );
      }
    });
  };

  const startEditing = (pub: Publicacion) => {
    setEditingTicketId(pub.id);
    setEditTitulo(pub.titulo);
    setEditFecha(pub.fecha_publicacion);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingTicketId(null);
    setEditError(null);
  };

  const confirmEditing = (pub: Publicacion) => {
    if (!editTitulo.trim() || !editFecha) {
      setEditError('Título y fecha son requeridos.');
      return;
    }

    const tituloAnterior = pub.titulo;
    const fechaAnterior = pub.fecha_publicacion;

    setPublicaciones((prev) =>
      prev.map((p) =>
        p.id === pub.id ? { ...p, titulo: editTitulo.trim(), fecha_publicacion: editFecha } : p
      )
    );
    setEditingTicketId(null);

    startTransition(async () => {
      const res = await editarCamposRapidosTicketAction({
        publicacionId: pub.id,
        titulo: editTitulo.trim(),
        fechaPublicacion: editFecha,
      });
      if (!res.success) {
        setPublicaciones((prev) =>
          prev.map((p) =>
            p.id === pub.id ? { ...p, titulo: tituloAnterior, fecha_publicacion: fechaAnterior } : p
          )
        );
        alert(`No se pudo guardar: ${res.error ?? 'la acción todavía no está implementada.'}`);
      }
    });
  };

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* SECCIÓN SUPERIOR: CONTROLES & GRILLA MENSUAL */}
      <div className="space-y-4">
        {/* BARRA DE FILTROS & SELECTOR DE MES */}
        <div
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border"
          style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold mr-1" style={{ color: 'var(--gris)' }}>
              Formato:
            </span>
            <button
              onClick={() => setFormatoFiltro('TODOS')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
              style={
                formatoFiltro === 'TODOS'
                  ? { background: 'var(--azul)', color: '#fff' }
                  : { background: 'var(--hueso)', color: 'var(--gris)' }
              }
            >
              Todos
            </button>
            {(['CARRUSEL', 'POST', 'REEL', 'STORY'] as FormatoEnum[]).map((fmt) => {
              const isSelected = formatoFiltro === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => setFormatoFiltro(fmt)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
                  style={
                    isSelected
                      ? { background: 'var(--azul)', color: '#fff' }
                      : { background: 'var(--hueso)', color: 'var(--gris)' }
                  }
                >
                  {FORMATO_LABEL[fmt]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              aria-label="Mes anterior"
              className="p-2 rounded-lg border transition"
              style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span
              className="text-sm font-semibold capitalize min-w-[140px] text-center"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}
            >
              {monthName}
            </span>
            <button
              onClick={nextMonth}
              aria-label="Mes siguiente"
              className="p-2 rounded-lg border transition"
              style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* GRILLA MATRIZ */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
        >
          <div
            className="grid grid-cols-7 border-b text-center py-2.5 text-xs font-semibold"
            style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
          >
            <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
          </div>

          <div className={`grid grid-cols-7 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
            {calendarDays.map((cell, idx) => {
              if (!cell)
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[110px] border-b border-r"
                    style={{ background: 'var(--hueso)', borderColor: 'var(--borde)' }}
                  />
                );

              const itemsDelDia = publicacionesFiltradas.filter((p) => p.fecha_publicacion === cell.dateStr);
              const esHoy = cell.dateStr === hoyStr;
              const estadosSla = itemsDelDia.map((p) => calcularSlaState(p.fecha_limite_brief));
              const peorEstado: SlaState | null = estadosSla.includes('vencido')
                ? 'vencido'
                : estadosSla.includes('hoy')
                ? 'hoy'
                : estadosSla.includes('proximo')
                ? 'proximo'
                : null;

              return (
                <div
                  key={cell.dateStr}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, cell.dateStr)}
                  className="min-h-[110px] p-2 border-b border-r transition-colors flex flex-col justify-between"
                  style={{
                    background: esHoy ? 'color-mix(in srgb, var(--azul) 8%, white)' : 'var(--papel)',
                    borderColor: 'var(--borde)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: esHoy ? 'var(--azul)' : 'var(--gris)' }}
                    >
                      {cell.day}
                    </span>
                    {peorEstado && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: SLA_META[peorEstado].textVar }}
                        title={SLA_META[peorEstado].label}
                      />
                    )}
                  </div>

                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[86px]">
                    {itemsDelDia.map((pub) => {
                      const estatusStyle = ESTATUS_STYLE[pub.estatus];
                      return (
                        <div
                          key={pub.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, pub.id)}
                          onClick={() => scrollToTicketCard(pub.id)}
                          className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] font-medium truncate cursor-pointer active:cursor-grabbing"
                          style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar }}
                          title={pub.titulo}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: estatusStyle.dotVar }}
                          />
                          <span className="truncate">{pub.titulo}</span>
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

      {/* DETALLE DE ENTREGABLES / TICKETS — lista completa siempre visible */}
      <section className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--borde)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}>
              Detalle de tickets y fichas de entregables
            </h3>
            <p className="text-xs" style={{ color: 'var(--gris)' }}>
              Cambia el estatus o edita el título y la fecha sin salir de esta vista.
            </p>
          </div>
          <span
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
          >
            {publicacionesFiltradas.length} ítems
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {publicacionesFiltradas.map((pub) => {
            const estatusStyle = ESTATUS_STYLE[pub.estatus];
            const slaState = calcularSlaState(pub.fecha_limite_brief);
            const slaMeta = SLA_META[slaState];
            const isSelected = selectedTicketId === pub.id;
            const isEditing = editingTicketId === pub.id;

            return (
              <article
                key={pub.id}
                id={`ticket-card-${pub.id}`}
                className="rounded-xl p-4 flex flex-col justify-between transition-all border"
                style={{
                  background: 'var(--papel)',
                  borderColor: isSelected ? 'var(--verde)' : 'var(--borde)',
                  boxShadow: isSelected ? '0 0 0 2px color-mix(in srgb, var(--verde) 30%, transparent)' : 'none',
                }}
              >
                <div>
                  {/* Título editable + fecha editable */}
                  {isEditing ? (
                    <div className="space-y-2 mb-2">
                      <input
                        type="text"
                        value={editTitulo}
                        onChange={(e) => setEditTitulo(e.target.value)}
                        className="w-full text-sm font-semibold rounded-lg px-2.5 py-1.5 border"
                        style={{ borderColor: 'var(--azul)', color: 'var(--tinta)' }}
                        autoFocus
                      />
                      <input
                        type="date"
                        value={editFecha}
                        onChange={(e) => setEditFecha(e.target.value)}
                        className="w-full text-xs rounded-lg px-2.5 py-1.5 border"
                        style={{ borderColor: 'var(--azul)', color: 'var(--tinta)' }}
                      />
                      {editError && (
                        <p className="text-[11px]" style={{ color: '#A32D2D' }}>{editError}</p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => confirmEditing(pub)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: 'var(--verde)', color: '#fff' }}
                        >
                          <Check size={13} aria-hidden="true" />
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: 'var(--hueso)', color: 'var(--gris)' }}
                        >
                          <X size={13} aria-hidden="true" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--gris)' }}>
                          Pub: {pub.fecha_publicacion}
                        </span>
                        <button
                          onClick={() => startEditing(pub)}
                          aria-label="Editar título y fecha"
                          className="p-1 rounded-md transition"
                          style={{ color: 'var(--gris)' }}
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                      </div>
                      <h4 className="text-sm font-bold mb-2 line-clamp-2" style={{ color: 'var(--tinta)' }}>
                        {pub.titulo}
                      </h4>
                    </>
                  )}

                  {/* Cambio de estatus inline */}
                  <div className="mb-2">
                    <select
                      value={pub.estatus}
                      onChange={(e) => handleEstatusChange(pub, e.target.value as EstatusEnum)}
                      className="w-full text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border-0 cursor-pointer"
                      style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar }}
                    >
                      {ESTATUS_ORDEN.map((est) => (
                        <option key={est} value={est}>
                          {ESTATUS_STYLE[est].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Indicador de SLA — elemento visualmente dominante */}
                  <div
                    className="flex items-center gap-2 text-[11px] font-medium px-2.5 py-1.5 rounded-lg mb-2"
                    style={{ background: slaMeta.bgVar, color: slaMeta.textVar }}
                  >
                    {(slaState === 'vencido' || slaState === 'hoy') && (
                      <AlertTriangle size={12} aria-hidden="true" />
                    )}
                    <span>
                      {slaMeta.label}
                      {pub.fecha_limite_brief && ` · ${pub.fecha_limite_brief}`}
                    </span>
                  </div>

                  <div
                    className="space-y-1 text-xs p-2.5 rounded-lg border"
                    style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
                  >
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--gris)' }}>Formato:</span>
                      <span className="font-semibold">{FORMATO_LABEL[pub.formato]}</span>
                    </div>
                    {pub.linea_contenido && (
                      <div className="flex justify-between gap-2">
                        <span style={{ color: 'var(--gris)' }}>Línea:</span>
                        <span className="truncate max-w-[140px]">{pub.linea_contenido}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--borde)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--gris)' }}>Google Drive</span>
                  {pub.drive_folder_url ? (
                    <a
                      href={pub.drive_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold flex items-center gap-1.5 transition"
                      style={{ color: 'var(--azul)' }}
                    >
                      <FolderOpen size={13} aria-hidden="true" />
                      <span>Ver assets</span>
                    </a>
                  ) : (
                    <span className="text-xs italic" style={{ color: 'var(--gris)' }}>Sin carpeta vinculada</span>
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