import React from "react";
import { requireUser } from "@/lib/auth/dal";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/permissions";
import DashboardShell from "./components/DashboardShell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser();
  const role = profile.role_code as AppRole;
  if (role === "pending") redirect("/access-pending");

  return (
    <DashboardShell
      roleLabel={ROLE_LABELS[role] ?? "Usuario"}
      roleInitials={ROLE_LABELS[role]?.slice(0, 2).toUpperCase() ?? "KC"}
      userEmail={user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
