"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { Publicacion } from "@/types";

export interface ObtenerPautasInput {
  sede?: string;
  estatus?: string[];
}

export async function getShootingPostsAction(input?: ObtenerPautasInput) {
  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("publicaciones")
      .select("*")
      .in("estatus", input?.estatus || ["PENDIENTE_BRIEF", "EN_RODAJE"])
      .order("fecha_publicacion", { ascending: true });

    if (input?.sede) {
      query = query.eq("sede", input.sede);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data as Publicacion[] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function updateShootingStatusAction(
  publicacionId: string,
  nuevoEstatus: "EN_DISENO" | "EN_RODAJE",
) {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("publicaciones")
      .update({ estatus: nuevoEstatus, updated_at: new Date().toISOString() })
      .eq("id", publicacionId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/shooting");
    revalidatePath("/kanban");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
