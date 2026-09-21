"use client";

import React, { useMemo, useState } from "react";
import {
  Target,
  CalendarRange,
  Kanban,
  Video,
  Inbox,
  Plus,
  AlertTriangle,
} from "lucide-react";
import NewTicketModal from "./components/NewTicketModal";
import { useRegisterShellSlots } from "../components/ShellSlot";
import type { NavGroup } from "../components/SocialMediaShell";

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

interface SlaSummary {
  vencidos: number;
  hoy: number;
}

interface Props {
  children: React.ReactNode;
  /**
   * Resumen de SLA. Ver nota al final de la respuesta sobre cómo completar
   * este dato desde el servidor — por ahora, si no se provee, el indicador
   * simplemente no se muestra (no se inventa un dato falso).
   */
  slaSummary?: SlaSummary;
}

/**
 * IMPORTANTE: este layout ya NO renderiza <SocialMediaShell>. El shell
 * (sidebar + <main>) se monta una sola vez en (dashboard)/layout.tsx, que
 * es el layout padre de esta ruta. Este componente solo se encarga de:
 *  1. Registrar el grupo de nav "Social media" en el sidebar del padre.
 *  2. Registrar su propio topbar (selector de sede, indicador SLA, botón
 *     "Nuevo ticket") en el slot del padre.
 *  3. Montar el modal de creación de tickets.
 *
 * Esto evita el bug de doble sidebar: antes, tanto este layout como el
 * padre montaban su propio <aside>, y Next.js los anidaba a ambos.
 */
export default function SocialMediaLayout({ children, slaSummary }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tieneAlertas = !!slaSummary && (slaSummary.vencidos > 0 || slaSummary.hoy > 0);

  const topbar = useMemo(() => (
    <header
      className="h-16 border-b px-6 flex items-center justify-between sticky top-0 z-10"
      style={{ background: "var(--papel)", borderColor: "var(--borde)" }}
    >
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--gris)" }}>
        <span className="font-medium">Sedes:</span>
        <span
          className="border px-2.5 py-1 rounded-full"
          style={{ background: "var(--hueso)", borderColor: "var(--borde)", color: "var(--tinta)" }}
        >
          Prebo
        </span>
        <span
          className="border px-2.5 py-1 rounded-full"
          style={{ background: "var(--hueso)", borderColor: "var(--borde)", color: "var(--tinta)" }}
        >
          Mañongo
        </span>
      </div>

      <div className="flex items-center gap-3">
        {slaSummary && (
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 border"
            style={
              tieneAlertas
                ? { background: "color-mix(in srgb, var(--naranja) 15%, white)", color: "#8A4B0C", borderColor: "var(--naranja)" }
                : { background: "color-mix(in srgb, var(--verde) 12%, white)", color: "#256B3A", borderColor: "var(--verde)" }
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
          className="text-sm font-semibold px-4 py-2 rounded-full transition flex items-center gap-1.5"
          style={{ background: "var(--naranja)", color: "#2E1600" }}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>Nuevo ticket</span>
        </button>
      </div>
    </header>
  ), [slaSummary, tieneAlertas]);

  useRegisterShellSlots(topbar, navGroupsSocialMedia);

  return (
    <>
      {children}
      <NewTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}