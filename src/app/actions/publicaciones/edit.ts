"use server";

import { revalidatePath } from "next/cache";
import { EstatusEnum, FormatoEnum, Publicacion } from "@/types";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";
import { calcularMatrizSLA } from "@/utils/sla";

const FORMATOS: FormatoEnum[] = ["CARRUSEL", "POST", "REEL", "STORY"];
const ESTADOS: EstatusEnum[] = [
  "PENDIENTE_BRIEF", "EN_RODAJE", "EN_DISENO", "EN_REVISION_CM",
  "RECHAZADO_DISENO", "PENDIENTE_APROBACION_GERENCIA", "APROBADO", "PROGRAMADO", "PUBLICADO",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface EditPublicacionInput {
  publicacionId: string;
  titulo: string;
  formato: FormatoEnum;
  linea_contenido: string | null;
  fecha_publicacion: string;
  fecha_solicitud_diseno: string | null;
  fecha_entrega_diseno_real: string | null;
  fecha_aprobacion_gerencia: string | null;
  estatus: EstatusEnum;
  hook_texto: string | null;
  body_texto: string | null;
  cta_texto: string | null;
  hashtags: string[];
  campana_id: string | null;
}

export async function editPublicacionAction(input: EditPublicacionInput): Promise<
  { success: true; data: Publicacion } | { success: false; error: string }
> {
  if (!input || typeof input !== "object") {
    return { success: false, error: "No se recibieron datos de edición válidos." };
  }
  if (!input.publicacionId || !UUID_PATTERN.test(input.publicacionId)) {
    return { success: false, error: "El identificador de la publicación no es válido." };
  }
  if (typeof input.titulo !== "string" || !input.titulo.trim()) return { success: false, error: "El título es obligatorio." };
  if (!FORMATOS.includes(input.formato)) return { success: false, error: "El formato indicado no es válido." };
  if (!ESTADOS.includes(input.estatus)) return { success: false, error: "El estado indicado no es válido." };
  const publicationDate = /^\d{4}-\d{2}-\d{2}$/.test(input.fecha_publicacion)
    ? new Date(`${input.fecha_publicacion}T00:00:00Z`)
    : null;
  if (!publicationDate || Number.isNaN(publicationDate.getTime()) || publicationDate.toISOString().slice(0, 10) !== input.fecha_publicacion) {
    return { success: false, error: "La fecha de publicación no es válida." };
  }
  if (input.campana_id && !UUID_PATTERN.test(input.campana_id)) {
    return { success: false, error: "La campaña seleccionada no es válida." };
  }
  if (!Array.isArray(input.hashtags) || input.hashtags.some((tag) => typeof tag !== "string")) {
    return { success: false, error: "La lista de hashtags no es válida." };
  }

  const timestampFields = [input.fecha_solicitud_diseno, input.fecha_entrega_diseno_real, input.fecha_aprobacion_gerencia];
  if (timestampFields.some((value) => value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value))))) {
    return { success: false, error: "Una de las fechas operativas no es válida." };
  }

  const editAccess = await authorizeAction("social-media.posts.edit");
  if (editAccess.error) return { success: false, error: editAccess.error };

  try {
    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from("publicaciones")
      .select("fecha_publicacion, fecha_solicitud_diseno, estatus")
      .eq("id", input.publicacionId)
      .maybeSingle();
    if (readError) return { success: false, error: `No se pudo consultar la publicación: ${readError.message}` };
    if (!current) return { success: false, error: "La publicación ya no existe." };

    if (current.fecha_publicacion !== input.fecha_publicacion) {
      const rescheduleAccess = await authorizeAction("social-media.posts.reschedule");
      if (rescheduleAccess.error) return { success: false, error: rescheduleAccess.error };
    }
    if (current.estatus !== input.estatus) {
      const statusAccess = await authorizeAction("social-media.posts.status.update");
      if (statusAccess.error) return { success: false, error: statusAccess.error };
    }

    const slaChanged = current.fecha_publicacion !== input.fecha_publicacion
      || current.fecha_solicitud_diseno !== input.fecha_solicitud_diseno;
    const slaDates = slaChanged
      ? calcularMatrizSLA(input.fecha_publicacion, input.fecha_solicitud_diseno)
      : null;

    const { data, error } = await supabase
      .from("publicaciones")
      .update({
        titulo: input.titulo.trim(),
        formato: input.formato,
        linea_contenido: input.linea_contenido?.trim() || null,
        fecha_publicacion: input.fecha_publicacion,
        fecha_solicitud_diseno: input.fecha_solicitud_diseno,
        fecha_entrega_diseno_real: input.fecha_entrega_diseno_real,
        fecha_aprobacion_gerencia: input.fecha_aprobacion_gerencia,
        estatus: input.estatus,
        hook_texto: input.hook_texto?.trim() || null,
        body_texto: input.body_texto?.trim() || null,
        cta_texto: input.cta_texto?.trim() || null,
        hashtags: input.hashtags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
        campana_id: input.campana_id,
        ...(slaDates || {}),
      })
      .eq("id", input.publicacionId)
      .select()
      .maybeSingle();

    if (error) return { success: false, error: `No se pudieron guardar los cambios: ${error.message}` };
    if (!data) return { success: false, error: "La publicación fue eliminada antes de guardar los cambios." };

    revalidatePath("/social-media/grid");
    revalidatePath("/social-media/kanban");
    return { success: true, data: data as Publicacion };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Ocurrió un error inesperado al guardar la publicación." };
  }
}
