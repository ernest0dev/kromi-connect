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
  efemerides?: EfemerideCampana[];
  evaluacion?: CampanaEvaluacion | null;
}

export interface EfemerideCampana {
  id: string;
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface CampanaGrid {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_campana: TipoCampanaEnum;
  estatus: CampanaEstatus;
  fecha_inicio: string;
  fecha_fin: string;
  efemerides: EfemerideCampana[];
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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateEfemerideSelection(tipo: TipoCampanaEnum, ids?: string[]) {
  const selectedIds = ids ?? [];
  if (!Array.isArray(selectedIds) || selectedIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return "La selección de efemérides no es válida.";
  }
  if (new Set(selectedIds).size !== selectedIds.length) return "Hay efemérides repetidas en la selección.";
  if (tipo !== "EFEMERIDE" && selectedIds.length > 0) {
    return "Solo las campañas de tipo Efeméride pueden vincular efemérides.";
  }
  return null;
}

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

    const [postsResult, evaluationsResult, linksResult] = await Promise.all([
      supabase.from("publicaciones")
        .select("id, campana_id, titulo, formato, fecha_publicacion, estatus, drive_folder_url")
        .in("campana_id", ids)
        .order("fecha_publicacion", { ascending: true }),
      supabase.from("campana_evaluaciones").select("*").in("campana_id", ids)
        .order("created_at", { ascending: false }),
      supabase.from("campana_efemerides").select("campana_id, efemeride_id").in("campana_id", ids),
    ]);

    if (postsResult.error) return { success: false, error: postsResult.error.message, data: [] as Campana[] };
    if (evaluationsResult.error) return { success: false, error: evaluationsResult.error.message, data: [] as Campana[] };
    if (linksResult.error) return { success: false, error: linksResult.error.message, data: [] as Campana[] };

    const efemerideIds = [...new Set((linksResult.data || []).map((link) => link.efemeride_id))];
    const efemeridesResult = efemerideIds.length
      ? await supabase.from("efemerides").select("id, nombre, anio, fecha_inicio, fecha_fin").in("id", efemerideIds)
      : { data: [], error: null };
    if (efemeridesResult.error) return { success: false, error: efemeridesResult.error.message, data: [] as Campana[] };

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
    const efemeridesById = new Map((efemeridesResult.data || []).map((efemeride) => [efemeride.id, efemeride as EfemerideCampana]));
    const efemeridesByCampaign = new Map<string, EfemerideCampana[]>();
    for (const link of linksResult.data || []) {
      const efemeride = efemeridesById.get(link.efemeride_id);
      if (efemeride) efemeridesByCampaign.set(link.campana_id, [...(efemeridesByCampaign.get(link.campana_id) || []), efemeride]);
    }

    return {
      success: true,
      data: (campaigns || []).map((campaign) => ({
        ...campaign,
        tipo_campana: campaign.tipo_campana || "TEMPORADA",
        estatus: campaign.estatus || (campaign.activo === false ? "FINALIZADA" : "PLANIFICADA"),
        publicaciones: postsByCampaign.get(campaign.id) || [],
        efemerides: efemeridesByCampaign.get(campaign.id) || [],
        evaluacion: evaluationByCampaign.get(campaign.id) || null,
      })) as Campana[],
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron cargar las campañas.", data: [] as Campana[] };
  }
}

export async function getCampaignsForGridMonthAction(anio: number, mes: number) {
  if (!Number.isInteger(anio) || anio < 1 || anio > 9999 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { success: false, error: "El mes solicitado no es válido.", data: [] as CampanaGrid[] };
  }
  const mesTexto = String(mes).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const fechaInicioMes = `${String(anio).padStart(4, "0")}-${mesTexto}-01`;
  const fechaFinMes = `${String(anio).padStart(4, "0")}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`;

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaigns, error } = await supabase.from("campanas")
      .select("id, nombre, descripcion, tipo_campana, fecha_inicio, fecha_fin, estatus, activo")
      .eq("tipo_campana", "EFEMERIDE")
      .lte("fecha_inicio", fechaFinMes)
      .gte("fecha_fin", fechaInicioMes)
      .neq("estatus", "ARCHIVADA")
      .order("fecha_inicio", { ascending: true });
    if (error) return { success: false, error: error.message, data: [] as CampanaGrid[] };
    if (!campaigns?.length) return { success: true, data: [] as CampanaGrid[] };

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const { data: links, error: linksError } = await supabase.from("campana_efemerides")
      .select("campana_id, efemeride_id")
      .in("campana_id", campaignIds);
    if (linksError) return { success: false, error: linksError.message, data: [] as CampanaGrid[] };
    if (!links?.length) return { success: true, data: [] as CampanaGrid[] };

