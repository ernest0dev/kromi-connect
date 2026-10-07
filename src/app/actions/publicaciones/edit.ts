"use server";

import { revalidatePath } from "next/cache";
import { EstatusEnum, FormatoEnum, Publicacion, PublicacionConCuentas } from "@/types";
import { authorizeAction } from "@/lib/auth/dal";
import { calcularMatrizSLA } from "@/utils/sla";

const FORMATOS: FormatoEnum[] = ["CARRUSEL", "POST", "REEL", "STORY"];
const ESTADOS: EstatusEnum[] = [
  "PENDIENTE_BRIEF", "EN_RODAJE", "EN_DISENO", "EN_REVISION_CM",
  "RECHAZADO_DISENO", "PENDIENTE_APROBACION_GERENCIA", "APROBADO", "PROGRAMADO", "PUBLICADO",
  "SOLICITADO", "EN_CORRECCION", "CANCELADO", "INCOMPLETO",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface EditPublicacionInput {
  publicacionId: string;
  titulo: string;
  formato: FormatoEnum;
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
  categoria_ids: string[];
  social_account_ids: string[];
}

export async function editPublicacionAction(input: EditPublicacionInput): Promise<
  { success: true; data: PublicacionConCuentas } | { success: false; error: string }
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
  if (!Array.isArray(input.categoria_ids) || input.categoria_ids.some((id) => typeof id !== "string")) {
    return { success: false, error: "La selección de temas no es válida." };
  }

  if (!Array.isArray(input.social_account_ids) || input.social_account_ids.length === 0 || input.social_account_ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return { success: false, error: "Selecciona al menos una cuenta social válida." };
  }

  const editAccess = await authorizeAction("social-media.posts.edit");
  if (editAccess.error) return { success: false, error: editAccess.error };
  if (!editAccess.context) return { success: false, error: "Inicia sesión para continuar." };

  try {
    const supabase = editAccess.context.supabase;
    const { data: canManageAllAccounts, error: accountScopeError } = await supabase.rpc("user_has_all_publication_accounts", {
      p_publicacion_id: input.publicacionId,
    });
    if (accountScopeError || !canManageAllAccounts) {
      return { success: false, error: accountScopeError?.message || "Para editar esta publicación necesitas tener asignadas todas sus cuentas destino." };
    }
    const selectedAccountIds = [...new Set(input.social_account_ids)];
    const { data: assignedAccounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("id, platform")
      .in("id", selectedAccountIds);
    if (accountsError) return { success: false, error: `No se pudieron validar las cuentas: ${accountsError.message}` };
    if ((assignedAccounts || []).length !== selectedAccountIds.length) {
      return { success: false, error: "Una o más cuentas ya no están asignadas a tu usuario o están inactivas." };
    }
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

    const fechaSolicitudDiseno = input.estatus === "SOLICITADO"
      ? input.fecha_solicitud_diseno || current.fecha_solicitud_diseno || new Date().toISOString()
      : input.fecha_solicitud_diseno;
    const slaChanged = current.fecha_publicacion !== input.fecha_publicacion
      || current.fecha_solicitud_diseno !== fechaSolicitudDiseno;
    const slaDates = slaChanged
      ? calcularMatrizSLA(input.fecha_publicacion, fechaSolicitudDiseno)
      : null;

    const { data: publicationJson, error } = await supabase.rpc("update_publicacion_with_relations", {
      p_publicacion_id: input.publicacionId,
      p_titulo: input.titulo.trim(),
      p_formato: input.formato,
      p_fecha_publicacion: input.fecha_publicacion,
      p_campana_id: input.campana_id,
      p_fecha_solicitud_diseno: fechaSolicitudDiseno,
      p_fecha_entrega_diseno_real: input.fecha_entrega_diseno_real,
      p_fecha_aprobacion_gerencia: input.fecha_aprobacion_gerencia,
      p_estatus: input.estatus,
      p_hook_texto: input.hook_texto?.trim() || null,
      p_body_texto: input.body_texto?.trim() || null,
      p_cta_texto: input.cta_texto?.trim() || null,
      p_hashtags: input.hashtags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
      p_fecha_limite_brief: slaDates?.fecha_limite_brief || null,
      p_fecha_entrega_diseno_estimada: slaDates?.fecha_entrega_diseno_estimada || null,
      p_social_account_ids: selectedAccountIds,
      p_categoria_ids: input.categoria_ids,
    });
    if (error) return { success: false, error: `No se pudieron guardar los cambios: ${error.message}` };
    const data = publicationJson as unknown as Publicacion;
    if (!data?.id) return { success: false, error: "Supabase no devolvió la publicación actualizada." };
    const categoryRows = input.categoria_ids.length
      ? await supabase.from("categorias_contenido").select("id, nombre").in("id", input.categoria_ids)
      : { data: [], error: null };

    revalidatePath("/social-media/grid");
    revalidatePath("/social-media/kanban");
    return { success: true, data: { ...data, linea_contenido: (categoryRows.data || []).map((category) => category.nombre).join(", ") || data.linea_contenido, social_account_ids: selectedAccountIds } as PublicacionConCuentas };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Ocurrió un error inesperado al guardar la publicación." };
  }
}
