import React from "react";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { Publicacion } from "@/types";
import GridClientView from "./GridClientView";

export const revalidate = 0;

export default async function ParrillaPage() {
  const supabase = getSupabaseAdmin();

  const { data: publicaciones, error } = await supabase
    .from("publicaciones")
    .select("*")
    .order("fecha_publicacion", { ascending: true });

  if (error) {
    console.error("Error al obtener publicaciones:", error);
  }

  // Obtener el mes actual dinámicamente en formato YYYY-MM
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            Grilla Macro de Contenidos
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Planificación mensual y reprogramación mediante Drag & Drop.
          </p>
        </div>
      </header>

      <GridClientView
        publicacionesIniciales={(publicaciones as Publicacion[]) || []}
        mesActual={mesActual}
      />
    </div>
  );
}
