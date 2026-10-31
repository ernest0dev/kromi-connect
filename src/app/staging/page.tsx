import { STAGING_FIXTURES } from "@/lib/fixtures/staging";

export default function StagingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Kromi Connect · staging
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Demostración de solo lectura
        </h1>
        <p className="max-w-2xl text-slate-700">
          Esta vista usa fixtures locales. No inicia sesión, no consulta Supabase y no ejecuta
          cambios, integraciones ni tareas programadas.
        </p>
      </header>

      <section aria-label="Datos de demostración" className="grid gap-4 sm:grid-cols-3">
        {STAGING_FIXTURES.map((fixture) => (
          <article key={fixture.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">{fixture.status}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">{fixture.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{fixture.detail}</p>
          </article>
        ))}
      </section>

      <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Para probar operaciones reales, usa un entorno local con Supabase local.
      </p>
    </main>
  );
}
