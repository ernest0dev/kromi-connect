"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SocialMediaShell from "./SocialMediaShell";

export default function DashboardShell({
  children,
  roleLabel,
  roleInitials,
  userEmail,
}: {
  children: React.ReactNode;
  roleLabel: string;
  roleInitials: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <SocialMediaShell
      navGroups={[]}
      activePath={pathname}
      roleLabel={roleLabel}
      roleInitials={roleInitials}
      userEmail={userEmail}
    >
      {children}
    </SocialMediaShell>
  );
}
