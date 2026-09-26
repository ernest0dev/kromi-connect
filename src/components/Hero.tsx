"use client";

export function Hero() {
  return (
    <header className="hero relative overflow-hidden bg-[var(--azul)] pt-24 text-white max-[860px]:pt-16">
      <div className="wrap mx-auto grid w-full max-w-[1120px] grid-cols-[1.1fr_0.9fr] items-center gap-14 px-8 pb-[72px] max-[860px]:grid-cols-1 max-[860px]:pb-12 max-[520px]:px-5">
        <div>
          <div className="eyebrow-row mb-[22px] flex items-center gap-[10px]">
            <span className="pill inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/[0.14] px-[14px] py-[7px] text-[13px] font-semibold text-white">
              <span className="pill-dot h-[7px] w-[7px] rounded-full bg-[var(--lima)]" aria-hidden="true"></span>
              Caso de estudio · ernestodev
            </span>
          </div>
          <h1 className="mb-5 text-[46px] text-white max-[860px]:text-[34px] max-[520px]:text-[28px]">
            El CRM interno que ordenó la producción de contenido de{" "}
            <em className="not-italic text-[var(--amarillo)]">
              Kromi Market
            </em>
          </h1>
          <p className="lead mb-8 max-w-[46ch] text-[17px] text-white/85">
            Kromi Market es una cadena de supermercados venezolana. Su equipo de
            redes sociales operaba a punta de hojas de cálculo dispersas, sin
            trazabilidad de plazos ni un lugar único para coordinar brief,
            rodaje y diseño. Diseñé y construí Kromi Connect para resolver
            justamente eso.
          </p>
          <div className="hero-actions flex flex-wrap gap-[14px]">
            <a href="#solucion" className="btn btn-primary inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-6 py-[13px] text-[15px] font-semibold no-underline bg-[var(--naranja)] text-[#2e1600]">
              Ver cómo funciona
            </a>
            <a href="#stack" className="btn btn-ghost inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-6 py-[13px] text-[15px] font-semibold no-underline border-white/40 bg-transparent text-white">
              Ver arquitectura técnica
            </a>
          </div>
          <div className="hero-stats mt-11 flex gap-7 border-t border-white/20 pt-7 max-[860px]:flex-wrap">
            <div className="hero-stat [&_b]:block [&_b]:font-[var(--font-display)] [&_b]:text-2xl [&_b]:text-[var(--amarillo)] [&_span]:text-[13px] [&_span]:text-white/75">
              <b>8</b>
              <span>tablas relacionales</span>
            </div>
            <div className="hero-stat [&_b]:block [&_b]:font-[var(--font-display)] [&_b]:text-2xl [&_b]:text-[var(--amarillo)] [&_span]:text-[13px] [&_span]:text-white/75">
              <b>3+2</b>
              <span>días de regla SLA automatizada</span>
            </div>
            <div className="hero-stat [&_b]:block [&_b]:font-[var(--font-display)] [&_b]:text-2xl [&_b]:text-[var(--amarillo)] [&_span]:text-[13px] [&_span]:text-white/75">
              <b>5</b>
              <span>fases de roadmap</span>
            </div>
          </div>
        </div>
        <div className="hero-visual relative">
          <div className="device rounded-[22px] bg-[var(--azul-osc)] p-[18px] shadow-[0_30px_60px_-20px_rgba(0,20,60,0.55)]">
            <div className="device-bar mb-[14px] flex gap-1.5 px-1 [&_span]:h-2 [&_span]:w-2 [&_span]:rounded-full [&_span]:bg-white/25">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="card-stack flex flex-col gap-[10px]">
              <div className="mini-card mc-naranja flex items-center justify-between rounded-[14px] px-4 py-[14px] [&_.l]:flex [&_.l]:flex-col [&_.l]:gap-[3px] [&_.t]:font-[var(--font-display)] [&_.t]:text-sm [&_.t]:font-semibold [&_.s]:text-xs [&_.s]:opacity-80 bg-[var(--naranja)] text-[#2e1600]">
                <div className="l">
                  <span className="t">Festival de Carnes Premium</span>
                  <span className="s">Vence brief en 2 días</span>
                </div>
                <span className="badge-status bs-light whitespace-nowrap rounded-full px-[9px] py-1 text-[11px] font-bold bg-white/35 text-[#2e1600]">En diseño</span>
              </div>
              <div className="mini-card mc-blanco flex items-center justify-between rounded-[14px] px-4 py-[14px] [&_.l]:flex [&_.l]:flex-col [&_.l]:gap-[3px] [&_.t]:font-[var(--font-display)] [&_.t]:text-sm [&_.t]:font-semibold [&_.s]:text-xs [&_.s]:opacity-80 bg-white text-[var(--azul-osc)]">
                <div className="l">
                  <span className="t">Aniversario Mañongo — Reel</span>
                  <span className="s">Rodaje: sede Prebo</span>
                </div>
                <span className="badge-status bs-dark whitespace-nowrap rounded-full px-[9px] py-1 text-[11px] font-bold bg-black/15">Programado</span>
              </div>
              <div className="mini-card mc-morado flex items-center justify-between rounded-[14px] px-4 py-[14px] [&_.l]:flex [&_.l]:flex-col [&_.l]:gap-[3px] [&_.t]:font-[var(--font-display)] [&_.t]:text-sm [&_.t]:font-semibold [&_.s]:text-xs [&_.s]:opacity-80 bg-[var(--morado)] text-[#f3d9ff]">
                <div className="l">
                  <span className="t">Solicitud de Compras #114</span>
                  <span className="s">Convertir a ticket</span>
                </div>
                <span className="badge-status bs-light whitespace-nowrap rounded-full px-[9px] py-1 text-[11px] font-bold bg-white/35 text-[#2e1600]">Inbox</span>
              </div>
              <div className="mini-card mc-celeste flex items-center justify-between rounded-[14px] px-4 py-[14px] [&_.l]:flex [&_.l]:flex-col [&_.l]:gap-[3px] [&_.t]:font-[var(--font-display)] [&_.t]:text-sm [&_.t]:font-semibold [&_.s]:text-xs [&_.s]:opacity-80 bg-[var(--celeste)] text-[#00303f]">
                <div className="l">
                  <span className="t">Carrusel oferta fin de semana</span>
                  <span className="s">Publicado en 3 canales</span>
                </div>
                <span className="badge-status bs-dark whitespace-nowrap rounded-full px-[9px] py-1 text-[11px] font-bold bg-black/15">Publicado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
