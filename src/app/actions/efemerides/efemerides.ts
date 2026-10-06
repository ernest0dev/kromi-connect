"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";

export interface Efemeride {
  id: string;
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion: string | null;
  created_at: string;
}

const EFEMERIDES_PATH = "/social-media/efemerides";

function validateInput(input: {
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
}) {
  const name = input.nombre.trim();
  if (!name) return "El nombre es obligatorio.";
  if (!Number.isInteger(input.anio) || input.anio < 1 || input.anio > 9999) {
    return "El año no es válido.";
  }
  if (!input.fecha_inicio || !input.fecha_fin || input.fecha_fin < input.fecha_inicio) {
    return "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
  }
  if (
    Number(input.fecha_inicio.slice(0, 4)) !== input.anio ||
    Number(input.fecha_fin.slice(0, 4)) !== input.anio
  ) {
    return "Las dos fechas deben pertenecer al año seleccionado.";
  }
  return null;
}

export async function getEfemeridesByYearAction(anio: number) {
  const access = await authorizeAction("social-media.efemerides.read");
  if (access.error) return { success: false, error: access.error, data: [] as Efemeride[] };
  if (!Number.isInteger(anio) || anio < 1 || anio > 9999) {
    return { success: false, error: "El año no es válido.", data: [] as Efemeride[] };
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("efemerides")
      .select("*")
      .eq("anio", anio)
      .order("fecha_inicio", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) return { success: false, error: error.message, data: [] as Efemeride[] };
    return { success: true, data: (data || []) as Efemeride[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudieron cargar las efemérides.",
      data: [] as Efemeride[],
    };
  }
}

export async function getEfemeridesInYearRangeAction(anioInicio: number, anioFin: number) {
  const access = await authorizeAction("social-media.efemerides.read");
  if (access.error) return { success: false, error: access.error, data: [] as Efemeride[] };
  if (
    !Number.isInteger(anioInicio) || !Number.isInteger(anioFin) ||
    anioInicio < 1 || anioFin > 9999 || anioFin < anioInicio
  ) {
    return { success: false, error: "El rango de años no es válido.", data: [] as Efemeride[] };
  }
  try {
    const { data, error } = await getSupabaseAdmin().from("efemerides")
      .select("*")
      .gte("anio", anioInicio)
      .lte("anio", anioFin)
      .order("anio", { ascending: true })
      .order("fecha_inicio", { ascending: true });
    if (error) return { success: false, error: error.message, data: [] as Efemeride[] };
    return { success: true, data: (data || []) as Efemeride[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudieron cargar las efemérides.",
      data: [] as Efemeride[],
    };
  }
}

export async function createEfemerideAction(input: {
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
}) {
  const access = await authorizeAction("social-media.efemerides.create");
  if (access.error) return { success: false, error: access.error };
  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  try {
    const { error } = await getSupabaseAdmin().from("efemerides").insert({
      nombre: input.nombre.trim(),
      anio: input.anio,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      descripcion: input.descripcion?.trim() || null,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath(EFEMERIDES_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear la efeméride." };
  }
}

export async function updateEfemerideAction(id: string, input: {
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
}) {
  const access = await authorizeAction("social-media.efemerides.update");
  if (access.error) return { success: false, error: access.error };
  if (!id) return { success: false, error: "Falta el identificador de la efeméride." };
  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  try {
    const { error } = await getSupabaseAdmin().from("efemerides").update({
      nombre: input.nombre.trim(),
      anio: input.anio,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      descripcion: input.descripcion?.trim() || null,
    }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath(EFEMERIDES_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar la efeméride." };
  }
}

export async function deleteEfemerideAction(id: string) {
  const access = await authorizeAction("social-media.efemerides.delete");
  if (access.error) return { success: false, error: access.error };
  if (!id) return { success: false, error: "Falta el identificador de la efeméride." };
  try {
    const supabase = getSupabaseAdmin();
    const { data: links, error: linkError } = await supabase.from("campana_efemerides")
      .select("campanas(nombre)")
      .eq("efemeride_id", id);
    if (!linkError && links?.length) {
      const names = links.map((link) => {
        const campaign = link.campanas as unknown as { nombre: string } | null;
        return campaign?.nombre;
      }).filter(Boolean);
      return {
        success: false,
        error: names.length
          ? `No se puede eliminar: está vinculada a ${names.join(", ")}. Desvincúlala de las campañas primero.`
          : "No se puede eliminar: la efeméride está vinculada a una o más campañas.",
      };
    }
    if (linkError) return { success: false, error: linkError.message };
    const { error } = await supabase.from("efemerides").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath(EFEMERIDES_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo eliminar la efeméride." };
  }
}
