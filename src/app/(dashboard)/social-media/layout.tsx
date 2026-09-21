"use client";

import React, { useState, useEffect, useMemo } from "react";
import NewTicketModal from "./components/NewTicketModal";
import { useNavContext } from "../components/NavContext";

const socialMediaNavItems = [
  { href: "/social-media/campaigns", label: "Campañas", icon: <span>🎯</span> },
  { href: "/social-media/grid", label: "Parrilla Macro", icon: <span>📅</span> },
  { href: "/social-media/kanban", label: "Tablero Kanban", icon: <span>📋</span> },
  { href: "/social-media/shooting", label: "Modo Rodaje", icon: <span>🎥</span> },
  { href: "/social-media/requests", label: "Inbox Solicitudes", icon: <span>📥</span> },
];

export default function SocialMediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setExtraNavItems } = useNavContext();

  useEffect(() => {
    setExtraNavItems(socialMediaNavItems);
    return () => setExtraNavItems([]);
  }, [setExtraNavItems]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* TopBar Superior */}
      <header className="h-14 bg-slate-900/80 border-b border-slate-800 px-6 flex items-center justify-between backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>Sedes:</span>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
            Prebo
          </span>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
            Mañongo
          </span>
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
      <NewTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}