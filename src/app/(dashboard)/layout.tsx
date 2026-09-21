"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Building2, Headset } from "lucide-react";
import SocialMediaShell, { NavGroup } from "./components/SocialMediaShell";

/**
 * Grupos de navegación transversales, siempre visibles sin importar el
 * perfil activo. Los grupos exclusivos de un perfil (ej. social-media) se
 * agregan dinámicamente en el layout de ese perfil — ver
 * social-media/layout.tsx y la nota en SocialMediaShell.tsx sobre por qué
 * el shell solo se monta aquí.
 */
const navGroupsTransversales: NavGroup[] = [
  {
    label: "Transversal",
    items: [
      { href: "/third-parties", label: "Clientes / Aliados", icon: Building2 },
      { href: "/support", label: "Atención / Soporte", icon: Headset },
    ],
  },
];

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