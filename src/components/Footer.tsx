"use client";

export function Footer() {
  return (
    <footer className="bg-[var(--tinta)] py-10">
      <div className="wrap mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-8 text-[13px] text-white/60 max-[520px]:px-5 [&_a]:text-white/85 [&_a]:no-underline">
        <span>
          Kromi Connect — caso de estudio de producto interno, documentado por{" "}
          <a href="#">ernestodev</a>.
        </span>
        <span>
          Documento de portafolio · no es un producto público de Kromi Market
        </span>
      </div>
    </footer>
  );
}
