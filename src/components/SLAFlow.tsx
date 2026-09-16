"use client";

const slaSteps = [
  {
    day: "Día 0",
    title: "Publicación",
    description: "Fecha fijada por la estrategia de contenido.",
  },
  {
    day: "–3 días",
    title: "Límite de rodaje",
    description: "Ventana de captura en piso de tienda.",
  },
  {
    day: "–5 días",
    title: "Límite de brief",
    description: "3 días de rodaje + 2 de diseño, contados hacia atrás.",
  },
  {
    day: "+2 días",
    title: "Entrega estimada de diseño",
    description: "Calculada desde la fecha de solicitud a diseño.",
  },
  {
    day: "Trazado",
    title: "Cumplimiento SLA",
    description: "Fecha real vs. estimada, para medir al equipo de diseño.",
  },
];

export function SLAFlow() {
  return (
    <section className="bg-kromi-azul-osc text-white py-24" id="sla">
      <div className="max-w-7xl mx-auto px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-bold text-kromi-lima mb-3">
            Automatización
          </p>
          <h2 className="font-display font-bold text-4xl text-white mb-3.5">
            La Regla SLA 3+2, calculada sola
          </h2>
          <p className="text-base text-white/72">
            El punto de partida siempre es la fecha de publicación. A partir de
            ahí, el sistema calcula hacia atrás cuándo debe estar listo cada
            entregable — y lo recalcula si algo cambia.
          </p>
        </div>

        {/* SLA Track */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
          {slaSteps.map((step) => (
            <div
              key={step.day}
              className="bg-white/6 border border-white/14 rounded-2xl p-5"
            >
              <span className="block font-display font-bold text-xs text-kromi-lima mb-2.5">
                {step.day}
              </span>
              <div className="font-display font-semibold text-sm text-white mb-1.5">
                {step.title}
              </div>
              <div className="text-xs text-white/68">{step.description}</div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="flex gap-3.5 items-start bg-kromi-naranja/14 border border-kromi-naranja/35 rounded-2xl p-5">
          <span className="flex-none bg-kromi-naranja text-kromi-tinta font-display font-bold text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
            Quick Reschedule
          </span>
          <p className="text-sm text-white/85">
            Si la fecha de publicación cambia, una sola acción del servidor
            recalcula en cascada el límite de brief y la entrega estimada de
            diseño — <strong>nadie vuelve a hacer esa cuenta a mano.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
