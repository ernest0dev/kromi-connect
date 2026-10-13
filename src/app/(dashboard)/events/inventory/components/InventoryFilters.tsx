'use client';

import { Search } from 'lucide-react';
import { CONDICIONES, TIPOS_CONTROL } from '@/lib/inventory';
import type { InventarioCategoria, InventarioConsulta, InventarioUbicacion } from '@/types';

type Props = {
  query: InventarioConsulta;
  search: string;
  categorias: InventarioCategoria[];
  ubicaciones: InventarioUbicacion[];
  onSearch: (value: string) => void;
  onFilter: (patch: Partial<InventarioConsulta>) => void;
  onClear: () => void;
};

const selectCls =
  'h-10 min-w-[9.5rem] rounded-lg border border-[#CBD3DF] bg-white px-3 text-sm font-medium text-[#10233F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066D2]';

export function InventoryFilters({ query, search, categorias, ubicaciones, onSearch, onFilter, onClear }: Props) {
  const hasFilters = Boolean(search || query.categoria || query.ubicacion || query.condicion || query.control);

  return (
    <div role="search" className="flex flex-wrap items-center gap-2.5 border-b border-[#E6EAF1] p-4">
      <div className="relative min-w-[16rem] flex-1 basis-80">
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          maxLength={100}
          placeholder="Buscar por nombre, especificaciones o código"
          aria-label="Buscar por nombre, especificaciones o código"
          className="h-10 w-full rounded-lg border border-[#CBD3DF] bg-white pl-10 pr-3 text-sm text-[#10233F] placeholder:text-[#6B7482] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066D2]"
        />
      </div>
      <select aria-label="Filtrar por categoría" className={selectCls} value={query.categoria} onChange={(event) => onFilter({ categoria: event.target.value })}>
        <option value="">Categoría: todas</option>
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
        ))}
      </select>
      <select aria-label="Filtrar por ubicación" className={selectCls} value={query.ubicacion} onChange={(event) => onFilter({ ubicacion: event.target.value })}>
        <option value="">Ubicación: todas</option>
        {ubicaciones.map((ubicacion) => (
          <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>
        ))}
      </select>
      <select aria-label="Filtrar por condición" className={selectCls} value={query.condicion} onChange={(event) => onFilter({ condicion: event.target.value as InventarioConsulta['condicion'] })}>
        <option value="">Condición: todas</option>
        {CONDICIONES.map((condicion) => (
          <option key={condicion.value} value={condicion.value}>{condicion.label}</option>
        ))}
      </select>
      <select aria-label="Filtrar por tipo de control" className={selectCls} value={query.control} onChange={(event) => onFilter({ control: event.target.value as InventarioConsulta['control'] })}>
        <option value="">Control: todos</option>
        {TIPOS_CONTROL.map((tipo) => (
          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
        ))}
      </select>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="h-10 rounded-lg px-3 text-sm font-semibold text-[#0054AE] hover:bg-[#E6EEF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19]"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
