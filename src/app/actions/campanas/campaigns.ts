"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { TipoCampanaEnum } from "@/types/enums";

export type CampanaEstatus = "PLANIFICADA" | "ACTIVA" | "FINALIZADA" | "ARCHIVADA";
export type CampanaEstatusOperativo = Exclude<CampanaEstatus, "ARCHIVADA">;

export interface Campana {
  id: string;
  nombre: string;
  descripcion?: string | null;
  tipo_campana: TipoCampanaEnum;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number | null;
  estatus: CampanaEstatus;
  estatus_pre_archivado?: CampanaEstatusOperativo | null;
  activo?: boolean;
  created_at?: string;
  publicaciones?: PublicacionCampana[];
  evaluacion?: CampanaEvaluacion | null;
}

export interface PublicacionCampana {
  id: string;
  titulo: string;
  formato: string;
  fecha_publicacion: string;
  estatus: string;
  drive_folder_url?: string | null;
}

export interface CampanaEvaluacion {
  id: string;
  campana_id: string;
  alcance_total: number | null;
  interacciones_totales: number | null;
  presupuesto_ejecutado: number | null;
  informe_cualitativo: string | null;
  observaciones: string | null;
  created_at: string;
}

const TIPOS_CAMPANA: TipoCampanaEnum[] = [
  "TEMPORADA", "EVENTO", "EFEMERIDE", "LANZAMIENTO", "OFERTA_PUNTUAL",
];
const ESTADOS_CAMPANA: CampanaEstatus[] = ["PLANIFICADA", "ACTIVA", "FINALIZADA"];
const CAMPAIGNS_PATH = "/social-media/campaigns";

