import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kromi: {
          azul: "#0066D2",
          "azul-osc": "#002F80",
          naranja: "#F28D19",
          amarillo: "#F1C33E",
          celeste: "#0FBDFF",
          morado: "#8000A8",
          verde: "#00AF65",
          lima: "#C2D354",
          tinta: "#10233F",
          hueso: "#FAF8F4",
          papel: "#FFFFFF",
          gris: "#6B7482",
          borde: "#E7E4DC",
        },
      },
      fontFamily: {
        // Goldplay (Manual Corporativo) cargada localmente vía next/font/local
        display: ["var(--font-goldplay)", "system-ui", "sans-serif"],
        // Inter cargado vía next/font/google
        text: ["var(--font-text)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "32px": "32px",
        "30px": "30px",
      },
    },
  },
  plugins: [],
};

export default config;