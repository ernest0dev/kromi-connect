'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FormatoEnum } from '@/types';
import { FORMATO_LABEL } from '../utils/constants';
import { getMonthName } from '../utils/date';
import { GridHeaderProps } from '../types/grid';

export function GridHeader({
  currentDate,
  formatoFiltro,
  onPrevMonth,
  onNextMonth,
  onFiltroChange,
}: GridHeaderProps) {
  const monthName = getMonthName(currentDate);

  return (
    <div
      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border"
      style={{ background: 'var(--papel)', borderColor: 'var(--borde)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold mr-1" style={{ color: 'var(--gris)' }}>
          Formato:
        </span>
        <button
          onClick={() => onFiltroChange('TODOS')}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
          style={
            formatoFiltro === 'TODOS'
              ? { background: 'var(--azul)', color: '#fff' }
              : { background: 'var(--hueso)', color: 'var(--gris)' }
          }
        >
          Todos
        </button>
        {(['CARRUSEL', 'POST', 'REEL', 'STORY'] as FormatoEnum[]).map((fmt) => {
          const isSelected = formatoFiltro === fmt;
          return (
            <button
              key={fmt}
              onClick={() => onFiltroChange(fmt)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
              style={
                isSelected
                  ? { background: 'var(--azul)', color: '#fff' }
                  : { background: 'var(--hueso)', color: 'var(--gris)' }
              }
            >
              {FORMATO_LABEL[fmt]}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onPrevMonth}
          aria-label="Mes anterior"
          className="p-2 rounded-lg border transition"
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span
          className="text-sm font-semibold capitalize min-w-[140px] text-center"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}
        >
          {monthName}
        </span>
        <button
          onClick={onNextMonth}
          aria-label="Mes siguiente"
          className="p-2 rounded-lg border transition"
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
