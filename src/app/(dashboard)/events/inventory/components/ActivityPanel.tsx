'use client';

import { useEffect, useState } from 'react';
import { getInventoryItemActivityAction } from '@/app/actions/inventory/inventory';
import { MOVIMIENTO_ETIQUETAS, formatQty, formatStamp, shortName } from '@/lib/inventory';
import type { InventarioActividadRow, InventarioArticuloRow } from '@/types';
import { CondicionChip, Notice, SidePanel, Spinner, btnCls, btnPrimaryCls } from './ui';

type Filtro = 'TODOS' | 'TRASLADO' | 'SALIDA' | 'RETORNO' | 'AJUSTE';

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'TRASLADO', label: 'Traslados' },
  { value: 'SALIDA', label: 'Salidas' },
  { value: 'RETORNO', label: 'Retornos' },
  { value: 'AJUSTE', label: 'Ajustes' },
];

const TIPO_STYLE: Record<string, string> = {
  CONTEO_INICIAL: 'bg-[#E7EAF0] text-[#454F5E]',
  TRASLADO: 'bg-[#E3EFFC] text-[#0B4A94]',
  SALIDA: 'bg-[#FDEFD6] text-[#7A4800]',
  RETORNO: 'bg-[#E2F5EA] text-[#0B6B40]',
  AJUSTE: 'bg-[#EDE7F8] text-[#4B2A8A]',
};

type Props = {
  item: InventarioArticuloRow;
  canMove: boolean;
  onClose: () => void;
  onMove: (item: InventarioArticuloRow) => void;
};

function place(sede: string | null, ubicacion: string | null, externo: string | null): string | null {
  if (sede && ubicacion) return `${sede} · ${ubicacion}`;
  if (externo) return externo;
  return null;
}

function route(row: InventarioActividadRow): string {
  const origen = place(row.origen_sede_nombre, row.origen_ubicacion_nombre, row.origen_externo);
  const destino = place(row.destino_sede_nombre, row.destino_ubicacion_nombre, row.destino_externo);
  switch (row.tipo) {
    case 'CONTEO_INICIAL':
      return destino ?? 'Alta del artículo';
    case 'TRASLADO':
      return `${origen ?? '—'} → ${destino ?? '—'}`;
    case 'SALIDA':
      return `${origen ?? '—'} → ${destino ?? 'Fuera de las sedes'}`;
    case 'RETORNO':
      return `${origen ?? 'Fuera de las sedes'} → ${destino ?? '—'}`;
    default:
      return destino ?? origen ?? '—';
  }
}

function signed(delta: number): string {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '−'}${formatQty(Math.abs(delta))}`;
}

export function ActivityPanel({ item, canMove, onClose, onMove }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [rows, setRows] = useState<InventarioActividadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getInventoryItemActivityAction({
          articuloId: item.id,
          tipo: filtro === 'TODOS' ? null : filtro,
          offset,
        });
        if (cancelled) return;
        if (!result.success) {
          setError(result.error);
        } else {
          setRows((prev) => (offset === 0 ? result.rows : [...prev, ...result.rows]));
          setTotal(result.total);
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar la actividad. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, filtro, offset, reloadKey]);

  function changeFiltro(next: Filtro) {
    if (next === filtro) return;
    setLoading(true);
    setError(null);
    setOffset(0);
    setFiltro(next);
  }

  function loadMore() {
    setLoading(true);
    setError(null);
    setOffset(rows.length);
  }

  function retry() {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <SidePanel
      wide
      title="Actividad del artículo"
      onClose={onClose}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <b className="text-sm text-[#10233F]">{item.nombre}</b>
          <span>{item.sede_nombre} · {item.ubicacion_nombre}</span>
          <CondicionChip value={item.condicion} />
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[#566274]">El historial no se puede editar; los errores se corrigen con un ajuste.</p>
          <div className="flex gap-2.5">
            <button type="button" className={btnCls} onClick={onClose}>Cerrar</button>
            {canMove ? (
              <button type="button" className={btnPrimaryCls} onClick={() => onMove(item)}>Registrar movimiento</button>
            ) : null}
          </div>
        </div>
      }
    >
      <div role="group" aria-label="Filtrar actividad por tipo" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filtro === f.value}
            onClick={() => changeFiltro(f.value)}
            className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] ${filtro === f.value ? 'border-[#0066D2] bg-[#E3EFFC] text-[#0B4A94]' : 'border-[#CBD3DF] bg-white text-[#3A4658]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="space-y-3">
          <Notice tone="error" role="alert">{error}</Notice>
          <button type="button" className={btnCls} onClick={retry}>Reintentar</button>
        </div>
      ) : null}

      {!error && !loading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#CBD3DF] px-4 py-8 text-center text-sm text-[#566274]">
          {filtro === 'TODOS' ? 'Este artículo aún no tiene movimientos.' : 'No hay movimientos de este tipo.'}
        </p>
      ) : null}

      <ol className="space-y-2.5" aria-busy={loading}>
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-[#DDE3EC] bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${TIPO_STYLE[row.tipo] ?? TIPO_STYLE.AJUSTE}`}>
                  {MOVIMIENTO_ETIQUETAS[row.tipo] ?? row.tipo}
                </span>
                <span className="text-[13px] text-[#566274]">{formatStamp(row.fecha_hora)}</span>
              </div>
              <div className="text-right">
                <span className={`text-base font-extrabold tabular-nums ${row.delta > 0 ? 'text-[#0B6B40]' : row.delta < 0 ? 'text-[#A8200F]' : 'text-[#10233F]'}`}>
                  {signed(row.delta)}
                </span>{' '}
                <span className="text-xs text-[#566274]">{item.unidad_medida}</span>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#10233F]">{route(row)}</p>
            {row.observacion ? <p className="mt-1 text-[13px] leading-snug text-[#3A4658]">{row.observacion}</p> : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF0F5] pt-2 text-xs text-[#566274]">
              <span>Registrado por {shortName(row.registrado_por_nombre)}</span>
              <span>Saldo: <b className="tabular-nums text-[#10233F]">{formatQty(row.saldo)}</b> {item.unidad_medida}</span>
            </div>
          </li>
        ))}
      </ol>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-[#566274]" role="status"><Spinner />Cargando actividad…</p>
      ) : null}

      {!loading && !error && rows.length < total ? (
        <div className="pt-4 text-center">
          <button type="button" className={btnCls} onClick={loadMore}>
            Cargar más ({total - rows.length})
          </button>
        </div>
      ) : null}
    </SidePanel>
  );
}
