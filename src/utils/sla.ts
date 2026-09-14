// src/lib/utils/sla.ts

export interface FechasSLAResult {
  fecha_limite_brief: string; // ISO Date String (YYYY-MM-DD)
  fecha_entrega_diseno_estimada: string | null; // ISO Date String (YYYY-MM-DD)
}

/**
 * Calcula la matriz SLA según la Regla 3+2:
 * - fecha_limite_brief = fecha_publicacion - 5 días
 * - fecha_entrega_diseno_estimada = fecha_solicitud_diseno + 2 días (si existe solicitud de diseño)
 *
 * @param fechaPublicacionStr Fecha de publicación en formato YYYY-MM-DD o ISO string
 * @param fechaSolicitudDisenoStr Timestamp opcional ISO de la solicitud a diseño
 */
export function calcularMatrizSLA(
  fechaPublicacionStr: string,
  fechaSolicitudDisenoStr?: string | null
): FechasSLAResult {
  const fechaPub = new Date(fechaPublicacionStr);

  // Regla 3+2: Descontar 5 días calendario desde la publicación para obtener la fecha límite del brief
  const fechaLimiteBriefDate = new Date(fechaPub);
  fechaLimiteBriefDate.setDate(fechaPub.getDate() - 5);
  const fecha_limite_brief = fechaLimiteBriefDate.toISOString().split('T')[0];

  // Si ya se solicitó diseño, calcular la estimación de entrega agregando 2 días
  let fecha_entrega_diseno_estimada: string | null = null;
  if (fechaSolicitudDisenoStr) {
    const fechaSolicitud = new Date(fechaSolicitudDisenoStr);
    const fechaEstimadaDate = new Date(fechaSolicitud);
    fechaEstimadaDate.setDate(fechaSolicitud.getDate() + 2);
    fecha_entrega_diseno_estimada = fechaEstimadaDate.toISOString().split('T')[0];
  }

  return {
    fecha_limite_brief,
    fecha_entrega_diseno_estimada,
  };
}