"use client";

export function Problem() {
  return (
    <section
      className="bg-kromi-papel border-b border-kromi-borde py-24"
      id="problema"
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-bold text-kromi-naranja mb-3">
            El punto de partida
          </p>
          <h2 className="font-display font-bold text-4xl text-kromi-azul-osc mb-3.5">
            De hojas de cálculo dispersas a un flujo con reglas propias
          </h2>
          <p className="text-base text-kromi-gris">
            El equipo de Redes Sociales cumplía una función que cruza
            estrategia, producción y coordinación con otras áreas de la empresa.
            Ese cruce era exactamente lo que no tenía un sistema propio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Antes */}
          <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-5 font-display font-bold text-sm text-amber-900">
              Antes
            </div>
            <div className="space-y-3.5">
              <div className="flex gap-3 items-start text-sm text-amber-900">
                <span className="flex-none w-5.5 h-5.5 bg-amber-200 text-amber-900 rounded text-xs font-bold flex items-center justify-center">
                  –
                </span>
                <span>
                  Planificación de grilla y brief en hojas de cálculo separadas,
                  sin vínculo entre sí.
                </span>
              </div>
              <div className="flex gap-3 items-start text-sm text-amber-900">
                <span className="flex-none w-5.5 h-5.5 bg-amber-200 text-amber-900 rounded text-xs font-bold flex items-center justify-center">
                  –
                </span>
                <span>
                  Sin fecha límite calculada: cada retraso en diseño se
                  descubría manualmente.
                </span>
              </div>
              <div className="flex gap-3 items-start text-sm text-amber-900">
                <span className="flex-none w-5.5 h-5.5 bg-amber-200 text-amber-900 rounded text-xs font-bold flex items-center justify-center">
                  –
                </span>
                <span>
                  Solicitudes de Compras, HR y Proveedores llegaban por canales
                  sueltos, sin ticket ni seguimiento.
                </span>
              </div>
              <div className="flex gap-3 items-start text-sm text-amber-900">
                <span className="flex-none w-5.5 h-5.5 bg-amber-200 text-amber-900 rounded text-xs font-bold flex items-center justify-center">
                  –
                </span>
                <span>
                  Reprogramar una publicación significaba recalcular todo a
                  mano.
                </span>
              </div>
            </div>
          </div>

          {/* Después */}
          <div className="bg-kromi-azul text-white rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-5 font-display font-bold text-sm text-kromi-amarillo">
              Con Kromi Connect
            </div>
            <div className="space-y-3.5">
              <div className="flex gap-3 items-start text-sm text-white/92">
                <span className="flex-none w-5.5 h-5.5 bg-kromi-amarillo/22 text-kromi-amarillo rounded text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
                <span>
                  Una sola entidad central (<em>publicaciones</em>) conecta
                  brief, rodaje, diseño y aprobación.
                </span>
              </div>
              <div className="flex gap-3 items-start text-sm text-white/92">
                <span className="flex-none w-5.5 h-5.5 bg-kromi-amarillo/22 text-kromi-amarillo rounded text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
                <span>
                  Fechas límite de brief y diseño calculadas automáticamente con
                  la Regla SLA 3+2.
                </span>
              </div>
              <div className="flex gap-3 items-start text-sm text-white/92">
                <span className="flex-none w-5.5 h-5.5 bg-kromi-amarillo/22 text-kromi-amarillo rounded text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
                <span>
                  Inbox de solicitudes de terceros con conversión a ticket en un
                  clic.
                </span>
              </div>
              <div className="flex gap-3 items-start text-sm text-white/92">
                <span className="flex-none w-5.5 h-5.5 bg-kromi-amarillo/22 text-kromi-amarillo rounded text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
                <span>
                  Quick Reschedule: mover la fecha de publicación recalcula todo
                  hacia atrás, en cascada.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
