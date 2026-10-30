"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import NewTicketModal from "./components/NewTicketModal";
import { GridIndicatorChips } from "./components/GridIndicatorChips";
import { NEW_PUBLICATION_EVENT } from "./events";
import { useRegisterShellSlots } from "../components/ShellSlot";
import type { GridIndicators } from "./grid/utils/quickViews";
import type { ContentCategoryOption } from "./grid/components/ContentCategorySelector";
import type { CampanaPublicacionGrid } from "@/app/actions/campanas/campaigns";
import type { SocialAccountOption } from "@/types";

export default function SocialMediaLayoutClient({
  children,
  indicators,
  contentCategories,
  campaigns,
  accounts,
}: {
  children: React.ReactNode;
  indicators: GridIndicators | null;
  contentCategories: ContentCategoryOption[];
  campaigns: CampanaPublicacionGrid[];
  accounts: SocialAccountOption[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pathname = usePathname();
  const isCampaignsPage = pathname === "/social-media/campaigns";
  const isEfemeridesPage = pathname === "/social-media/efemerides";
  const isGridPage = pathname === "/social-media/grid";

  // En el calendario el modal vive dentro de la vista (salta al mes y selecciona la card nueva).
  const handleCreate = () => {
    if (isGridPage) window.dispatchEvent(new Event(NEW_PUBLICATION_EVENT));
    else setIsModalOpen(true);
  };

  const topbar = (
    <header
      className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3.5 py-2 min-[768px]:h-16 min-[768px]:flex-nowrap min-[768px]:px-8 min-[768px]:py-0"
      style={{ background: "var(--papel)", borderColor: "#e1e6ee" }}
    >
      {isGridPage && (
        <div className="order-2 flex min-w-0 basis-full items-center min-[768px]:order-none min-[768px]:flex-1 min-[768px]:basis-auto">
          <GridIndicatorChips indicators={indicators} />
        </div>
      )}

      <div className="order-1 ml-auto flex items-center gap-2 min-[768px]:order-none min-[768px]:gap-3">
        {!isEfemeridesPage && !isCampaignsPage && <button
          onClick={handleCreate}
          type="button"
          aria-haspopup="dialog"
          className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066d2] focus-visible:ring-offset-2 min-[768px]:px-3.5 min-[768px]:py-2.25 min-[768px]:text-sm"
          style={{ background: "#ed8b19", color: "#2E1600" }}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>Nueva publicación</span>
        </button>}
      </div>
    </header>
  );

  useRegisterShellSlots(topbar);

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
