"use client";

const features = [
  {
    icon: "P",
    title: "Calendario de contenido con tres vistas",
    description:
      "Calendario de contenido, Kanban por estatus y tabla tipo spreadsheet, todas sobre el mismo dataset — sin duplicar información.",
    color: "bg-[var(--azul)]",
  },
  {
    icon: "B",
    title: "Brief a diseño estructurado",
    description:
      "Hook, cuerpo, CTA y hashtags versionados, con historial de revisiones y assets vinculados desde Google Drive.",
    color: "bg-[var(--naranja)] text-[#2e1600]",
  },
  {
    icon: "R",
    title: "Rodaje en piso de tienda",
    description:
      "Vista PWA optimizada para móvil, con checklist de tomas por sede (Prebo, Mañongo) y área física específica.",
    color: "bg-[var(--verde)]",
  },
  {
    icon: "S",
    title: "Inbox de solicitudes",
    description:
      "Compras, HR y Proveedores entran por un único canal. Cada solicitud se convierte en ticket de contenido sin retipear nada.",
    color: "bg-[var(--morado)]",
  },
  {
    icon: "I",
    title: "Inventario de premios",
    description:
      "Control de stock físico por sede para sorteos y concursos, con trazabilidad opcional hacia el proveedor de origen.",
    color: "bg-[var(--celeste)] text-[#00303f]",
  },
  {
    icon: "A",
    title: "Reportes y escucha social",
    description:
      "Log semanal de quejas y sugerencias, más informes post-mortem por campaña con alcance, interacciones y presupuesto.",
    color: "bg-[var(--azul-osc)]",
  },
];

export function Features() {
  return (
    <section className="arquitectura bg-[var(--hueso)] py-[88px] max-[860px]:py-16" id="solucion">
      <div className="wrap mx-auto w-full max-w-[1120px] px-8 max-[520px]:px-5">
        <div className="sec-head mb-12 max-w-[640px] [&_h2]:mb-[14px] [&_h2]:text-[32px] [&_h2]:text-[var(--azul-osc)] [&_p]:text-base [&_p]:text-[var(--gris)]">
          <p className="kicker mb-3 text-[13px] font-bold text-[var(--naranja)]">La solución</p>
          <h2>Un sistema pensado para cómo trabaja el equipo, no al revés</h2>
          <p>
            Cada vista responde a un momento real del flujo de trabajo:
            planificar, producir, coordinar con otras áreas y medir resultados.
          </p>
        </div>
        <div className="feat-grid grid grid-cols-3 gap-5 max-[860px]:grid-cols-2 max-[520px]:grid-cols-1">
          {features.map((feature) => (
            <div key={feature.icon} className="feat-card rounded-[18px] border border-[var(--borde)] bg-[var(--papel)] p-7 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:text-[var(--azul-osc)] [&_p]:text-[14.5px] [&_p]:text-[var(--gris)]">
              <div className={`feat-ico ${feature.color}`}>{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
