"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export interface Campana {
  id: string;
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
  estatus: "PLANIFICADA" | "ACTIVA" | "FINALIZADA";
  created_at?: string;
}

export async function getCampaignsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campanas")
      .select("*")
      .order("fecha_inicio", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data as Campana[] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function createCampaignAction(datos: {
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("campanas").insert([
      {
        ...datos,
        estatus: "PLANIFICADA",
      },
    ]);

    if (error) return { success: false, error: error.message };

    revalidatePath("/campaigns");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
