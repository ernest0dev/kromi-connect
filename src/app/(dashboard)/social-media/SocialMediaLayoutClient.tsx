"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Inbox,
  Kanban,
  Plus,
  Target,
  Video,
} from "lucide-react";
import NewTicketModal from "./components/NewTicketModal";
import { useRegisterShellSlots } from "../components/ShellSlot";
import type { NavGroup } from "../components/SocialMediaShell";
import type { SlaSummary } from "./layout";

const navGroupsSocialMedia: NavGroup[] = [
  {
    label: "Social media",
    items: [
      { href: "/social-media/campaigns", label: "Campañas", icon: Target },
      { href: "/social-media/grid", label: "Parrilla macro", icon: CalendarRange },
      { href: "/social-media/kanban", label: "Tablero kanban", icon: Kanban },
      { href: "/social-media/shooting", label: "Modo rodaje", icon: Video },
      { href: "/social-media/requests", label: "Inbox solicitudes", icon: Inbox },
    ],
  },
];

export default function SocialMediaLayoutClient({
  children,
  slaSummary,
}: {
  children: React.ReactNode;
  slaSummary: SlaSummary | null;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tieneAlertas = !!slaSummary && (slaSummary.vencidos > 0 || slaSummary.hoy > 0);

  const topbar = (
    <header
      className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3.5 py-2 md:h-16 md:flex-nowrap md:px-8 md:py-0"
      style={{ background: "var(--papel)", borderColor: "var(--borde)" }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--gris)" }}>
        <span className="font-medium">Sedes:</span>
        <span className="rounded-full border px-2.5 py-1" style={{ background: "var(--hueso)", borderColor: "var(--borde)", color: "var(--tinta)" }}>
          Prebo
        </span>
        <span className="rounded-full border px-2.5 py-1" style={{ background: "var(--hueso)", borderColor: "var(--borde)", color: "var(--tinta)" }}>
          Mañongo
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {slaSummary && (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold md:px-3"
            style={
              tieneAlertas
                ? {
                    background: "color-mix(in srgb, var(--naranja) 15%, white)",
                    color: "#8A4B0C",
                    borderColor: "var(--naranja)",
                  }
                : {
                    background: "color-mix(in srgb, var(--verde) 12%, white)",
                    color: "#256B3A",
                    borderColor: "var(--verde)",
                  }
            }
            aria-label={
              tieneAlertas
                ? `${slaSummary.vencidos} vencidos y ${slaSummary.hoy} con fecha límite hoy`
                : "Sin tickets en riesgo"
            }
          >
            {tieneAlertas && <AlertTriangle size={13} aria-hidden="true" />}
            {tieneAlertas
              ? `${slaSummary.vencidos} vencido${slaSummary.vencidos !== 1 ? "s" : ""} · ${slaSummary.hoy} hoy`
              : "Sin tickets en riesgo"}
          </span>
        )}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-2 md:px-4 md:text-sm"
          style={{ background: "var(--naranja)", color: "#2E1600" }}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>Nuevo ticket</span>
        </button>
      </div>
    </header>
  );

  useRegisterShellSlots(topbar, navGroupsSocialMedia);

  return (
    <>
      {children}
      <NewTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
