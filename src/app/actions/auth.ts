"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    return { error: "Escribe un correo y una contraseña válidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "No se pudo iniciar sesión. Revisa tus datos e inténtalo otra vez." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No se pudo verificar la sesión. Inténtalo otra vez." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role_code === "social-media") redirect("/social-media/grid");
  if (profile?.role_code === "customer-support") redirect("/support");
  redirect("/access-pending");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
