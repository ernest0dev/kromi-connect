"use client";

export function Problem() {
  return (
    <section className="problema border-b border-[var(--borde)] bg-[var(--papel)] py-[88px] max-[860px]:py-16" id="problema">
      <div className="wrap mx-auto w-full max-w-[1120px] px-8 max-[520px]:px-5">
        <div className="sec-head mb-12 max-w-[640px] [&_h2]:mb-[14px] [&_h2]:text-[32px] [&_h2]:text-[var(--azul-osc)] [&_p]:text-base [&_p]:text-[var(--gris)]">
          <p className="kicker mb-3 text-[13px] font-bold text-[var(--naranja)]">El punto de partida</p>
          <h2>De hojas de cálculo dispersas a un flujo con reglas propias</h2>
          <p>
            El equipo de Redes Sociales cumplía una función que cruza
            estrategia, producción y coordinación con otras áreas de la empresa.
            Ese cruce era exactamente lo que no tenía un sistema propio.
          </p>
        </div>
        <div className="ba-grid grid grid-cols-2 gap-6 max-[860px]:grid-cols-1">
          <div className="ba-card ba-antes rounded-[18px] p-8 border border-dashed border-[#c9c4b6] bg-[#f2efe8] [&_.ba-label]:text-[#8a6a2c] [&_.ba-item]:text-[#5b564a] [&_.ba-ico]:bg-[#e3ddc9] [&_.ba-ico]:text-[#8a6a2c]">
            <span className="ba-label mb-5 inline-flex items-center gap-2 font-[var(--font-display)] text-[15px] font-bold">Antes</span>
            <div className="ba-list flex flex-col gap-[14px]">
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">–</span>
                <span>
                  Planificación de grilla y brief en hojas de cálculo separadas,
                  sin vínculo entre sí.
                </span>
              </div>
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">–</span>
                <span>
                  Sin fecha límite calculada: cada retraso en diseño se
                  descubría manualmente.
                </span>
              </div>
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">–</span>
                <span>
                  Solicitudes de Compras, HR y Proveedores llegaban por canales
                  sueltos, sin ticket ni seguimiento.
                </span>
              </div>
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">–</span>
                <span>
                  Reprogramar una publicación significaba recalcular todo a
                  mano.
                </span>
              </div>
            </div>
          </div>
          <div className="ba-card ba-despues rounded-[18px] p-8 bg-[var(--azul)] text-white [&_.ba-label]:text-[var(--amarillo)] [&_.ba-item]:text-white/90 [&_.ba-ico]:bg-[rgba(241,195,62,0.22)] [&_.ba-ico]:text-[var(--amarillo)]">
            <span className="ba-label mb-5 inline-flex items-center gap-2 font-[var(--font-display)] text-[15px] font-bold">Con Kromi Connect</span>
            <div className="ba-list flex flex-col gap-[14px]">
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">✓</span>
                <span>
                  Una sola entidad central (<em>publicaciones</em>) conecta
                  brief, rodaje, diseño y aprobación.
                </span>
              </div>
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">✓</span>
                <span>
                  Fechas límite de brief y diseño calculadas automáticamente con
                  la Regla SLA 3+2.
                </span>
              </div>
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">✓</span>
                <span>
                  Inbox de solicitudes de terceros con conversión a ticket en un
                  clic.
                </span>
              </div>
              <div className="ba-item flex items-start gap-3 text-[15px]">
                <span className="ba-ico mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] font-extrabold">✓</span>
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
