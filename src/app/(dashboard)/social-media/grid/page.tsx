import React from "react";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { Publicacion } from "@/types";
import GridClientView from "./GridClientView";

export const revalidate = 0;

export default async function ParrillaPage() {
  // getSupabaseAdmin es sincrónico; se obtiene directamente sin await
  const supabase = getSupabaseAdmin();

  const { data: publicaciones, error } = await supabase
    .from("publicaciones")
    .select("*")
    .order("fecha_publicacion", { ascending: true });

  if (error) {
    console.error("Error al obtener publicaciones:", error);
  }

  return (
    <div className="space-y-7">
      <header
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--borde)" }}
      >
        <div>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--tinta)" }}
          >
            Parrilla macro de contenidos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gris)" }}>
            Planificación mensual y reprogramación mediante arrastrar y soltar.
          </p>
        </div>
      </header>

      <GridClientView
        publicacionesIniciales={(publicaciones as Publicacion[]) || []}
      />
    </div>
  );
}
