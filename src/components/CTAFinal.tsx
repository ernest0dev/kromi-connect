"use client";

export function CTAFinal() {
  return (
    <section className="bg-kromi-naranja py-24" id="contacto">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="font-display font-bold text-4xl text-kromi-tinta mb-3.5">
              ¿Quieres ver el resto del proceso o hablar de un proyecto similar?
            </h2>
            <p className="text-base text-kromi-tinta/70">
              Puedo compartir el SRS completo, el esquema de base de datos o
              caminar contigo por las decisiones de arquitectura.
            </p>
          </div>
          <a
            href="mailto:hello@ernestodev.com"
            className="flex-none bg-kromi-tinta text-white px-6 py-3.25 rounded-full font-semibold hover:bg-kromi-azul-osc transition-colors"
          >
            Escríbeme
          </a>
        </div>
      </div>
    </section>
  );
}
