"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SocialMediaShell from "./SocialMediaShell";
import { getDashboardNavigation, type DashboardNavigationPermission } from "@/lib/navigation/dashboardNavigation";
import type { AppRole } from "@/lib/auth/permissions";

export default function DashboardShell({
  children,
  roleLabel,
  roleCode,
  navigationPermissions,
  roleInitials,
  userEmail,
}: {
  children: React.ReactNode;
  roleLabel: string;
  roleCode: AppRole;
  navigationPermissions: DashboardNavigationPermission[];
  roleInitials: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const roleNavigation = getDashboardNavigation(
    roleCode,
    new Set<DashboardNavigationPermission>(navigationPermissions),
  );

  return (
    <SocialMediaShell
      navGroups={roleNavigation}
      activePath={pathname}
      roleLabel={roleLabel}
      roleInitials={roleInitials}
      userEmail={userEmail}
    >
      {children}
    </SocialMediaShell>
  );
}
