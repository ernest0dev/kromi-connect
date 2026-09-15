"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { calcularMatrizSLA } from "@/utils/sla";

export async function getRequestsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("solicitudes_terceros")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function processRequestAction(
  solicitudId: string,
  aprobar: boolean,
  datosPublicacion?: {
    titulo: string;
    formato: "POST" | "REEL" | "STORY" | "CARRUSEL";
    fecha_publicacion: string;
  },
) {
  try {
    const supabase = getSupabaseAdmin();

    if (!aprobar) {
      const { error } = await supabase
        .from("solicitudes_terceros")
        .update({ estatus: "RECHAZADO" })
        .eq("id", solicitudId);

      if (error) return { success: false, error: error.message };
      revalidatePath("/requests");
      return { success: true };
    }

    if (!datosPublicacion) {
      return {
        success: false,
        error: "Se requieren datos para crear la publicación",
      };
    }

    // Calcular SLA (Regla 3+2)
    const { fecha_limite_brief, fecha_entrega_diseno_estimada } =
      calcularMatrizSLA(datosPublicacion.fecha_publicacion);

    // 1. Crear el ticket en la tabla de publicaciones
    const { error: postError } = await supabase.from("publicaciones").insert([
      {
        titulo: datosPublicacion.titulo,
        formato: datosPublicacion.formato,
        fecha_publicacion: datosPublicacion.fecha_publicacion,
        fecha_limite_brief,
        fecha_entrega_diseno_estimada,
        estatus: "PENDIENTE_BRIEF",
      },
    ]);

    if (postError) return { success: false, error: postError.message };

    // 2. Marcar la solicitud como aprobada
    await supabase
      .from("solicitudes_terceros")
      .update({ estatus: "APROBADO" })
      .eq("id", solicitudId);

    revalidatePath("/requests");
    revalidatePath("/kanban");
    revalidatePath("/grid");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
