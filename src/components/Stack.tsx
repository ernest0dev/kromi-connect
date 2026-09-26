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
    <section className="stack border-y border-[var(--borde)] bg-[var(--papel)] py-[88px] max-[860px]:py-16" id="stack">
      <div className="wrap mx-auto w-full max-w-[1120px] px-8 max-[520px]:px-5">
        <div className="sec-head mb-12 max-w-[640px] [&_h2]:mb-[14px] [&_h2]:text-[32px] [&_h2]:text-[var(--azul-osc)] [&_p]:text-base [&_p]:text-[var(--gris)]">
          <p className="kicker mb-3 text-[13px] font-bold text-[var(--naranja)]">Debajo del capó</p>
          <h2>Arquitectura pensada para escalar sin refactor</h2>
          <p>
            La Fase 1 opera con un solo perfil (Estrategia + Producción), pero
            el modelo de datos y las políticas de acceso ya están preparados
            para sumar los paneles de Diseño Gráfico y Gerencia de Mercadeo sin
            rehacer el esquema.
          </p>
        </div>
        <div className="stack-row flex flex-wrap gap-3">
          {stack.map((tech) => (
            <span key={tech.name} className="chip inline-flex items-center gap-2 rounded-full border border-[var(--borde)] bg-[var(--hueso)] px-4 py-[10px] text-sm font-semibold text-[var(--azul-osc)] [&_.dot]:h-2 [&_.dot]:w-2 [&_.dot]:rounded-full">
              <span
                className="dot h-2 w-2 rounded-full"
                style={{ backgroundColor: tech.color }}
              ></span>
              {tech.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
