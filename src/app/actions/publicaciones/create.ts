"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { createPublicacionDriveFolder } from "@/lib/googleDrive";
import { FormatoEnum, EstatusEnum } from "@/types";

// src/app/actions/publicaciones/create.ts

export interface CreatePostInput {
  titulo: string;
  formato: FormatoEnum;
  fecha_publicacion: string;
  campana_id?: string;
  linea_contenido?: string;
  hook_texto?: string;
  body_texto?: string;
  cta_texto?: string;
  hashtags?: string[];
}

export async function createPostWithDriveAction(input: CreatePostInput) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Crear carpeta dedicada en Google Drive
    const folderName = `[${input.formato}] ${input.fecha_publicacion} - ${input.titulo}`;
    const driveFolderUrl = await createPublicacionDriveFolder(folderName);

    // 2. Insertar publicación en Supabase con la URL devuelta
    const { data: newPost, error } = await supabase
      .from("publicaciones")
      .insert({
        titulo: input.titulo,
        formato: input.formato,
        fecha_publicacion: input.fecha_publicacion,
        campana_id: input.campana_id || null,
        linea_contenido: input.linea_contenido || null,
        hook_texto: input.hook_texto || null,
        body_texto: input.body_texto || null,
        cta_texto: input.cta_texto || null,
        hashtags: input.hashtags || null,
        estatus: "PENDIENTE_BRIEF" as EstatusEnum,
        drive_folder_url: driveFolderUrl,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Error en base de datos: ${error.message}`,
      };
    }

    // 3. Revalidar caché de Next.js si estamos en un contexto web activo
    try {
      revalidatePath("/social-media/grid");
      revalidatePath("/social-media/kanban");
    } catch {
      // Ignorar error de revalidación cuando se ejecuta desde un runner de test (Jest)
    }

    return { success: true, data: newPost };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error inesperado al crear el post.",
    };
  }
}
