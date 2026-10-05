"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SocialMediaShell from "./components/SocialMediaShell";
import type { NavGroup } from "./components/SocialMediaShell";

/**
 * Grupos de navegación transversales, siempre visibles sin importar el
 * perfil activo. Los grupos exclusivos de un perfil (ej. social-media) se
 * agregan dinámicamente en el layout de ese perfil — ver
 * social-media/layout.tsx y la nota en SocialMediaShell.tsx sobre por qué
 * el shell solo se monta aquí.
 */
const navGroupsTransversales: NavGroup[] = [];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SocialMediaShell navGroups={navGroupsTransversales} activePath={pathname}>
      {children}
    </SocialMediaShell>
  );
}
