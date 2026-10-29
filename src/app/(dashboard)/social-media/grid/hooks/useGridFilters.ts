'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEFAULT_FILTERS, hasActiveFilters, parseFilters, writeFiltersToParams } from '../utils/filters';
import type { GridFilters } from '../utils/filters';

/**
 * Filtros, orden y agrupación viven en la URL (?q=…&estado=…): sobreviven a recargas y se pueden compartir.
 * Se actualizan con history.replaceState (sin pedir datos al servidor); useSearchParams se sincroniza solo.
 */
export function useGridFilters() {
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(paramsString)), [paramsString]);
  const monthParam = searchParams.get('mes');
  /** Sube cada vez que se limpian los filtros, para reiniciar controles con estado local (búsqueda). */
  const [resetNonce, setResetNonce] = useState(0);

  const writeParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    const before = params.toString();
    mutate(params);
    const after = params.toString();
    if (before === after) return;
    window.history.replaceState(null, '', `${window.location.pathname}${after ? `?${after}` : ''}`);
  }, []);

  const setFilters = useCallback(
    (patch: Partial<GridFilters>) => {
      writeParams((params) => writeFiltersToParams({ ...parseFilters(params), ...patch }, params));
    },
    [writeParams],
  );

  const clearFilters = useCallback(() => {
    writeParams((params) => {
      const current = parseFilters(params);
      writeFiltersToParams({ ...DEFAULT_FILTERS, sort: current.sort, dir: current.dir, group: current.group }, params);
    });
    setResetNonce((value) => value + 1);
  }, [writeParams]);

  const setMonthParam = useCallback(
    (value: string | null) => {
      writeParams((params) => {
        if (value) params.set('mes', value);
        else params.delete('mes');
      });
    },
    [writeParams],
  );

  return { filters, setFilters, clearFilters, resetNonce, hasActiveFilters: hasActiveFilters(filters), monthParam, setMonthParam };
}
