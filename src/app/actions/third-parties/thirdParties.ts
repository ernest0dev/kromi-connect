"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";

export interface Tercero {
  id: string;
  nombre_comercial: string;
  razon_social?: string;
  tipo: "MARCA_ALIADA" | "PROVEEDOR" | "INTERNO";
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
  created_at?: string;
}

export async function getThirdPartiesAction() {
  const access = await authorizeAction("third-parties.read");
  if (access.error) return { success: false, error: access.error, data: [] };
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("terceros")
      .select("*")
      .order("nombre_comercial", { ascending: true });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data as Tercero[] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function createThirdPartyAction(datos: {
  nombre_comercial: string;
  razon_social?: string;
  tipo: "MARCA_ALIADA" | "PROVEEDOR" | "INTERNO";
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
}) {
  const access = await authorizeAction("third-parties.create");
  if (access.error) return { success: false, error: access.error };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("terceros").insert([datos]);

    if (error) return { success: false, error: error.message };

    revalidatePath("/third-parties");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
