"use client";

import React, { useState, useTransition } from "react";
import { Campana, createCampaignAction } from "@/app/actions/campanas/campaigns";

interface Props {
  campanasIniciales: Campana[];
}

export default function CampaignsClientView({ campanasIniciales }: Props) {
  const [campanas, setCampanas] = useState<Campana[]>(campanasIniciales);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    presupuesto: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCampaignAction({
        nombre: form.nombre,
        descripcion: form.descripcion,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        presupuesto: form.presupuesto
          ? parseFloat(form.presupuesto)
          : undefined,
      });

      if (res.success) {
        setShowModal(false);
        setForm({
          nombre: "",
          descripcion: "",
          fecha_inicio: "",
          fecha_fin: "",
          presupuesto: "",
        });
        // Recargar datos locales sencillos
        window.location.reload();
      } else {
        alert(res.error || "Error al crear la campaña");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎯</span> Campañas Comerciales
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Planificación y seguimiento de estrategias y ofertas globales.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
        >
          + Nueva Campaña
        </button>
      </div>

      {/* Grid de Campañas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campanas.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500 text-xs">
            No hay campañas registradas actualmente.
          </div>
        ) : (
          campanas.map((c) => (
            <div
              key={c.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                    {c.estatus}
                  </span>
                  {c.presupuesto && (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      ${c.presupuesto.toLocaleString()}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white">{c.nombre}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {c.descripcion || "Sin descripción."}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Desde: {c.fecha_inicio}</span>
                <span>Hasta: {c.fecha_fin}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nueva Campaña */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-white">
              Crear Nueva Campaña
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nombre de la Campaña
                </label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  placeholder="ej. Aniversario 2026"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Descripción
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Inicio
                  </label>
                  <input
                    type="date"
                    required
                    value={form.fecha_inicio}
                    onChange={(e) =>
                      setForm({ ...form, fecha_inicio: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Fin
                  </label>
                  <input
                    type="date"
                    required
                    value={form.fecha_fin}
                    onChange={(e) =>
                      setForm({ ...form, fecha_fin: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Presupuesto ($ USD)
                </label>
                <input
                  type="number"
                  value={form.presupuesto}
                  onChange={(e) =>
                    setForm({ ...form, presupuesto: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  Guardar Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
