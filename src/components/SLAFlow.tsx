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
    <section className="flujo" id="sla">
      <div className="wrap">
        <div className="sec-head">
          <p className="kicker">Automatización</p>
          <h2>La Regla SLA 3+2, calculada sola</h2>
          <p>
            El punto de partida siempre es la fecha de publicación. A partir de
            ahí, el sistema calcula hacia atrás cuándo debe estar listo cada
            entregable — y lo recalcula si algo cambia.
          </p>
        </div>
        <div className="sla-track">
          {slaSteps.map((step) => (
            <div key={step.day} className="sla-step">
              <span className="n">{step.day}</span>
              <div className="t">{step.title}</div>
              <div className="d">{step.description}</div>
            </div>
          ))}
        </div>
        <div className="sla-note">
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
