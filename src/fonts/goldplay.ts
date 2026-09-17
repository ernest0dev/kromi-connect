import localFont from "next/font/local";

/**
 * Goldplay — fuente de display del Manual Corporativo Kromi Market.
 * Cargada localmente desde public/fonts/goldplay/ mediante next/font/local.
 * Pesos disponibles segun los archivos entregados:
 * Light (300), Regular (400), Semibold (500), Bold (700), Black (800).
 */
export const goldplay = localFont({
  src: [
    {
      path: "../../public/fonts/goldplay/goldplay-light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/goldplay/goldplay-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/goldplay/goldplay-semibold.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/goldplay/goldplay-bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/goldplay/goldplay-black.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-goldplay",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});