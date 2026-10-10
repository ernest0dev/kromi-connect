"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  CalendarRange,
  Plus,
  CalendarHeart,
  Target,
  Archive,
} from "lucide-react";
import NewTicketModal from "./components/NewTicketModal";
import { useRegisterShellSlots } from "../components/ShellSlot";
import type { NavGroup } from "../components/SocialMediaShell";
import type { SlaSummary } from "./layout";
import type { ContentCategoryOption } from "./grid/components/ContentCategorySelector";
import type { CampanaPublicacionGrid } from "@/app/actions/campanas/campaigns";
import type { SocialAccountOption } from "@/types";

const navGroupsSocialMedia: NavGroup[] = [
  {
    label: "Social media",
    items: [
      { href: "/social-media/efemerides", label: "Efemérides", icon: CalendarHeart },
      { href: "/social-media/campaigns", label: "Campañas", icon: Target },
        {
          href: "/social-media/grid",
          label: "Calendario de contenido",
          icon: CalendarRange,
        },
      { href: "/social-media/grid/archive", label: "Archivo", icon: Archive },
    ],
  },
];

export default function SocialMediaLayoutClient({
  children,
  slaSummary,
  contentCategories,
  campaigns,
  accounts,
}: {
  children: React.ReactNode;
  slaSummary: SlaSummary | null;
  contentCategories: ContentCategoryOption[];
  campaigns: CampanaPublicacionGrid[];
  accounts: SocialAccountOption[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pathname = usePathname();
  const isCampaignsPage = pathname === "/social-media/campaigns";
  const isEfemeridesPage = pathname === "/social-media/efemerides";
  const tieneAlertas =
    !!slaSummary && (slaSummary.vencidos > 0 || slaSummary.hoy > 0);

  const topbar = (
    <header
      className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3.5 py-2 min-[768px]:h-16 min-[768px]:flex-nowrap min-[768px]:px-8 min-[768px]:py-0"
      style={{ background: "var(--papel)", borderColor: "#e1e6ee" }}
    >
      <div
        className="flex min-w-0 items-center gap-1.5 text-[11px] max-[380px]:hidden min-[768px]:gap-2 min-[768px]:text-xs"
        style={{ color: "var(--gris)" }}
      >
        <span className="font-medium">Sedes</span>
        <span
          className="rounded-full border px-2 py-1 text-[10px] min-[768px]:px-2.5 min-[768px]:py-1.25 min-[768px]:text-[11px]"
          style={{
            background: "#f8f9fb",
            borderColor: "#e1e6ee",
            color: "var(--tinta)",
          }}
        >
          Prebo
        </span>
        <span
          className="rounded-full border px-2 py-1 text-[10px] min-[768px]:px-2.5 min-[768px]:py-1.25 min-[768px]:text-[11px]"
          style={{
            background: "#f8f9fb",
            borderColor: "#e1e6ee",
            color: "var(--tinta)",
          }}
        >
          Mañongo
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 min-[768px]:gap-3">
        {!isCampaignsPage && (slaSummary === null ? (
          <span role="status" className="text-[11px] text-slate-500 min-[768px]:text-xs">
            SLA no disponible
          </span>
        ) : tieneAlertas ? (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.75 py-1.75 text-[11px] font-semibold"
            style={{
              background: "#fff3dc",
              color: "#9b5b08",
              borderColor: "#f0d7a5",
            }}
            aria-label={`${slaSummary.vencidos} vencidos y ${slaSummary.hoy} con fecha límite hoy`}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            <span className="hidden min-[400px]:inline">{`${slaSummary.vencidos} vencido${slaSummary.vencidos !== 1 ? "s" : ""} · ${slaSummary.hoy} hoy`}</span>
            <span className="min-[400px]:hidden">{slaSummary.vencidos} venc. · {slaSummary.hoy} hoy</span>
          </span>
        ) : null)}
        {!isEfemeridesPage && !isCampaignsPage && <button
          onClick={() => setIsModalOpen(true)}
          type="button"
          aria-haspopup="dialog"
          className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066d2] focus-visible:ring-offset-2 min-[768px]:px-3.5 min-[768px]:py-2.25 min-[768px]:text-sm"
          style={{ background: "#ed8b19", color: "#2E1600" }}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>Nuevo ticket</span>
        </button>}
      </div>
    </header>
  );

  useRegisterShellSlots(topbar, navGroupsSocialMedia);

  return (
    <>
      {children}
      <NewTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={contentCategories}
        campaigns={campaigns}
        accounts={accounts}
      />
    </>
  );
}
