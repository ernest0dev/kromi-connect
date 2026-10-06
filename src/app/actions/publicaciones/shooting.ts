"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";
import { Publicacion } from "@/types";

export interface ObtenerPautasInput {
  sede?: string;
  estatus?: string[];
}

export async function getShootingPostsAction(input?: ObtenerPautasInput) {
  const access = await authorizeAction("social-media.shooting.read");
  if (access.error) return { success: false, error: access.error, data: [] as Publicacion[] };
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

    const posts = data || [];
    const postIds = posts.map((post) => post.id);
    const categoryLinks = postIds.length
      ? await supabase.from('publicacion_categorias').select('publicacion_id, categoria_id').in('publicacion_id', postIds)
      : { data: [], error: null };
    if (categoryLinks.error) return { success: false, error: categoryLinks.error.message, data: [] as Publicacion[] };
    const categoryIds = [...new Set((categoryLinks.data || []).map((link) => link.categoria_id))];
    const categoryRows = categoryIds.length
      ? await supabase.from('categorias_contenido').select('id, nombre').in('id', categoryIds)
      : { data: [], error: null };
    if (categoryRows.error) return { success: false, error: categoryRows.error.message, data: [] as Publicacion[] };
    const namesByCategoryId = new Map((categoryRows.data || []).map((category) => [category.id, category.nombre]));
    const namesByPostId = new Map<string, string[]>();
    for (const link of categoryLinks.data || []) {
      const name = namesByCategoryId.get(link.categoria_id);
      if (name) namesByPostId.set(link.publicacion_id, [...(namesByPostId.get(link.publicacion_id) || []), name]);
    }

    return {
      success: true,
      data: posts.map((post) => ({
        ...post,
        linea_contenido: namesByPostId.get(post.id)?.join(', ') || post.linea_contenido,
      })) as Publicacion[],
    };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function updateShootingStatusAction(
  publicacionId: string,
  nuevoEstatus: "EN_DISENO" | "EN_RODAJE",
) {
  const access = await authorizeAction("social-media.shooting.status.update");
  if (access.error) return { success: false, error: access.error };
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
