"use client";

export function Nav() {
  return (
    <nav className="sticky top-0 z-40 bg-kromi-hueso/92 backdrop-blur-lg border-b border-kromi-borde">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-[72px]">
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="22" fill="#0066D2" />
            <circle cx="38" cy="28" r="11" fill="#fff" />
            <circle cx="50" cy="24" r="8" fill="#fff" />
            <rect x="32" y="38" width="12" height="34" fill="#F28D19" />
            <path
              d="M44 38 L62 38 L48 55 L64 55 L44 72 L48 58 L34 58 Z"
              fill="#F28D19"
            />
          </svg>
          <span className="font-display font-bold text-lg text-kromi-azul-osc">
            kromi<span className="text-kromi-naranja">connect</span>
          </span>
        </div>

        <div className="hidden md:flex gap-8 text-sm font-medium text-kromi-gris">
          <a
            href="#problema"
            className="hover:text-kromi-azul transition-colors"
          >
            El problema
          </a>
          <a
            href="#solucion"
            className="hover:text-kromi-azul transition-colors"
          >
            La solución
          </a>
          <a href="#sla" className="hover:text-kromi-azul transition-colors">
            Automatización
          </a>
          <a href="#stack" className="hover:text-kromi-azul transition-colors">
            Stack
          </a>
        </div>

        <a
          href="#contacto"
          className="bg-kromi-tinta text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-kromi-azul-osc transition-colors"
        >
          Hablemos
        </a>
      </div>
    </nav>
  );
}
