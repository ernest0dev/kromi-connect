"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";
import { createPublicacionDriveFolder } from "@/lib/googleDrive";
import { FormatoEnum, EstatusEnum } from "@/types";
import { calcularMatrizSLA } from "@/utils/sla";

const FORMATOS_VALIDOS: FormatoEnum[] = ["CARRUSEL", "POST", "REEL", "STORY"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// src/app/actions/publicaciones/create.ts

export interface CreatePostInput {
  titulo: string;
  formato: FormatoEnum;
  fecha_publicacion: string;
  campana_id?: string | null;
  categoria_ids?: string[];
  hook_texto?: string;
  body_texto?: string;
  cta_texto?: string;
  hashtags?: string[];
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
  if (input.hashtags !== undefined && (!Array.isArray(input.hashtags) || input.hashtags.some((tag) => typeof tag !== "string"))) {
    return { success: false, error: "La lista de hashtags no es válida." };
  }
  if (input.formato === "STORY" && [input.hook_texto, input.body_texto, input.cta_texto, ...(input.hashtags || [])].some(Boolean)) {
    return { success: false, error: "Las Stories no admiten campos de copy." };
  }
  const categoryIds = input.categoria_ids ?? [];
  if (!Array.isArray(categoryIds) || categoryIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return { success: false, error: "La selección de temas no es válida." };
  }
  try {
    const supabase = getSupabaseAdmin();

    // 1. Crear carpeta dedicada en Google Drive
    const folderName = `[${input.formato}] ${input.fecha_publicacion} - ${input.titulo}`;
    const driveFolder = await createPublicacionDriveFolder(folderName);

    // 2. Insertar publicación en Supabase con la URL devuelta
    const sla = calcularMatrizSLA(input.fecha_publicacion);
    const { data: newPost, error } = await supabase
      .from("publicaciones")
      .insert({
        titulo: input.titulo,
        formato: input.formato,
        fecha_publicacion: input.fecha_publicacion,
        campana_id: input.campana_id || null,
        fecha_limite_brief: sla.fecha_limite_brief,
        hook_texto: input.formato === "STORY" ? null : input.hook_texto || null,
        body_texto: input.formato === "STORY" ? null : input.body_texto || null,
        cta_texto: input.formato === "STORY" ? null : input.cta_texto || null,
        hashtags: input.formato === "STORY" ? null : input.hashtags || null,
        estatus: "PENDIENTE_BRIEF" as EstatusEnum,
        creador_id: access.context.user.id,
        drive_folder_id: driveFolder?.id || null,
        drive_folder_url: driveFolder?.url || null,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Error en base de datos: ${error.message}`,
      };
    }

    const { error: categoriesError } = await supabase.rpc("replace_publicacion_categorias", {
      p_publicacion_id: newPost.id,
      p_categoria_ids: categoryIds,
    });
    if (categoriesError) {
      await supabase.from("publicaciones").delete().eq("id", newPost.id);
      return { success: false, error: `No se pudieron guardar los temas: ${categoriesError.message}` };
    }
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

    return { success: true, data: { ...newPost, linea_contenido: (categoryRows.data || []).map((category) => category.nombre).join(", ") || null } };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error inesperado al crear el post.",
    };
  }
}
