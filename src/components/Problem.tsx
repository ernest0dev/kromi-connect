"use client";

export function Problem() {
  return (
    <section className="problema" id="problema">
      <div className="wrap">
        <div className="sec-head">
          <p className="kicker">El punto de partida</p>
          <h2>De hojas de cálculo dispersas a un flujo con reglas propias</h2>
          <p>
            El equipo de Redes Sociales cumplía una función que cruza
            estrategia, producción y coordinación con otras áreas de la empresa.
            Ese cruce era exactamente lo que no tenía un sistema propio.
          </p>
        </div>
        <div className="ba-grid">
          <div className="ba-card ba-antes">
            <span className="ba-label">Antes</span>
            <div className="ba-list">
              <div className="ba-item">
                <span className="ba-ico">–</span>
                <span>
                  Planificación de grilla y brief en hojas de cálculo separadas,
                  sin vínculo entre sí.
                </span>
              </div>
              <div className="ba-item">
                <span className="ba-ico">–</span>
                <span>
                  Sin fecha límite calculada: cada retraso en diseño se
                  descubría manualmente.
                </span>
              </div>
              <div className="ba-item">
                <span className="ba-ico">–</span>
                <span>
                  Solicitudes de Compras, HR y Proveedores llegaban por canales
                  sueltos, sin ticket ni seguimiento.
                </span>
              </div>
              <div className="ba-item">
                <span className="ba-ico">–</span>
                <span>
                  Reprogramar una publicación significaba recalcular todo a
                  mano.
                </span>
              </div>
            </div>
          </div>
          <div className="ba-card ba-despues">
            <span className="ba-label">Con Kromi Connect</span>
            <div className="ba-list">
              <div className="ba-item">
                <span className="ba-ico">✓</span>
                <span>
                  Una sola entidad central (<em>publicaciones</em>) conecta
                  brief, rodaje, diseño y aprobación.
                </span>
              </div>
              <div className="ba-item">
                <span className="ba-ico">✓</span>
                <span>
                  Fechas límite de brief y diseño calculadas automáticamente con
                  la Regla SLA 3+2.
                </span>
              </div>
              <div className="ba-item">
                <span className="ba-ico">✓</span>
                <span>
                  Inbox de solicitudes de terceros con conversión a ticket en un
                  clic.
                </span>
              </div>
              <div className="ba-item">
                <span className="ba-ico">✓</span>
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
