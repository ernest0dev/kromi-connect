"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/lib/auth/dal";
import { createPublicacionDriveFolder, deletePublicacionDriveFolder } from "@/lib/googleDrive";
import { FormatoEnum, PublicacionConCuentas, SedeEnum } from "@/types";
import { calcularMatrizSLA } from "@/utils/sla";
import { normalizeHashtagArray } from "@/utils/hashtags";

const FORMATOS_VALIDOS: FormatoEnum[] = ["CARRUSEL", "POST", "REEL", "STORY"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// src/app/actions/publicaciones/create.ts

export interface CreatePostInput {
  titulo: string;
  formato: FormatoEnum;
  fecha_publicacion: string;
  hora_publicacion?: string | null;
  campana_id?: string | null;
  categoria_ids?: string[];
  social_account_ids?: string[];
  hook_texto?: string;
  body_texto?: string;
  cta_texto?: string;
  hashtags?: string[];
  requiere_rodaje?: boolean;
  fecha_rodaje?: string | null;
  sedes?: SedeEnum[];
  prioridad?: number;
}

export async function createPostWithDriveAction(input: CreatePostInput) {
  const access = await authorizeAction("social-media.posts.create");
  if (access.error) return { success: false, error: access.error };
  if (!access.context) return { success: false, error: "Inicia sesión para continuar." };
  if (!input || typeof input.titulo !== "string" || !input.titulo.trim() || input.titulo.trim().length > 200 || !input.fecha_publicacion) {
    return { success: false, error: "El título (máximo 200 caracteres) y la fecha de publicación son obligatorios." };
  }
  if (!FORMATOS_VALIDOS.includes(input.formato)) return { success: false, error: "El formato indicado no es válido." };
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(input.fecha_publicacion) ? new Date(`${input.fecha_publicacion}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.fecha_publicacion) {
    return { success: false, error: "La fecha de publicación no es válida." };
  }
  if (input.campana_id && !UUID_PATTERN.test(input.campana_id)) return { success: false, error: "La campaña seleccionada no es válida." };
  const requestedAccountIds = input?.social_account_ids;
  if (!Array.isArray(requestedAccountIds) || requestedAccountIds.length === 0 || requestedAccountIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return { success: false, error: "Selecciona al menos una cuenta social válida." };
  }
  if (input.hashtags !== undefined && (!Array.isArray(input.hashtags) || input.hashtags.some((tag) => typeof tag !== "string"))) {
    return { success: false, error: "La lista de hashtags no es válida." };
  }
  if (input.formato === "STORY" && [input.hook_texto, input.body_texto, input.cta_texto, ...(input.hashtags || [])].some(Boolean)) {
    return { success: false, error: "Las Stories no admiten campos de copy." };
  }
  if (input.hora_publicacion && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.hora_publicacion)) return { success: false, error: 'La hora de publicación no es válida.' };
  const sedes = input.sedes || [];
  if (!Array.isArray(sedes) || sedes.some((sede) => !['PREBO', 'MANONGO'].includes(sede))) return { success: false, error: 'La selección de sedes no es válida.' };
  const prioridad = input.prioridad ?? 2;
  if (![1, 2, 3].includes(prioridad)) return { success: false, error: 'La prioridad no es válida.' };
  const fechaRodaje = input.requiere_rodaje
    ? input.fecha_rodaje || new Date(new Date(`${input.fecha_publicacion}T00:00:00Z`).getTime() - 3 * 86400000).toISOString().slice(0, 10)
    : null;
  const categoryIds = input.categoria_ids ?? [];
  if (!Array.isArray(categoryIds) || categoryIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return { success: false, error: "La selección de temas no es válida." };
  }
  try {
    const supabase = access.context.supabase;
    const selectedAccountIds = [...new Set(requestedAccountIds)];
    const { data: assignedAccounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("id, platform")
      .in("id", selectedAccountIds)
      .eq("active", true);
    if (accountsError) return { success: false, error: `No se pudieron validar las cuentas: ${accountsError.message}` };
    if ((assignedAccounts || []).length !== selectedAccountIds.length) {
      return { success: false, error: "Una o más cuentas ya no están asignadas a tu usuario o están inactivas." };
    }
    if (input.formato === 'STORY' && (assignedAccounts || []).some((account) => account.platform === 'YOUTUBE')) {
      return { success: false, error: 'YouTube no admite Stories. Quita esa cuenta o cambia el formato.' };
    }

    // 1. Crear carpeta dedicada en Google Drive
    const folderName = `[${input.formato}] ${input.fecha_publicacion} - ${input.titulo}`;
    const driveFolder = await createPublicacionDriveFolder(folderName);

    // 2. Guardar publicación, destinos y temas en una sola transacción RLS.
    const sla = calcularMatrizSLA(input.fecha_publicacion);
    const { data: publicationJson, error } = await supabase.rpc("create_publicacion_with_relations", {
      p_titulo: input.titulo.trim(),
      p_formato: input.formato,
      p_fecha_publicacion: input.fecha_publicacion,
      p_campana_id: input.campana_id || null,
      p_fecha_limite_brief: sla.fecha_limite_brief,
      p_hook_texto: input.formato === "STORY" ? null : input.hook_texto?.trim() || null,
      p_body_texto: input.formato === "STORY" ? null : input.body_texto?.trim() || null,
      p_cta_texto: input.formato === "STORY" ? null : input.cta_texto?.trim() || null,
      p_hashtags: input.formato === "STORY" ? null : normalizeHashtagArray(input.hashtags || []),
      p_drive_folder_id: driveFolder?.id || null,
      p_drive_folder_url: driveFolder?.url || null,
      p_social_account_ids: selectedAccountIds,
      p_categoria_ids: categoryIds,
    });
    if (error) {
      if (driveFolder?.id) {
        try { await deletePublicacionDriveFolder(driveFolder.id); } catch { /* El fallo de limpieza no cambia el error de Supabase. */ }
      }
      return { success: false, error: `Error en base de datos: ${error.message}` };
    }
    if (input.hora_publicacion) {
      const { data: hourSaved, error: hourError } = await supabase.rpc('set_publication_hour', {
        p_publicacion_id: (publicationJson as { id: string }).id,
        p_hora_publicacion: input.hora_publicacion,
      });
      if (hourError || hourSaved !== true) return { success: false, error: `La publicación se creó, pero no se pudo guardar la hora: ${hourError?.message || 'vuelve a editarla'}` };
    }
    const publicationId = (publicationJson as { id: string }).id;
    const { data: productionSaved, error: productionError } = await supabase.rpc('set_publication_production', {
      p_publicacion_id: publicationId,
      p_requiere_rodaje: input.requiere_rodaje || false,
      p_fecha_rodaje: fechaRodaje,
      p_sedes: sedes,
      p_prioridad: prioridad,
    });
    if (productionError || productionSaved !== true) return { success: false, error: `La publicación se creó, pero no se pudo guardar Producción: ${productionError?.message || 'intenta editarla nuevamente'}` };
    const newPost = { ...(publicationJson as unknown as PublicacionConCuentas), hora_publicacion: input.hora_publicacion || null, requiere_rodaje: input.requiere_rodaje || false, fecha_rodaje: fechaRodaje, sedes, prioridad };
    if (!newPost?.id) return { success: false, error: "Supabase no devolvió la publicación creada." };
    const categoryRows = categoryIds.length
      ? await supabase.from("categorias_contenido").select("id, nombre").in("id", categoryIds)
      : { data: [], error: null };

    // 3. Revalidar caché de Next.js si estamos en un contexto web activo
    try {
      revalidatePath("/social-media/grid");
      revalidatePath("/social-media/kanban");
    } catch {
      // Ignorar error de revalidación cuando se ejecuta desde un runner de test (Jest)
    }

    return { success: true, data: { ...newPost, linea_contenido: (categoryRows.data || []).map((category) => category.nombre).join(", ") || null, social_account_ids: selectedAccountIds } };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error inesperado al crear el post.",
    };
  }
}
