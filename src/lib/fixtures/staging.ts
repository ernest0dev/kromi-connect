export type StagingFixture = {
  title: string;
  detail: string;
  status: string;
};

export const STAGING_FIXTURES = [
  {
    title: "Lanzamiento de temporada",
    detail: "Calendario de contenido listo para revisión.",
    status: "Planificada",
  },
  {
    title: "Inventario de activación",
    detail: "Mobiliario disponible en Prebo.",
    status: "Disponible",
  },
  {
    title: "Solicitud de diseño",
    detail: "Pieza promocional en preparación.",
    status: "En diseño",
  },
] as const satisfies readonly StagingFixture[];
