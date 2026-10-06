'use client';

export interface ContentCategoryOption {
  id: string;
  nombre: string;
}

interface Props {
  categories: ContentCategoryOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ContentCategorySelector({ categories, selectedIds, onChange }: Props) {
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-xs font-semibold text-slate-800">Temas de contenido</legend>
      <details className="group rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-xs text-slate-700">
          <span className="flex items-center justify-between gap-2">
            <span>{selectedIds.length ? categories.filter((item) => selectedIds.includes(item.id)).map((item) => item.nombre).join(', ') : 'Seleccionar temas'}</span>
            <span className="shrink-0 text-slate-500">{selectedIds.length} seleccionados⌄</span>
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
          {categories.map((category) => {
            const checked = selectedIds.includes(category.id);
            return (
              <label key={category.id} className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked
                    ? selectedIds.filter((id) => id !== category.id)
                    : [...selectedIds, category.id])}
                  className="accent-blue-700"
                />
                {category.nombre}
              </label>
            );
          })}
        </div>
      </details>
    </fieldset>
  );
}
