"use client";

export function Hero() {
  return (
    <header className="bg-kromi-azul text-white pt-24 pb-0 overflow-hidden">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center pb-16">
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 mb-6">
              <span className="inline-flex items-center gap-2 bg-white/14 border border-white/28 text-white text-xs font-semibold px-3.5 py-1.75 rounded-full">
                <span className="w-1.75 h-1.75 rounded-full bg-kromi-lima" />
                Caso de estudio · ernestodev
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display font-bold text-5xl leading-tight mb-6">
              El CRM interno que ordenó la producción de contenido de{" "}
              <em className="not-italic text-kromi-amarillo">Kromi Market</em>
            </h1>

            {/* Lead */}
            <p className="text-lg text-white/86 max-w-prose mb-8">
              Kromi Market es una cadena de supermercados venezolana. Su equipo
              de redes sociales operaba a punta de hojas de cálculo dispersas,
              sin trazabilidad de plazos ni un lugar único para coordinar brief,
              rodaje y diseño. Diseñé y construí Kromi Connect para resolver
              justamente eso.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3.5 mb-8">
              <a
                href="#solucion"
                className="inline-flex items-center gap-2 px-6 py-3.25 rounded-full bg-kromi-naranja text-kromi-tinta font-semibold hover:bg-opacity-90 transition-all"
              >
                Ver cómo funciona
              </a>
              <a
                href="#stack"
                className="inline-flex items-center gap-2 px-6 py-3.25 rounded-full bg-transparent border border-white/40 text-white font-semibold hover:border-white/60 transition-all"
              >
                Ver arquitectura técnica
              </a>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-7 pt-7 border-t border-white/20">
              <div className="flex flex-col">
                <b className="font-display font-bold text-3xl text-kromi-amarillo">
                  8
                </b>
                <span className="text-xs text-white/75">
                  tablas relacionales
                </span>
              </div>
              <div className="flex flex-col">
                <b className="font-display font-bold text-3xl text-kromi-amarillo">
                  3+2
                </b>
                <span className="text-xs text-white/75">
                  días de regla SLA automatizada
                </span>
              </div>
              <div className="flex flex-col">
                <b className="font-display font-bold text-3xl text-kromi-amarillo">
                  5
                </b>
                <span className="text-xs text-white/75">fases de roadmap</span>
              </div>
            </div>
          </div>

          {/* Visual mockup */}
          <div className="relative hidden lg:block">
            <div className="bg-kromi-azul-osc rounded-3xl p-4.5 shadow-2xl">
              <div className="flex gap-1.5 mb-3.5 px-1">
                <span className="w-2 h-2 rounded-full bg-white/25" />
                <span className="w-2 h-2 rounded-full bg-white/25" />
                <span className="w-2 h-2 rounded-full bg-white/25" />
              </div>
              <div className="space-y-2.5">
                <div className="bg-kromi-naranja text-kromi-tinta rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-display font-semibold text-sm">
                      Festival de Carnes Premium
                    </span>
                    <span className="text-xs opacity-80">
                      Vence brief en 2 días
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-white/35 text-kromi-tinta px-2.25 py-1 rounded-full">
                    En diseño
                  </span>
                </div>
                <div className="bg-white text-kromi-azul-osc rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-display font-semibold text-sm">
                      Aniversario Mañongo — Reel
                    </span>
                    <span className="text-xs opacity-70">
                      Rodaje: sede Prebo
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-black/18 px-2.25 py-1 rounded-full">
                    Programado
                  </span>
                </div>
                <div className="bg-kromi-morado text-kromi-papel rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-display font-semibold text-sm">
                      Inbox: Compras solicita promoción
                    </span>
                    <span className="text-xs opacity-75">
                      +5 entradas esta semana
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-kromi-papel/25 px-2.25 py-1 rounded-full">
                    Nuevo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
