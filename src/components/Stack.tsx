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
    <section className="stack" id="stack">
      <div className="wrap">
        <div className="sec-head">
          <p className="kicker">Debajo del capó</p>
          <h2>Arquitectura pensada para escalar sin refactor</h2>
          <p>
            La Fase 1 opera con un solo perfil (Estrategia + Producción), pero
            el modelo de datos y las políticas de acceso ya están preparados
            para sumar los paneles de Diseño Gráfico y Gerencia de Mercadeo sin
            rehacer el esquema.
          </p>
        </div>
        <div className="stack-row">
          {stack.map((tech) => (
            <span key={tech.name} className="chip">
              <span
                className="dot"
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