export async function getCampaignsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: campaigns, error } = await supabase
      .from("campanas")
      .select("*")
      .order("fecha_inicio", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] as Campana[] };
    const ids = (campaigns || []).map((campaign) => campaign.id);
    if (!ids.length) return { success: true, data: [] as Campana[] };

    const [postsResult, evaluationsResult] = await Promise.all([
      supabase.from("publicaciones")
        .select("id, campana_id, titulo, formato, fecha_publicacion, estatus, drive_folder_url")
        .in("campana_id", ids)
        .order("fecha_publicacion", { ascending: true }),
      supabase.from("campana_evaluaciones").select("*").in("campana_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    if (postsResult.error) return { success: false, error: postsResult.error.message, data: [] as Campana[] };
    if (evaluationsResult.error) return { success: false, error: evaluationsResult.error.message, data: [] as Campana[] };

    const postsByCampaign = new Map<string, PublicacionCampana[]>();
    for (const post of postsResult.data || []) {
      const key = post.campana_id as string;
      postsByCampaign.set(key, [...(postsByCampaign.get(key) || []), post as PublicacionCampana]);
    }
    const evaluationByCampaign = new Map<string, CampanaEvaluacion>();
    for (const evaluation of evaluationsResult.data || []) {
      if (!evaluationByCampaign.has(evaluation.campana_id)) {
        evaluationByCampaign.set(evaluation.campana_id, evaluation as CampanaEvaluacion);
      }
    }

    return {
      success: true,
      data: (campaigns || []).map((campaign) => ({
        ...campaign,
        tipo_campana: campaign.tipo_campana || "TEMPORADA",
        estatus: campaign.estatus || (campaign.activo === false ? "FINALIZADA" : "PLANIFICADA"),
        publicaciones: postsByCampaign.get(campaign.id) || [],
        evaluacion: evaluationByCampaign.get(campaign.id) || null,
      })) as Campana[],
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron cargar las campañas.", data: [] as Campana[] };
  }
}

export async function createCampaignAction(input: {
  nombre: string;
  descripcion?: string;
  tipo_campana: TipoCampanaEnum;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
}) {
  if (!input.nombre.trim()) return { success: false, error: "El nombre es obligatorio." };
  if (!TIPOS_CAMPANA.includes(input.tipo_campana)) return { success: false, error: "La categoría no es válida." };
  if (!input.fecha_inicio || !input.fecha_fin || input.fecha_fin < input.fecha_inicio) {
    return { success: false, error: "Revisa las fechas de inicio y fin." };
  }
  if (input.presupuesto !== undefined && (!Number.isFinite(input.presupuesto) || input.presupuesto < 0)) {
    return { success: false, error: "El presupuesto debe ser un número igual o mayor que cero." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("campanas").insert([{
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      tipo_campana: input.tipo_campana,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      presupuesto: input.presupuesto ?? null,
      estatus: "PLANIFICADA",
      activo: true,
    }]);
    if (error) return { success: false, error: error.message };
    revalidatePath(CAMPAIGNS_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear la campaña." };
  }
}

export async function updateCampaignAction(id: string, input: {
  nombre: string;
  descripcion?: string;
  tipo_campana: TipoCampanaEnum;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
}) {
  if (!id) return { success: false, error: "Falta el identificador de la campaña." };
  if (!input.nombre.trim()) return { success: false, error: "El nombre es obligatorio." };
  if (!TIPOS_CAMPANA.includes(input.tipo_campana)) return { success: false, error: "La categoría no es válida." };
  if (!input.fecha_inicio || !input.fecha_fin || input.fecha_fin < input.fecha_inicio) {
    return { success: false, error: "Revisa las fechas de inicio y fin." };
  }
  if (input.presupuesto !== undefined && (!Number.isFinite(input.presupuesto) || input.presupuesto < 0)) {
    return { success: false, error: "El presupuesto debe ser un número igual o mayor que cero." };
  }

  try {
    const { error } = await getSupabaseAdmin().from("campanas").update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      tipo_campana: input.tipo_campana,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      presupuesto: input.presupuesto ?? null,
    }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath(CAMPAIGNS_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo editar la campaña." };
  }
}

export async function updateCampaignStatusAction(id: string, status: CampanaEstatus) {
  if (!id || !ESTADOS_CAMPANA.includes(status)) return { success: false, error: "El estado indicado no es válido." };
  try {
    const { error } = await getSupabaseAdmin().from("campanas")
      .update({ estatus: status, activo: status !== "FINALIZADA" }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath(CAMPAIGNS_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el estado." };
  }
}

export async function archiveCampaignAction(id: string) {
  if (!id) return { success: false, error: "Falta el identificador de la campaña." };
  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign, error: readError } = await supabase.from("campanas")
      .select("estatus")
      .eq("id", id)
      .single();
    if (readError) return { success: false, error: readError.message };
    if (campaign.estatus === "ARCHIVADA") return { success: true };

    const { error } = await supabase.from("campanas").update({
      estatus_pre_archivado: campaign.estatus,
      estatus: "ARCHIVADA",
      activo: false,
    }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath(CAMPAIGNS_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo archivar la campaña." };
  }
}

export async function restoreCampaignAction(id: string) {
  if (!id) return { success: false, error: "Falta el identificador de la campaña." };
  try {
    const supabase = getSupabaseAdmin();
    const { data: campaign, error: readError } = await supabase.from("campanas")
      .select("estatus, estatus_pre_archivado")
      .eq("id", id)
      .single();
    if (readError) return { success: false, error: readError.message };
    if (campaign.estatus !== "ARCHIVADA") return { success: true };

    const status: CampanaEstatusOperativo = ESTADOS_CAMPANA.includes(campaign.estatus_pre_archivado)
      ? campaign.estatus_pre_archivado
      : "PLANIFICADA";
    const { error } = await supabase.from("campanas").update({
      estatus: status,
      estatus_pre_archivado: null,
      activo: status !== "FINALIZADA",
    }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath(CAMPAIGNS_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo restaurar la campaña." };
  }
}

export async function saveCampaignEvaluationAction(input: {
  campana_id: string;
  alcance_total?: number | null;
  interacciones_totales?: number | null;
  presupuesto_ejecutado?: number | null;
  informe_cualitativo?: string;
  observaciones?: string;
}) {
  if (!input.campana_id) return { success: false, error: "Falta la campaña del informe." };
  const metrics = [input.alcance_total, input.interacciones_totales, input.presupuesto_ejecutado];
  if (metrics.some((value) => value != null && (!Number.isFinite(value) || value < 0))) {
    return { success: false, error: "Las métricas deben ser números iguales o mayores que cero." };
  }
  if ([input.alcance_total, input.interacciones_totales].some((value) => value != null && !Number.isInteger(value))) {
    return { success: false, error: "Alcance e interacciones deben ser números enteros." };
  }
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("campana_evaluaciones").insert({
      campana_id: input.campana_id,
      alcance_total: input.alcance_total ?? null,
      interacciones_totales: input.interacciones_totales ?? null,
      presupuesto_ejecutado: input.presupuesto_ejecutado ?? null,
      informe_cualitativo: input.informe_cualitativo?.trim() || null,
      observaciones: input.observaciones?.trim() || null,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath(CAMPAIGNS_PATH);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar el informe." };
  }
}
