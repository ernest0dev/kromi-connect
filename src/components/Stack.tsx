"use client";

const stack = [
  { name: "Next.js App Router", color: "#0066D2" },
  { name: "Supabase / PostgreSQL", color: "#00AF65" },
  { name: "Server Actions", color: "#F28D19" },
  { name: "Row Level Security", color: "#8000A8" },
  { name: "Google Drive API v3", color: "#0FBDFF" },
  { name: "Jest + Playwright", color: "#F1C33E" },
  { name: "Vercel CI/CD", color: "#002F80" },
];

export function Stack() {
  return (
    <section
      className="bg-kromi-papel border-t border-kromi-borde py-24"
      id="stack"
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-bold text-kromi-naranja mb-3">
            Debajo del capó
          </p>
          <h2 className="font-display font-bold text-4xl text-kromi-azul-osc mb-3.5">
            Arquitectura pensada para escalar sin refactor
          </h2>
          <p className="text-base text-kromi-gris">
            La Fase 1 opera con un solo perfil (Estrategia + Producción), pero
            el modelo de datos y las políticas de acceso ya están preparados
            para sumar los paneles de Diseño Gráfico y Gerencia de Mercadeo sin
            rehacer el esquema.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {stack.map((tech) => (
            <span
              key={tech.name}
              className="inline-flex items-center gap-2 bg-kromi-hueso border border-kromi-borde px-4 py-2.5 rounded-full text-sm font-semibold text-kromi-azul-osc"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tech.color }}
              />
              {tech.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
