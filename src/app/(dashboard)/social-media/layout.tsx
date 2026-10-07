import React from "react";
import { calcularSlaState } from "./grid/utils/sla";
import SocialMediaLayoutClient from "./SocialMediaLayoutClient";
import { requirePermission } from "@/lib/auth/dal";
import { getCampaignOptionsForGridAction } from "@/app/actions/campanas/campaigns";

export interface SlaSummary {
  vencidos: number;
  hoy: number;
}

export default async function SocialMediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase } = await requirePermission("social-media.grid.read");
  const { data, error } = await supabase
    .from("publicaciones")
    .select("fecha_limite_brief");

  if (error) {
    console.error("Error al obtener resumen de SLA:", error);
  }

  const slaSummary: SlaSummary | null = error
    ? null
    : (data ?? []).reduce<SlaSummary>(
        (summary, publicacion) => {
          const state = calcularSlaState(publicacion.fecha_limite_brief);
          if (state === "vencido") summary.vencidos += 1;
          if (state === "hoy") summary.hoy += 1;
          return summary;
        },
        { vencidos: 0, hoy: 0 }
      );

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
      slaSummary={slaSummary}
      contentCategories={(categoriesResult.data || []).map(({ id, nombre }) => ({ id, nombre }))}
      campaigns={campaignsResult.data}
      accounts={(accountsResult || []).map(({ id, platform, handle, display_name, active }) => ({ id, platform, handle, display_name, active }))}
    >
      {children}
    </SocialMediaLayoutClient>
  );
}
