"use client";

export function CTAFinal() {
  return (
    <section className="cta-final bg-[var(--naranja)] py-[88px] max-[860px]:py-16" id="contacto">
      <div className="wrap mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-8 px-8 max-[520px]:px-5 max-[860px]:flex-col max-[860px]:items-start">
        <div>
          <h2 className="max-w-[520px] text-[30px] text-[#2e1600]">
            ¿Quieres ver el resto del proceso o hablar de un proyecto similar?
          </h2>
          <p className="mt-[10px] text-[15px] text-[#5a3300]">
            Puedo compartir el SRS completo, el esquema de base de datos o
            caminar contigo por las decisiones de arquitectura.
          </p>
        </div>
        <a href="#" className="btn btn-primary inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-6 py-[13px] text-[15px] font-semibold no-underline !bg-[#2e1600] !text-white">
          Escríbeme
        </a>
      </div>
    </section>
  );
}
