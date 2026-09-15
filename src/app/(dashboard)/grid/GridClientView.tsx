"use client";

import React, { useState, useTransition } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Publicacion } from "@/types";
import { recalculateSlaDates } from "@/app/actions/recalculateSlaDates";

interface Props {
  publicacionesIniciales: Publicacion[];
  mesActual: string; // Formato YYYY-MM
}

export default function GridClientView({
  publicacionesIniciales,
  mesActual,
}: Props) {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>(
    publicacionesIniciales,
  );
  const [isPending, startTransition] = useTransition();

  // Generar los días del mes actual (Ejemplo simplificado de matriz de días)
  const obtenerDiasDelMes = () => {
    const [year, month] = mesActual.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    const days = [];

    while (date.getMonth() === month - 1) {
      const dateString = date.toISOString().split("T")[0];
      days.push(dateString);
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const dias = obtenerDiasDelMes();

  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;

    // Si se suelta fuera de un destino válido o en el mismo día, no hacemos nada
    if (!destination || destination.droppableId === result.source.droppableId) {
      return;
    }

    const nuevaFechaPublicacion = destination.droppableId; // El droppableId es la fecha (YYYY-MM-DD)

    // Actualización optimista en la UI
    setPublicaciones((prev) =>
      prev.map((pub) =>
        pub.id === draggableId
          ? { ...pub, fecha_publicacion: nuevaFechaPublicacion }
          : pub,
      ),
    );

    // Invocación a la Server Action para recalcular SLAs en base de datos
    startTransition(async () => {
      const res = await recalculateSlaDates({
        publicacionId: draggableId,
        nuevaFechaPublicacion,
      });

      if (!res.success) {
        alert(res.error || "Error al recalcular fechas de SLA");
        // Revertir estado si falla la Server Action
        setPublicaciones(publicacionesIniciales);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Grilla */}
      <div className="flex items-center justify-between bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📅</span> Parrilla Macro Mensual
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Arrastra las publicaciones entre los días para recalcular las fechas
            límite de SLA automáticamente.
          </p>
        </div>
        {isPending && (
          <span className="text-xs font-mono text-emerald-400 animate-pulse">
            ⚡ Recalculando SLA...
          </span>
        )}
      </div>

      {/* Contenedor Drag and Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
          {dias.map((dia) => {
            const postsDelDia = publicaciones.filter(
              (p) => p.fecha_publicacion === dia,
            );

            return (
              <Droppable key={dia} droppableId={dia}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[120px] bg-slate-900/60 p-2 rounded-lg border transition ${
                      snapshot.isDraggingOver
                        ? "border-emerald-500 bg-slate-800/80"
                        : "border-slate-800/80"
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-400 block mb-2">
                      {dia.split("-")[2]}
                    </span>

                    <div className="space-y-1.5">
                      {postsDelDia.map((post, index) => (
                        <Draggable
                          key={post.id}
                          draggableId={post.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-2 rounded border text-xs font-medium space-y-1 transition ${
                                snapshot.isDragging
                                  ? "bg-emerald-950 border-emerald-500 shadow-lg z-50"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                                <span className="uppercase text-emerald-400">
                                  {post.formato}
                                </span>
                                <span>{post.estatus}</span>
                              </div>
                              <p className="text-slate-200 line-clamp-2 text-[11px]">
                                {post.titulo}
                              </p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
