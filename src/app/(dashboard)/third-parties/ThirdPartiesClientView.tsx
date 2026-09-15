"use client";

import React, { useState, useTransition } from "react";
import { Tercero, createThirdPartyAction } from "@/app/actions/thirdParties";

interface Props {
  tercerosIniciales: Tercero[];
}

export default function ThirdPartiesClientView({ tercerosIniciales }: Props) {
  const [terceros, setTerceros] = useState<Tercero[]>(tercerosIniciales);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    nombre_comercial: "",
    razon_social: "",
    tipo: "MARCA_ALIADA" as "MARCA_ALIADA" | "PROVEEDOR" | "INTERNO",
    contacto_nombre: "",
    contacto_email: "",
    contacto_telefono: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createThirdPartyAction(form);
      if (res.success) {
        setShowModal(false);
        setForm({
          nombre_comercial: "",
          razon_social: "",
          tipo: "MARCA_ALIADA",
          contacto_nombre: "",
          contacto_email: "",
          contacto_telefono: "",
        });
        window.location.reload();
      } else {
        alert(res.error || "Error al guardar el registro");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🏢</span> Clientes y Marcas Aliadas
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Directorio centralizado de marcas, proveedores y contactos
            comerciales.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
        >
          + Nuevo Aliado / Cliente
        </button>
      </div>

      {/* Grid de Registros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {terceros.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500 text-xs">
            No hay clientes o marcas registradas en la base de datos.
          </div>
        ) : (
          terceros.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                    {t.tipo}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">
                  {t.nombre_comercial}
                </h3>
                {t.razon_social && (
                  <p className="text-xs font-mono text-slate-400">
                    {t.razon_social}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-1 text-xs text-slate-300 font-mono">
                {t.contacto_nombre && <p>👤 {t.contacto_nombre}</p>}
                {t.contacto_email && <p>✉️ {t.contacto_email}</p>}
                {t.contacto_telefono && <p>📞 {t.contacto_telefono}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Agregar Registro */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-white">
              Registrar Nuevo Aliado
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  required
                  value={form.nombre_comercial}
                  onChange={(e) =>
                    setForm({ ...form, nombre_comercial: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  placeholder="ej. Pepsi Venezuela"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={form.razon_social}
                    onChange={(e) =>
                      setForm({ ...form, razon_social: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tipo: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="MARCA_ALIADA">Marca Aliada</option>
                    <option value="PROVEEDOR">Proveedor</option>
                    <option value="INTERNO">Interno</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nombre del Contacto
                </label>
                <input
                  type="text"
                  value={form.contacto_nombre}
                  onChange={(e) =>
                    setForm({ ...form, contacto_nombre: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.contacto_email}
                    onChange={(e) =>
                      setForm({ ...form, contacto_email: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.contacto_telefono}
                    onChange={(e) =>
                      setForm({ ...form, contacto_telefono: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
