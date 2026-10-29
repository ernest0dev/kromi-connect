'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { GROUP_KEYS, GROUP_LABEL, SORT_KEYS, SORT_LABEL } from '../utils/filters';
import type { GridFilters, SortKey } from '../utils/filters';

interface Props {
  sort: GridFilters['sort'];
  dir: GridFilters['dir'];
  group: GridFilters['group'];
  shown: number;
  total: number;
  onChange: (patch: Partial<GridFilters>) => void;
}

const selectClass = 'ui-control rounded-lg px-2.5 py-1.5 text-xs';

export function GridListToolbar({ sort, dir, group, shown, total, onChange }: Props) {
  const changeSort = (value: SortKey) => onChange({ sort: value, dir: value === 'actualizacion' ? 'desc' : 'asc' });
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="ui-badge" role="status">
        {shown === total ? `${total} publicaciones` : `${shown} de ${total}`}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold ui-text-muted">
          Ordenar
          <select value={sort} onChange={(event) => changeSort(event.target.value as SortKey)} className={selectClass}>
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>{SORT_LABEL[key]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange({ dir: dir === 'asc' ? 'desc' : 'asc' })}
            aria-label={`Dirección del orden: ${dir === 'asc' ? 'ascendente' : 'descendente'}. Cambiar`}
            title={dir === 'asc' ? 'Ascendente' : 'Descendente'}
            className="ui-control rounded-lg p-1.5"
          >
            {dir === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
          </button>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold ui-text-muted">
          Agrupar
          <select value={group} onChange={(event) => onChange({ group: event.target.value as GridFilters['group'] })} className={selectClass}>
            {GROUP_KEYS.map((key) => (
              <option key={key} value={key}>{GROUP_LABEL[key]}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
