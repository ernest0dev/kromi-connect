"use client";

import React, { useState, useTransition } from "react";
import {
  TicketSoporte,
  createSupportTicketAction,
  updateSupportTicketStatusAction,
} from "@/app/actions/support/customerSupport";

interface Props {
  ticketsIniciales: TicketSoporte[];
}

export default function SupportClientView({ ticketsIniciales }: Props) {
  const [tickets, setTickets] = useState<TicketSoporte[]>(ticketsIniciales);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    cliente_nombre: "",
    cliente_contacto: "",
    canal_origen: "INSTAGRAM" as
      | "INSTAGRAM"
      | "WHATSAPP"
      | "PRESENCIAL"
      | "OTRO",
    asunto: "",
    descripcion: "",
    prioridad: "MEDIA" as "BAJA" | "MEDIA" | "ALTA" | "CRITICA",
  });

  const handleStatusChange = (
    id: string,
    nuevoEstatus: "ABIERTO" | "EN_PROCESO" | "RESUELTO" | "CERRADO",
  ) => {
    startTransition(async () => {
      const res = await updateSupportTicketStatusAction(id, nuevoEstatus);
      if (res.success) {
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, estatus: nuevoEstatus } : t)),
        );
      } else {
        alert(res.error || "Error al actualizar estatus");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupportTicketAction(form);
      if (res.success) {
        setShowModal(false);
        setForm({
          cliente_nombre: "",
          cliente_contacto: "",
          canal_origen: "INSTAGRAM",
          asunto: "",
          descripcion: "",
          prioridad: "MEDIA",
        });
        window.location.reload();
      } else {
        alert(res.error || "Error al crear el ticket de soporte");
      }
    });
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "CRITICA":
        return "bg-rose-950 text-rose-300 border-rose-800/50";
      case "ALTA":
        return "bg-amber-950 text-amber-300 border-amber-800/50";
      case "MEDIA":
        return "bg-sky-950 text-sky-300 border-sky-800/50";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎧</span> Atención al Cliente e Incidencias
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de reclamos, soporte e incidencias canalizadas desde redes
            sociales.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
        >
          + Nueva Incidencia
        </button>
      </div>

      {/* Lista de Tickets */}
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500 text-xs">
            No hay casos o incidencias registradas en el sistema.
          </div>
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${getPriorityBadge(
                      t.prioridad,
                    )}`}
                  >
                    {t.prioridad}
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {t.canal_origen}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {t.cliente_nombre}
                  </span>
                  {t.cliente_contacto && (
                    <span className="text-xs font-mono text-slate-500">
                      ({t.cliente_contacto})
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-200">{t.asunto}</h3>
                <p className="text-xs text-slate-400">{t.descripcion}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  disabled={isPending}
                  value={t.estatus}
                  onChange={(e) =>
                    handleStatusChange(
                      t.id,
                      e.target.value as
                        | "ABIERTO"
                        | "EN_PROCESO"
                        | "RESUELTO"
                        | "CERRADO",
                    )
                  }
                  className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ABIERTO">ABIERTO</option>
                  <option value="EN_PROCESO">EN PROCESO</option>
                  <option value="RESUELTO">RESUELTO</option>
                  <option value="CERRADO">CERRADO</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Registrar Incidencia */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-white">
              Registrar Incidencia
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  value={form.cliente_nombre}
                  onChange={(e) =>
                    setForm({ ...form, cliente_nombre: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  placeholder="ej. Maria Pérez"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Contacto / User
                  </label>
                  <input
                    type="text"
                    value={form.cliente_contacto}
                    onChange={(e) =>
                      setForm({ ...form, cliente_contacto: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    placeholder="@usuario / telf"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Canal Origen
                  </label>
                  <select
                    value={form.canal_origen}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        canal_origen: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Prioridad
                </label>
                <select
                  value={form.prioridad}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      prioridad: e.target.value as any,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                >
                  <option value="BAJA">Baja</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                  <option value="CRITICA">Crítica</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  required
                  value={form.asunto}
                  onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  placeholder="ej. Reclamo por producto en mal estado"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Descripción
                </label>
                <textarea
                  required
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  rows={3}
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
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
