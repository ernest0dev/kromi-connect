"use client";

const features = [
  {
    icon: "P",
    title: "Parrilla con tres vistas",
    description:
      "Calendario macro, Kanban por estatus y tabla tipo spreadsheet, todas sobre el mismo dataset — sin duplicar información.",
    color: "fi-azul",
  },
  {
    icon: "B",
    title: "Brief a diseño estructurado",
    description:
      "Hook, cuerpo, CTA y hashtags versionados, con historial de revisiones y assets vinculados desde Google Drive.",
    color: "fi-naranja",
  },
  {
    icon: "R",
    title: "Rodaje en piso de tienda",
    description:
      "Vista PWA optimizada para móvil, con checklist de tomas por sede (Prebo, Mañongo) y área física específica.",
    color: "fi-verde",
  },
  {
    icon: "S",
    title: "Inbox de solicitudes",
    description:
      "Compras, HR y Proveedores entran por un único canal. Cada solicitud se convierte en ticket de contenido sin retipear nada.",
    color: "fi-morado",
  },
  {
    icon: "I",
    title: "Inventario de premios",
    description:
      "Control de stock físico por sede para sorteos y concursos, con trazabilidad opcional hacia el proveedor de origen.",
    color: "fi-celeste",
  },
  {
    icon: "A",
    title: "Reportes y escucha social",
    description:
      "Log semanal de quejas y sugerencias, más informes post-mortem por campaña con alcance, interacciones y presupuesto.",
    color: "fi-oscuro",
  },
];

export function Features() {
  return (
    <section className="arquitectura" id="solucion">
      <div className="wrap">
        <div className="sec-head">
          <p className="kicker">La solución</p>
          <h2>Un sistema pensado para cómo trabaja el equipo, no al revés</h2>
          <p>
            Cada vista responde a un momento real del flujo de trabajo:
            planificar, producir, coordinar con otras áreas y medir resultados.
          </p>
        </div>
        <div className="feat-grid">
          {features.map((feature) => (
            <div key={feature.icon} className="feat-card">
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
