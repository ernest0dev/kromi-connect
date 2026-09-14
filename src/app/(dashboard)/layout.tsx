'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import NuevoTicketModal from './components/NewTicketModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Lateral */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Header & Logo */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black tracking-wider text-white">
                KROMI <span className="text-emerald-500">CONNECT</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                CRM / CMS Audiovisual
              </p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Menú de Navegación */}
          <nav className="p-4 space-y-1 text-sm font-medium">
            <Link
              href="/parrilla"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <span>📅</span>
              <span>Parrilla Macro</span>
            </Link>

            <Link
              href="/kanban"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <span>📋</span>
              <span>Tablero Kanban</span>
            </Link>

            <Link
              href="/rodaje"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <span>🎥</span>
              <span>Modo Rodaje</span>
            </Link>

            <Link
              href="/solicitudes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <span>📥</span>
              <span>Inbox Solicitudes</span>
            </Link>
          </nav>
        </div>

        {/* Footer Sidebar / Perfil */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-950 border border-emerald-600/50 flex items-center justify-center text-emerald-400 text-xs font-bold">
              SM
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">
                Social Media Manager
              </p>
              <span className="text-[9px] text-emerald-400 font-mono block">
                Rol Operativo Activo
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal de Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar Superior */}
        <header className="h-14 bg-slate-900/80 border-b border-slate-800 px-6 flex items-center justify-between backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Sedes:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">Prebo</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">Mañongo</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] bg-amber-950/60 border border-amber-800/50 text-amber-300 px-2.5 py-1 rounded-md font-mono hidden sm:inline-block">
              ⚡ SLA 3+2: Brief -5d | Rodaje -3d
            </span>

            {/* Gatillo de apertura del Modal de Creación */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-md shadow-emerald-950 flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Nuevo Ticket</span>
            </button>
          </div>
        </header>

        {/* Contenido Dinámico de la Ruta */}
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>

        {/* Modal Global de Creación de Tickets */}
        <NuevoTicketModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  );
}