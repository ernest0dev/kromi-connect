import React from "react";
import { computeIndicators } from "./grid/utils/quickViews";
import type { GridIndicators } from "./grid/utils/quickViews";
import { todayInCaracas } from "./grid/utils/today";
import SocialMediaLayoutClient from "./SocialMediaLayoutClient";
import { requirePermission } from "@/lib/auth/dal";
import { getCampaignOptionsForGridAction } from "@/app/actions/campanas/campaigns";

export default async function SocialMediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase } = await requirePermission("social-media.grid.read");
  // Solo piezas vivas: publicadas y canceladas no generan indicadores.
  const { data, error } = await supabase
    .from("publicaciones")
    .select("estatus, requiere_diseno, fecha_limite_brief, fecha_publicacion, formato, hook_texto, body_texto, cta_texto")
    .is("deleted_at", null)
    .not("estatus", "in", "(PUBLICADO,CANCELADO)");

  if (error) {
    console.error("Error al obtener indicadores del calendario:", error);
  }

  const indicators: GridIndicators | null = error
    ? null
    : computeIndicators(data ?? [], todayInCaracas());

  const [categoriesResult, campaignsResult] = await Promise.all([
    supabase.from("categorias_contenido").select("id, nombre").order("nombre"),
    getCampaignOptionsForGridAction(),
  ]);
  const { data: accountsResult } = await supabase
    .from("social_accounts")
    .select("id, platform, handle, display_name, active")
    .order("display_name");

  return (
    <SocialMediaLayoutClient
      indicators={indicators}
      contentCategories={(categoriesResult.data || []).map(({ id, nombre }) => ({ id, nombre }))}
      campaigns={campaignsResult.data}
      accounts={(accountsResult || []).map(({ id, platform, handle, display_name, active }) => ({ id, platform, handle, display_name, active }))}
    >
      {children}
    </SocialMediaLayoutClient>
  );
}
