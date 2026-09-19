"use client";

import React, { useState, useTransition } from "react";
import { processRequestAction } from "@/app/actions/solicitudes/convert";

interface Solicitud {
  id: string;
  tercero_nombre?: string;
  solicitante_email?: string;
  descripcion: string;
  fecha_sugerida?: string;
  estatus: "PENDIENTE" | "APROBADO" | "RECHAZADO";
}

interface Props {
  solicitudesIniciales: Solicitud[];
}

export default function RequestsClientView({ solicitudesIniciales }: Props) {
  const [solicitudes, setSolicitudes] =
    useState<Solicitud[]>(solicitudesIniciales);
  const [isPending, startTransition] = useTransition();

  const handleProcesar = (solicitud: Solicitud, aprobar: boolean) => {
    startTransition(async () => {
      const res = await processRequestAction(
        solicitud.id,
        aprobar,
        aprobar
          ? {
              titulo: solicitud.descripcion.slice(0, 50) || "Nueva Solicitud",
              formato: "POST",
              fecha_publicacion:
                solicitud.fecha_sugerida ||
                new Date().toISOString().split("T")[0],
            }
          : undefined,
      );

      if (res.success) {
        setSolicitudes((prev) =>
          prev.map((s) =>
            s.id === solicitud.id
              ? { ...s, estatus: aprobar ? "APROBADO" : "RECHAZADO" }
              : s,
          ),
        );
      } else {
        alert(res.error || "Error al procesar solicitud");
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📥</span> Inbox de Solicitudes de Terceros
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Buzón de requerimientos de marcas aliadas y proveedores.
        </p>
      </div>

      <div className="space-y-4">
        {solicitudes.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500 text-xs">
            No hay solicitudes registradas en el sistema.
          </div>
        ) : (
          solicitudes.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800/50">
                    {item.tercero_nombre || "Marca Aliada"}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {item.solicitante_email || "Sin email"}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      item.estatus === "PENDIENTE"
                        ? "bg-amber-950 text-amber-400"
                        : item.estatus === "APROBADO"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-rose-950 text-rose-400"
                    }`}
                  >
                    {item.estatus}
                  </span>
                </div>
                <p className="text-xs text-slate-200">{item.descripcion}</p>
              </div>

              {item.estatus === "PENDIENTE" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={isPending}
                    onClick={() => handleProcesar(item, true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    Aprobar y Crear Ticket
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleProcesar(item, false)}
                    className="bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-200 font-bold text-xs px-3 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
