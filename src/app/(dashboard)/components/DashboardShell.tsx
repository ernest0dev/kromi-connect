"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import SocialMediaShell from "./SocialMediaShell";

export default function DashboardShell({
  children,
  roleLabel,
  roleCode,
  roleInitials,
  userEmail,
}: {
  children: React.ReactNode;
  roleLabel: string;
  roleCode: string;
  roleInitials: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <SocialMediaShell
      navGroups={["social-media", "events", "internal"].includes(roleCode) ? [{ label: "Solicitudes", items: [{ href: "/requests", label: "Solicitudes", icon: FilePlus2 }] }] : []}
      activePath={pathname}
      roleLabel={roleLabel}
      roleInitials={roleInitials}
      userEmail={userEmail}
    >
      {children}
    </SocialMediaShell>
  );
}
