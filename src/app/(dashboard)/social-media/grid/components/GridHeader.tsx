'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FORMATO_LABEL } from '../utils/constants';
import { getMonthName } from '../utils/date';
import { FORMATOS_FILTRO } from '../utils/filters';
import { GridHeaderProps } from '../types/grid';

export function GridHeader({ currentDate, formatoFiltro, onPrevMonth, onNextMonth, onToday, onFiltroChange }: GridHeaderProps) {
  const monthName = getMonthName(currentDate);
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--papel)]';

  return (
    <div className="ui-card-plain flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-3.5 py-3">
      <div role="group" aria-label="Filtrar por formato" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold ui-text-muted">Formato:</span>
        {FORMATOS_FILTRO.map((formato) => {
          const isSelected = formatoFiltro === formato;
          return (
            <button
              key={formato}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onFiltroChange(formato)}
              className={'rounded-lg px-3 py-1.5 text-xs font-semibold transition ' + focusRing}
              style={isSelected ? { background: 'var(--azul)', color: '#fff' } : { background: 'var(--hueso)', color: 'var(--gris)' }}
            >
              {formato === 'TODOS' ? 'Todos' : FORMATO_LABEL[formato]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Mes anterior"
          className={'rounded-lg border p-2 transition ' + focusRing}
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span
          className="min-w-[140px] text-center text-sm font-semibold capitalize"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}
        >
          {monthName}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Mes siguiente"
          className={'rounded-lg border p-2 transition ' + focusRing}
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToday}
          aria-label="Ir al mes actual"
          className={'rounded-lg border px-3 py-2 text-xs font-semibold transition ' + focusRing}
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          Hoy
        </button>
      </div>
    </div>
  );
}
