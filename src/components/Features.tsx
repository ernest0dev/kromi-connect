"use client";

const features = [
  {
    icon: "P",
    title: "Parrilla con tres vistas",
    description:
      "Calendario macro, Kanban por estatus y tabla tipo spreadsheet, todas sobre el mismo dataset — sin duplicar información.",
    color: "bg-kromi-azul",
  },
  {
    icon: "B",
    title: "Brief a diseño estructurado",
    description:
      "Hook, cuerpo, CTA y hashtags versionados, con historial de revisiones y assets vinculados desde Google Drive.",
    color: "bg-kromi-naranja text-kromi-tinta",
  },
  {
    icon: "R",
    title: "Rodaje en piso de tienda",
    description:
      "Vista PWA optimizada para móvil, con checklist de tomas por sede (Prebo, Mañongo) y área física específica.",
    color: "bg-kromi-verde",
  },
  {
    icon: "S",
    title: "Inbox de solicitudes",
    description:
      "Compras, HR y Proveedores entran por un único canal. Cada solicitud se convierte en ticket de contenido sin retipear nada.",
    color: "bg-kromi-morado",
  },
  {
    icon: "I",
    title: "Inventario de premios",
    description:
      "Control de stock físico por sede para sorteos y concursos, con trazabilidad opcional hacia el proveedor de origen.",
    color: "bg-kromi-celeste text-kromi-tinta",
  },
  {
    icon: "A",
    title: "Reportes y escucha social",
    description:
      "Log semanal de quejas y sugerencias, más informes post-mortem por campaña con alcance, interacciones y presupuesto.",
    color: "bg-kromi-azul-osc",
  },
];

export function Features() {
  return (
    <section className="bg-kromi-hueso py-24" id="solucion">
      <div className="max-w-7xl mx-auto px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-bold text-kromi-naranja mb-3">
            La solución
          </p>
          <h2 className="font-display font-bold text-4xl text-kromi-azul-osc mb-3.5">
            Un sistema pensado para cómo trabaja el equipo, no al revés
          </h2>
          <p className="text-base text-kromi-gris">
            Cada vista responde a un momento real del flujo de trabajo:
            planificar, producir, coordinar con otras áreas y medir resultados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature.icon}
              className="bg-kromi-papel border border-kromi-borde rounded-3xl p-7"
            >
              <div
                className={`w-11 h-11 rounded-2xl ${feature.color} flex items-center justify-center font-display font-bold text-lg text-white mb-4.5`}
              >
                {feature.icon}
              </div>
              <h3 className="font-display font-bold text-lg text-kromi-azul-osc mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-kromi-gris">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
