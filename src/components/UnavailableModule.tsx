interface UnavailableModuleProps {
  title: string;
  description: string;
}

export function UnavailableModule({ title, description }: UnavailableModuleProps) {
  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-6 text-slate-900">
      <p className="text-sm font-semibold text-amber-900">Módulo temporalmente no disponible</p>
      <h1 className="mt-2 text-xl font-bold">{title}</h1>
      <p className="mt-3 text-sm text-slate-700">{description}</p>
      <p className="mt-4 text-xs text-slate-600">
        El esquema de datos de este módulo aún no está versionado. No se consultarán ni modificarán datos hasta recuperar su migración.
      </p>
    </section>
  );
}
