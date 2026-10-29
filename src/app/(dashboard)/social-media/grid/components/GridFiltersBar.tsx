'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { EstatusEnum, SocialAccountOption } from '@/types';
import { ESTATUS_STYLE } from '../utils/constants';
import { ESTATUS_ETAPAS } from '../utils/filters';
import type { GridFilters } from '../utils/filters';
import { QUICK_VIEW_LABEL } from '../utils/quickViews';
import { FilterPopover } from './FilterPopover';

interface Option {
  id: string;
  nombre: string;
}

interface Props {
  filters: GridFilters;
  hasActiveFilters: boolean;
  onChange: (patch: Partial<GridFilters>) => void;
  onClear: () => void;
  campanas: Option[];
  temas: Option[];
  cuentas: SocialAccountOption[];
  /** Cuántas publicaciones hay por estado en el alcance actual (sin aplicar el filtro de estado). */
  estatusCounts: Partial<Record<EstatusEnum, number>>;
}

const selectClass = 'ui-control rounded-lg px-3 py-2 text-xs';
const labelClass = 'block space-y-1 text-[11px] font-semibold ui-text-muted';

export function GridFiltersBar({ filters, hasActiveFilters, onChange, onClear, campanas, temas, cuentas, estatusCounts }: Props) {
  // La búsqueda se confirma con retraso para no escribir la URL en cada pulsación.
  const [text, setText] = useState(filters.q);
  useEffect(() => {
    if (text === filters.q) return;
    const timer = window.setTimeout(() => onChange({ q: text }), 250);
    return () => window.clearTimeout(timer);
  }, [text, filters.q, onChange]);
  const clearText = () => {
    setText('');
    onChange({ q: '' });
  };

  const toggleEstatus = (estatus: EstatusEnum) =>
    onChange({ estatus: filters.estatus.includes(estatus) ? filters.estatus.filter((item) => item !== estatus) : [...filters.estatus, estatus] });

  const cuentaLabel = (id: string) => {
    const account = cuentas.find((item) => item.id === id);
    return account ? `${account.platform} · ${account.display_name}` : 'Cuenta';
  };
  const rodajeLabel: Record<string, string> = { si: 'Con rodaje', no: 'Sin rodaje', PREBO: 'Rodaje en Prebo', MANONGO: 'Rodaje en Mañongo' };

  const chips: { id: string; label: string; remove: () => void }[] = [];
  if (filters.vista) chips.push({ id: 'vista', label: `Vista: ${QUICK_VIEW_LABEL[filters.vista]} · todos los meses`, remove: () => onChange({ vista: '' }) });
  if (filters.q.trim()) chips.push({ id: 'q', label: `Búsqueda: “${filters.q.trim()}”`, remove: clearText });
  for (const estatus of filters.estatus) chips.push({ id: `estado-${estatus}`, label: `Estado: ${ESTATUS_STYLE[estatus].label}`, remove: () => toggleEstatus(estatus) });
  if (filters.cuenta !== 'ALL') chips.push({ id: 'cuenta', label: cuentaLabel(filters.cuenta), remove: () => onChange({ cuenta: 'ALL' }) });
  if (filters.campana) chips.push({ id: 'campana', label: filters.campana === 'none' ? 'Sin campaña' : `Campaña: ${campanas.find((item) => item.id === filters.campana)?.nombre || 'vinculada'}`, remove: () => onChange({ campana: '' }) });
  if (filters.tema) chips.push({ id: 'tema', label: `Tema: ${filters.tema}`, remove: () => onChange({ tema: '' }) });
  if (filters.diseno !== 'todos') chips.push({ id: 'diseno', label: filters.diseno === 'si' ? 'Con diseño' : 'Sin diseño', remove: () => onChange({ diseno: 'todos' }) });
  if (filters.rodaje !== 'todos') chips.push({ id: 'rodaje', label: rodajeLabel[filters.rodaje], remove: () => onChange({ rodaje: 'todos' }) });
  if (filters.accion) chips.push({ id: 'accion', label: 'Necesita mi acción', remove: () => onChange({ accion: false }) });

  const moreActive = [filters.tema, filters.diseno !== 'todos', filters.rodaje !== 'todos'].filter(Boolean).length;

  return (
    <div className="ui-card-plain space-y-3 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 basis-[240px]">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gris)' }} />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Buscar por título, tema o campaña"
            aria-label="Buscar publicaciones"
            className="ui-control w-full rounded-lg py-2 pl-8 pr-3 text-xs"
          />
        </div>

        <FilterPopover label="Estado" activeCount={filters.estatus.length}>
          <fieldset className="space-y-1">
            <legend className="sr-only">Filtrar por estado</legend>
            {ESTATUS_ETAPAS.filter((estatus) => (estatusCounts[estatus] || 0) > 0 || filters.estatus.includes(estatus)).map((estatus) => (
              <label key={estatus} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50">
                <input type="checkbox" checked={filters.estatus.includes(estatus)} onChange={() => toggleEstatus(estatus)} className="accent-blue-700" />
                <span className="size-2 shrink-0 rounded-full" style={{ background: ESTATUS_STYLE[estatus].dotVar }} aria-hidden="true" />
                <span className="flex-1">{ESTATUS_STYLE[estatus].label}</span>
                <span className="text-[11px] ui-text-muted">{estatusCounts[estatus] || 0}</span>
              </label>
            ))}
            {!Object.values(estatusCounts).some(Boolean) && !filters.estatus.length && <p className="text-xs ui-text-muted">No hay publicaciones en este alcance.</p>}
          </fieldset>
        </FilterPopover>

        <select aria-label="Filtrar por cuenta" value={filters.cuenta} onChange={(event) => onChange({ cuenta: event.target.value })} className={selectClass}>
          <option value="ALL">Todas mis cuentas</option>
          {cuentas.map((account) => (
            <option key={account.id} value={account.id}>{account.platform} · {account.display_name}</option>
          ))}
        </select>

        <select aria-label="Filtrar por campaña" value={filters.campana} onChange={(event) => onChange({ campana: event.target.value })} className={selectClass}>
          <option value="">Todas las campañas</option>
          <option value="none">Sin campaña</option>
          {campanas.map((campana) => (
            <option key={campana.id} value={campana.id}>{campana.nombre}</option>
          ))}
        </select>

        <FilterPopover label="Más filtros" activeCount={moreActive}>
          <label className={labelClass}>
            Tema
            <select value={filters.tema} onChange={(event) => onChange({ tema: event.target.value })} className={`${selectClass} w-full`}>
              <option value="">Todos los temas</option>
              {temas.map((tema) => (
                <option key={tema.id} value={tema.nombre}>{tema.nombre}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Diseño
            <select value={filters.diseno} onChange={(event) => onChange({ diseno: event.target.value as GridFilters['diseno'] })} className={`${selectClass} w-full`}>
              <option value="todos">Con o sin diseño</option>
              <option value="si">Requieren diseño</option>
              <option value="no">Sin diseño</option>
            </select>
          </label>
          <label className={labelClass}>
            Rodaje
            <select value={filters.rodaje} onChange={(event) => onChange({ rodaje: event.target.value as GridFilters['rodaje'] })} className={`${selectClass} w-full`}>
              <option value="todos">Con o sin rodaje</option>
              <option value="si">Requieren rodaje</option>
              <option value="PREBO">Rodaje en Prebo</option>
              <option value="MANONGO">Rodaje en Mañongo</option>
              <option value="no">Sin rodaje</option>
            </select>
          </label>
        </FilterPopover>

        <button
          type="button"
          aria-pressed={filters.accion}
          onClick={() => onChange({ accion: !filters.accion })}
          title="Piezas que hoy esperan una acción tuya: completar brief, rodaje, revisar entrega, programar o confirmar"
          className="rounded-lg border px-3 py-2 text-xs font-semibold transition"
          style={filters.accion ? { background: 'var(--azul)', borderColor: 'var(--azul)', color: '#fff' } : { background: 'var(--papel)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          Necesita mi acción
        </button>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {chips.map((chip) => (
            <span key={chip.id} className="inline-flex items-center gap-1 rounded-full border py-1 pl-2.5 pr-1 text-[11px] font-medium" style={{ background: 'color-mix(in srgb, var(--azul) 8%, white)', borderColor: 'color-mix(in srgb, var(--azul) 25%, white)', color: 'var(--azul-osc)' }}>
              {chip.label}
              <button type="button" onClick={chip.remove} aria-label={`Quitar filtro: ${chip.label}`} className="rounded-full p-0.5 hover:bg-white">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button type="button" onClick={onClear} className="text-[11px] font-semibold underline" style={{ color: 'var(--azul)' }}>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
