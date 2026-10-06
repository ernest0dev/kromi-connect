import React from "react";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { calcularSlaState } from "./grid/utils/sla";
import SocialMediaLayoutClient from "./SocialMediaLayoutClient";
import { requirePermission } from "@/lib/auth/dal";

export interface SlaSummary {
  vencidos: number;
  hoy: number;
}

export default async function SocialMediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("social-media.grid.read");
  const supabase = getSupabaseAdmin();
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

  return (
    <SocialMediaLayoutClient slaSummary={slaSummary}>
      {children}
    </SocialMediaLayoutClient>
  );
}
