import "server-only";

import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppPermission, AppRole } from "./permissions";

export async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { supabase, user, profile: null, role: null };
  }

  return {
    supabase,
    user,
    profile,
    role: profile.role_code as AppRole,
  };
}

export async function hasPermission(permission: AppPermission): Promise<boolean> {
  const context = await getAuthContext();
  if (!context?.profile) return false;

  const { data, error } = await context.supabase.rpc("has_permission", {
    required_permission: permission,
  });

  return !error && data === true;
}

export async function requireUser() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (!context.profile) redirect("/access-pending");
  return context;
}

export async function requirePermission(permission: AppPermission) {
  const context = await requireUser();
  const { data, error } = await context.supabase.rpc("has_permission", {
    required_permission: permission,
  });

  if (error || data !== true) notFound();
  return context;
}

/** Server Action helper: returns an error message instead of throwing. */
export async function authorizeAction(permission: AppPermission) {
  const context = await getAuthContext();
  if (!context) return { context: null, error: "Inicia sesión para continuar." };
  if (!context.profile) return { context: null, error: "Tu perfil aún no está habilitado." };

  const { data, error } = await context.supabase.rpc("has_permission", {
    required_permission: permission,
  });

  if (error || data !== true) {
    return { context: null, error: "No tienes permiso para realizar esta acción." };
  }

  return { context, error: null };
}
