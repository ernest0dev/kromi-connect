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
    campana_id?: string;
  },
) {
  try {
    const supabase = getSupabaseAdmin();

    if (!aprobar) {
      const { error } = await supabase
        .from("solicitudes_terceros")
        .update({ estatus_solicitud: "RECHAZADO" })
        .eq("id", solicitudId);

      if (error) return { success: false, error: error.message };
      revalidatePath("/social-media/requests");
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
    const { data: nuevaPublicacion, error: postError } = await supabase
      .from("publicaciones")
      .insert([
        {
          titulo: datosPublicacion.titulo,
          formato: datosPublicacion.formato,
          fecha_publicacion: datosPublicacion.fecha_publicacion,
          fecha_limite_brief,
          fecha_entrega_diseno_estimada,
          campana_id: datosPublicacion.campana_id || null,
          estatus: "PENDIENTE_BRIEF",
        },
      ])
      .select()
      .single();

    if (postError) return { success: false, error: postError.message };

    // 2. Marcar la solicitud como convertida y vincularla al ticket creado
    await supabase
      .from("solicitudes_terceros")
      .update({
        estatus_solicitud: "CONVERTIDA",
        publicacion_id: nuevaPublicacion.id,
      })
      .eq("id", solicitudId);

    revalidatePath("/social-media/requests");
    revalidatePath("/social-media/kanban");
    revalidatePath("/social-media/grid");

    return { success: true, data: nuevaPublicacion };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
