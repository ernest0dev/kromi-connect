import React from "react";
import { requireUser } from "@/lib/auth/dal";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/permissions";
import { DASHBOARD_NAVIGATION_PERMISSIONS } from "@/lib/navigation/dashboardNavigation";
import DashboardShell from "./components/DashboardShell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, supabase } = await requireUser();
  const role = profile.role_code as AppRole;
  if (role === "pending") redirect("/access-pending");

  const permissionResults = await Promise.all(DASHBOARD_NAVIGATION_PERMISSIONS.map(async (permission) => {
    const { data, error } = await supabase.rpc("has_permission", {
      required_permission: permission,
    });
    return !error && data === true ? permission : null;
  }));
  const navigationPermissions = permissionResults.filter(
    (permission): permission is (typeof DASHBOARD_NAVIGATION_PERMISSIONS)[number] => permission !== null,
  );

  return (
    <DashboardShell
      roleCode={role}
      navigationPermissions={navigationPermissions}
      roleLabel={ROLE_LABELS[role] ?? "Usuario"}
      roleInitials={ROLE_LABELS[role]?.slice(0, 2).toUpperCase() ?? "KC"}
      userEmail={user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
