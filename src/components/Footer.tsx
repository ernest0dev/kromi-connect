"use client";

export function Footer() {
  return (
    <footer className="bg-kromi-tinta text-white/60 text-xs py-10">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 flex-wrap">
          <span>
            Kromi Connect — caso de estudio de producto interno, documentado por{" "}
            <a
              href="#"
              className="text-white/85 hover:text-white transition-colors"
            >
              ernestodev
            </a>
            .
          </span>
          <span>
            Documento de portafolio · no es un producto público de Kromi Market
          </span>
        </div>
      </div>
    </footer>
  );
}
