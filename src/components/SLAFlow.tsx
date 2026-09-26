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
    <section className="flujo bg-[var(--azul-osc)] py-[88px] text-white max-[860px]:py-16 [&_.sec-head_h2]:text-white [&_.sec-head_p]:text-white/70 [&_.kicker]:text-[var(--lima)]" id="sla">
      <div className="wrap mx-auto w-full max-w-[1120px] px-8 max-[520px]:px-5">
        <div className="sec-head mb-12 max-w-[640px] [&_h2]:mb-[14px] [&_h2]:text-[32px] [&_h2]:text-[var(--azul-osc)] [&_p]:text-base [&_p]:text-[var(--gris)]">
          <p className="kicker mb-3 text-[13px] font-bold text-[var(--naranja)]">Automatización</p>
          <h2>La Regla SLA 3+2, calculada sola</h2>
          <p>
            El punto de partida siempre es la fecha de publicación. A partir de
            ahí, el sistema calcula hacia atrás cuándo debe estar listo cada
            entregable — y lo recalcula si algo cambia.
          </p>
        </div>
        <div className="sla-track mb-8 grid grid-cols-5 gap-[14px] max-[860px]:grid-cols-2 max-[520px]:grid-cols-1">
          {slaSteps.map((step) => (
            <div key={step.day} className="sla-step relative rounded-[14px] border border-white/[0.14] bg-white/[0.06] p-5 [&_.n]:mb-[10px] [&_.n]:block [&_.n]:font-[var(--font-display)] [&_.n]:text-[13px] [&_.n]:font-extrabold [&_.n]:text-[var(--amarillo)] [&_.t]:mb-1.5 [&_.t]:font-[var(--font-display)] [&_.t]:text-[15px] [&_.t]:font-semibold [&_.d]:text-[12.5px] [&_.d]:text-white/70">
              <span className="n">{step.day}</span>
              <div className="t">{step.title}</div>
              <div className="d">{step.description}</div>
            </div>
          ))}
        </div>
        <div className="sla-note flex items-start gap-[14px] rounded-[14px] border border-[rgba(242,141,25,0.35)] bg-[rgba(242,141,25,0.14)] p-5 [&_.tag]:flex-none [&_.tag]:rounded-full [&_.tag]:bg-[var(--naranja)] [&_.tag]:px-3 [&_.tag]:py-1.5 [&_.tag]:font-[var(--font-display)] [&_.tag]:text-[13px] [&_.tag]:font-extrabold [&_.tag]:text-[#2e1600] [&_p]:text-[14.5px] [&_p]:text-white/85 [&_strong]:text-white">
          <span className="tag">Quick Reschedule</span>
          <p>
            Si la fecha de publicación cambia, una sola acción del servidor
            recalcula en cascada el límite de brief y la entrega estimada de
            diseño — <strong>nadie vuelve a hacer esa cuenta a mano.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
