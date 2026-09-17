"use client";

export function Hero() {
  return (
    <header className="hero">
      <div className="wrap">
        <div>
          <div className="eyebrow-row">
            <span className="pill">
              <span className="pill-dot" aria-hidden="true"></span>
              Caso de estudio · ernestodev
            </span>
          </div>
          <h1>
            El CRM interno que ordenó la producción de contenido de{" "}
            <em className="not-italic" style={{ color: "var(--amarillo)" }}>
              Kromi Market
            </em>
          </h1>
          <p className="lead">
            Kromi Market es una cadena de supermercados venezolana. Su equipo de
            redes sociales operaba a punta de hojas de cálculo dispersas, sin
            trazabilidad de plazos ni un lugar único para coordinar brief,
            rodaje y diseño. Diseñé y construí Kromi Connect para resolver
            justamente eso.
          </p>
          <div className="hero-actions">
            <a href="#solucion" className="btn btn-primary">
              Ver cómo funciona
            </a>
            <a href="#stack" className="btn btn-ghost">
              Ver arquitectura técnica
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <b>8</b>
              <span>tablas relacionales</span>
            </div>
            <div className="hero-stat">
              <b>3+2</b>
              <span>días de regla SLA automatizada</span>
            </div>
            <div className="hero-stat">
              <b>5</b>
              <span>fases de roadmap</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="device">
            <div className="device-bar">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="card-stack">
              <div className="mini-card mc-naranja">
                <div className="l">
                  <span className="t">Festival de Carnes Premium</span>
                  <span className="s">Vence brief en 2 días</span>
                </div>
                <span className="badge-status bs-light">En diseño</span>
              </div>
              <div className="mini-card mc-blanco">
                <div className="l">
                  <span className="t">Aniversario Mañongo — Reel</span>
                  <span className="s">Rodaje: sede Prebo</span>
                </div>
                <span className="badge-status bs-dark">Programado</span>
              </div>
              <div className="mini-card mc-morado">
                <div className="l">
                  <span className="t">Solicitud de Compras #114</span>
                  <span className="s">Convertir a ticket</span>
                </div>
                <span className="badge-status bs-light">Inbox</span>
              </div>
              <div className="mini-card mc-celeste">
                <div className="l">
                  <span className="t">Carrusel oferta fin de semana</span>
                  <span className="s">Publicado en 3 canales</span>
                </div>
                <span className="badge-status bs-dark">Publicado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
