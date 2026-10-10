import React from "react";
import { PublicacionConCuentas } from "@/types";
import { getEfemeridesByYearAction } from "@/app/actions/efemerides/efemerides";
import { getCampaignsForGridMonthAction, getCampaignOptionsForGridAction } from "@/app/actions/campanas/campaigns";
import GridView from "./GridView";
import { requirePermission } from "@/lib/auth/dal";
import type { ContentCategoryOption } from "./components/ContentCategorySelector";

// Esta vista necesita datos frescos en cada solicitud, sin caché de página.
export const revalidate = 0;

// Componente de servidor: carga las publicaciones antes de renderizar el calendario de contenido.
export default async function CalendarioPage() {
  const { supabase } = await requirePermission("social-media.grid.read");
  // Recupera las publicaciones y las ordena por fecha ascendente.
  const { data: publicaciones, error } = await supabase
    .from("publicaciones")
    .select("*")
    .is("deleted_at", null)
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
  const [accountsResult, destinationsResult, categoriesResult, publicationCategoriesResult] = await Promise.all([
    supabase.from("social_accounts").select("id, platform, handle, display_name, active").order("display_name"),
    supabase.from("publicacion_canales").select("publicacion_id, social_account_id"),
    supabase.from("categorias_contenido").select("id, nombre").order("nombre"),
    supabase.from("publicacion_categorias").select("publicacion_id, categoria_id"),
  ]);
  const accounts = accountsResult.data || [];
  const accountIdsByPublication = new Map<string, string[]>();
  for (const destination of destinationsResult.data || []) {
    if (!destination.social_account_id) continue;
    accountIdsByPublication.set(destination.publicacion_id, [...(accountIdsByPublication.get(destination.publicacion_id) || []), destination.social_account_id]);
  }
  const lista: PublicacionConCuentas[] = (publicaciones || []).map((publication) => ({
    ...publication,
    social_account_ids: accountIdsByPublication.get(publication.id) || [],
  }));
  const categoryNames = new Map((categoriesResult.data || []).map((category) => [category.id, category.nombre]));
  const namesByPublication = new Map<string, string[]>();
  for (const link of publicationCategoriesResult.data || []) {
    const name = categoryNames.get(link.categoria_id);
    if (name) namesByPublication.set(link.publicacion_id, [...(namesByPublication.get(link.publicacion_id) || []), name]);
  }
  const publicacionesConTemas = lista.map((publication) => ({
    ...publication,
    linea_contenido: namesByPublication.get(publication.id)?.join(", ") || publication.linea_contenido,
  }));
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
            Calendario de contenido
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

      {/* La capa interactiva del calendario recibe los datos iniciales. */}
      <GridView
        publicacionesIniciales={publicacionesConTemas}
        errorPublicacionesIniciales={error?.message || null}
        campanasPublicacionesIniciales={campaignOptionsResult.data}
        categoriasContenidoIniciales={(categoriesResult.data || []) as ContentCategoryOption[]}
        cuentasSocialesIniciales={accounts.map(({ id, platform, handle, display_name, active }) => ({ id, platform, handle, display_name, active }))}
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