    const efemerideIds = [...new Set(links.map((link) => link.efemeride_id))];
    const { data: efemerides, error: efemeridesError } = await supabase.from("efemerides")
      .select("id, nombre, anio, fecha_inicio, fecha_fin")
      .in("id", efemerideIds);
    if (efemeridesError) return { success: false, error: efemeridesError.message, data: [] as CampanaGrid[] };

    const efemeridesById = new Map((efemerides || []).map((efemeride) => [efemeride.id, efemeride as EfemerideCampana]));
    const efemeridesByCampaign = new Map<string, EfemerideCampana[]>();
    for (const link of links) {
      const efemeride = efemeridesById.get(link.efemeride_id);
      if (efemeride) efemeridesByCampaign.set(link.campana_id, [...(efemeridesByCampaign.get(link.campana_id) || []), efemeride]);
    }

    return {
      success: true,
      data: campaigns.flatMap((campaign) => {
        const linkedEfemerides = efemeridesByCampaign.get(campaign.id) || [];
        if (!linkedEfemerides.length || campaign.tipo_campana !== "EFEMERIDE") return [];
        return [{
          id: campaign.id,
          nombre: campaign.nombre,
          descripcion: campaign.descripcion,
          tipo_campana: campaign.tipo_campana,
          estatus: campaign.estatus || (campaign.activo === false ? "FINALIZADA" : "PLANIFICADA"),
          fecha_inicio: campaign.fecha_inicio,
          fecha_fin: campaign.fecha_fin,
          efemerides: linkedEfemerides,
        } as CampanaGrid];
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudieron cargar las campañas para Grid.",
      data: [] as CampanaGrid[],
    };
  }
}

export async function createCampaignAction(input: {
  nombre: string;
  descripcion?: string;
  tipo_campana: TipoCampanaEnum;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto?: number;
  efemeride_ids?: string[];
}) {
  if (!input.nombre.trim()) return { success: false, error: "El nombre es obligatorio." };
  if (!TIPOS_CAMPANA.includes(input.tipo_campana)) return { success: false, error: "La categoría no es válida." };
  if (!input.fecha_inicio || !input.fecha_fin || input.fecha_fin < input.fecha_inicio) {
    return { success: false, error: "Revisa las fechas de inicio y fin." };
  }
  if (input.presupuesto !== undefined && (!Number.isFinite(input.presupuesto) || input.presupuesto < 0)) {
    return { success: false, error: "El presupuesto debe ser un número igual o mayor que cero." };
  }
  const efemeridesError = validateEfemerideSelection(input.tipo_campana, input.efemeride_ids);
  if (efemeridesError) return { success: false, error: efemeridesError };

  try {
    const { error } = await getSupabaseAdmin().rpc("save_campaign_with_efemerides", {
      p_campana_id: null,
      p_nombre: input.nombre.trim(),
      p_descripcion: input.descripcion?.trim() || null,
      p_tipo_campana: input.tipo_campana,
      p_fecha_inicio: input.fecha_inicio,
      p_fecha_fin: input.fecha_fin,
      p_presupuesto: input.presupuesto ?? null,
      p_efemeride_ids: input.efemeride_ids || [],
      p_confirmar_desvinculacion: false,
    });
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
  efemeride_ids?: string[];
  confirmar_desvinculacion?: boolean;
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
  const efemeridesError = validateEfemerideSelection(input.tipo_campana, input.efemeride_ids);
  if (efemeridesError) return { success: false, error: efemeridesError };

  try {
    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase.from("campanas")
      .select("tipo_campana")
      .eq("id", id)
      .single();
    if (readError) return { success: false, error: readError.message };
    if (current.tipo_campana === "EFEMERIDE" && input.tipo_campana !== "EFEMERIDE") {
      const { count, error: countError } = await supabase.from("campana_efemerides")
        .select("efemeride_id", { count: "exact", head: true })
        .eq("campana_id", id);
      if (countError) return { success: false, error: countError.message };
      if ((count || 0) > 0 && !input.confirmar_desvinculacion) {
        return { success: false, error: "Confirma que deseas cambiar la categoría y desvincular sus efemérides." };
      }
    }
    const { error } = await supabase.rpc("save_campaign_with_efemerides", {
      p_campana_id: id,
      p_nombre: input.nombre.trim(),
      p_descripcion: input.descripcion?.trim() || null,
      p_tipo_campana: input.tipo_campana,
      p_fecha_inicio: input.fecha_inicio,
      p_fecha_fin: input.fecha_fin,
      p_presupuesto: input.presupuesto ?? null,
      p_efemeride_ids: input.efemeride_ids || [],
      p_confirmar_desvinculacion: input.confirmar_desvinculacion || false,
    });
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
