"use client";

import React, { useState, useTransition } from "react";
import { Publicacion } from "@/types";
import { updateShootingStatusAction } from "@/app/actions/publicaciones/shooting";

interface Props {
  pautasIniciales: Publicacion[];
}

export default function ShootingClientView({ pautasIniciales }: Props) {
  const [pautas, setPautas] = useState<Publicacion[]>(pautasIniciales);
  const [sedeFiltro, setSedeFiltro] = useState<string>("TODAS");
  const [isPending, startTransition] = useTransition();

  const pautasFiltradas = pautas.filter((p) => {
    if (sedeFiltro === "TODAS") return true;
    return p.linea_contenido?.toUpperCase().includes(sedeFiltro);
  });

  const handleCompletarRodaje = (id: string) => {
    startTransition(async () => {
      const res = await updateShootingStatusAction(id, "EN_DISENO");
      if (res.success) {
        setPautas((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(res.error || "Error al actualizar estatus");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header y Filtro por Sede */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎥</span> Modo Rodaje / Pautas
          </h2>
          <p className="text-xs text-slate-400">
            Vista optimizada para grabación en planta y sedes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["TODAS", "PREBO", "MAÑONGO"].map((sede) => (
            <button
              key={sede}
              onClick={() => setSedeFiltro(sede)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                sedeFiltro === sede
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {sede}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Pautas */}
      <div className="space-y-4">
        {pautasFiltradas.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500 text-xs">
            No hay pautas pendientes de rodaje para el filtro seleccionado.
          </div>
        ) : (
          pautasFiltradas.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-pink-950 text-pink-300 rounded border border-pink-800/50">
                      {item.formato}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Pub: {item.fecha_publicacion}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {item.titulo}
                  </h3>
                </div>

                <button
                  disabled={isPending}
                  onClick={() => handleCompletarRodaje(item.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✓</span>
                  <span>Enviar a Diseño</span>
                </button>
              </div>

              {/* Hook y Detalles de la Toma */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 block uppercase">
                  🪝 Hook / Idea Principal:
                </span>
                <p className="text-xs text-slate-200 font-medium">
                  {item.hook_texto || "Sin hook especificado."}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800 font-mono">
                <span>Línea: {item.linea_contenido || "General"}</span>
                {item.drive_folder_url && (
                  <a
                    href={item.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    📁 Ver Material en Drive
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
