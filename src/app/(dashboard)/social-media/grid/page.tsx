import React from "react";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { Publicacion } from "@/types";
import { getEfemeridesByYearAction } from "@/app/actions/efemerides/efemerides";
import { getCampaignsForGridMonthAction, getCampaignOptionsForGridAction } from "@/app/actions/campanas/campaigns";
import GridView from "./GridView";
import { requirePermission } from "@/lib/auth/dal";

// Esta vista necesita datos frescos en cada solicitud, sin caché de página.
export const revalidate = 0;

// Componente de servidor: carga las publicaciones antes de renderizar la parrilla.
export default async function ParrillaPage() {
  await requirePermission("social-media.grid.read");
  // getSupabaseAdmin es sincrónico; se obtiene directamente sin await
  // Obtiene el cliente de Supabase para consultar la tabla de publicaciones.
  const supabase = getSupabaseAdmin();

  // Recupera las publicaciones y las ordena por fecha ascendente.
  const { data: publicaciones, error } = await supabase
    .from("publicaciones")
    .select("*")
    .order("fecha_publicacion", { ascending: true });

  // Registra el fallo en servidor; la vista continúa con una lista vacía.
  if (error) {
    console.error("Error al obtener publicaciones:", JSON.stringify({
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    }));
  }

  // Asegura que GridView reciba un arreglo aunque la consulta no devuelva datos.
  const lista = (publicaciones as Publicacion[]) || [];
  const anioActual = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const efemeridesResult = await getEfemeridesByYearAction(anioActual);
  const campaignsResult = await getCampaignsForGridMonthAction(anioActual, mesActual);
  const campaignOptionsResult = await getCampaignOptionsForGridAction();
  return (
    <div className="space-y-5">
      {/* Encabezado: contexto, título, ayuda y total de publicaciones. */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <span
            className="ui-eyebrow block mb-1.75"
            style={{color: "var(--azul)" }}
          >
            Planificación · Social media
          </span>
          <h1
            className="mb-1.5 text-[21px] font-bold leading-[1.15] md:text-[25px]"
            style={{fontFamily: "var(--font-display)", color: "var(--tinta)" }}
          >
            Parrilla macro de contenidos
          </h1>
          <p className="text-[13px] ui-text-muted">
            Planifica publicaciones y reprograma entregables desde el
            calendario.
          </p>
        </div>

        {/* El contador resume el total y aparece en pantallas amplias. */}
        <div className="hidden min-[1100px]:flex items-end gap-2">
          <div
            className="ui-card flex min-w-23.5 flex-col items-start gap-0.5 rounded-[10px] px-3 py-2.25"
          >
            <b className="text-sm font-bold" style={{color: "var(--tinta)" }}>
              {lista.length}
            </b>
            <span className="text-[10px]" style={{color: "var(--gris)" }}>
              Publicaciones
            </span>
          </div>
        </div>
      </header>

      {/* La capa interactiva de la parrilla recibe los datos iniciales. */}
      <GridView
        publicacionesIniciales={lista}
        errorPublicacionesIniciales={error?.message || null}
        campanasPublicacionesIniciales={campaignOptionsResult.data}
        efemeridesIniciales={efemeridesResult.data}
        anioEfemeridesInicial={anioActual}
        errorEfemeridesInicial={efemeridesResult.success ? null : efemeridesResult.error || "No se pudieron cargar las efemérides."}
        campanasIniciales={campaignsResult.data}
        periodoCampanasInicial={{ anio: anioActual, mes: mesActual }}
        errorCampanasInicial={campaignsResult.success ? null : campaignsResult.error || "No se pudieron cargar las campañas."}
      />
    </div>
  );
}
