'use client';

import { useState } from 'react';

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
  const [showAll, setShowAll] = useState(false);
  const visibleCategories = showAll ? categories : categories.slice(0, 8);
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-xs font-semibold text-slate-800">Temas de contenido</legend>
      <div className="flex flex-wrap gap-2">
        {visibleCategories.map((category) => {
          const checked = selectedIds.includes(category.id);
          return <button key={category.id} type="button" aria-pressed={checked} onClick={() => onChange(checked
            ? selectedIds.filter((id) => id !== category.id)
            : [...selectedIds, category.id])} className={`rounded-full border px-3 py-1.5 text-xs transition ${checked ? 'border-blue-700 bg-blue-50 font-semibold text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'}`}>{category.nombre}</button>;
        })}
        {categories.length > 8 && <button type="button" onClick={() => setShowAll((current) => !current)} className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600">{showAll ? 'Menos' : 'Más…'}</button>}
        {!categories.length && <span className="text-xs text-slate-500">No hay temas disponibles.</span>}
      </div>
      <p className="text-[11px] text-slate-500">Puedes elegir varios temas.</p>
    </fieldset>
  );
}
