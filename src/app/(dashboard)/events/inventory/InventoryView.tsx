'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PAGE_SIZES, buildInventoryQueryString, sedeSlug } from '@/lib/inventory';
import type {
  InventarioArticuloRow,
  InventarioCategoria,
  InventarioConsulta,
  InventarioPermisos,
  InventarioSede,
  InventarioSortKey,
  InventarioUbicacion,
} from '@/types';
import { ActivityPanel } from './components/ActivityPanel';
import { ArticleForm } from './components/ArticleForm';
import { InventoryFilters } from './components/InventoryFilters';
import { InventoryTable } from './components/InventoryTable';
import { MovementForm } from './components/MovementForm';
import { Notice, Toast, btnCls, btnPrimaryCls } from './components/ui';

type Props = {
  query: InventarioConsulta;
  sedes: InventarioSede[];
  sedeActual: InventarioSede;
  counts: Record<string, number>;
  categorias: InventarioCategoria[];
  ubicaciones: InventarioUbicacion[];
  items: InventarioArticuloRow[];
  total: number;
  permissions: InventarioPermisos;
  loadError: string | null;
};

type Panel =
  | { kind: 'create' }
  | { kind: 'edit'; item: InventarioArticuloRow }
  | { kind: 'move'; item: InventarioArticuloRow }
  | { kind: 'activity'; item: InventarioArticuloRow }
  | null;

export function InventoryView({ query, sedes, sedeActual, counts, categorias, ubicaciones, items, total, permissions, loadError }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState(query.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const navigate = useCallback(
    (patch: Partial<InventarioConsulta>) => {
      const resetPage = !('page' in patch);
      const qs = buildInventoryQueryString(query, resetPage ? { ...patch, page: 1 } : patch);
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [query, router, pathname],
  );

  function onSearch(value: string) {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => navigate({ q: value.trim() }), 350);
  }

  function onSort(key: InventarioSortKey) {
    navigate(query.sort === key ? { dir: query.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  }

  function onClear() {
    setSearch('');
    navigate({ q: '', categoria: '', ubicacion: '', condicion: '', control: '' });
  }

  function onSaved(message: string) {
    setPanel(null);
    setToast({ kind: 'ok', text: message });
    startTransition(() => router.refresh());
  }

  const sedeUbicaciones = ubicaciones.filter((u) => u.sede_id === sedeActual.id);
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(total, query.page * query.pageSize);
  const filtered = Boolean(query.q || query.categoria || query.ubicacion || query.condicion || query.control);
  const sedeTotal = counts[sedeActual.id] ?? 0;
  const closePanel = () => setPanel(null);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#10233F]">Inventario de Eventos</h1>
          <p className="mt-1 text-sm text-[#566274]">Existencias compartidas por sede. Todo cambio queda en el historial del artículo.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {permissions.move && items.length > 0 ? (
            <button type="button" className={btnCls} onClick={() => setPanel({ kind: 'move', item: items[0] })}>
              <ArrowLeftRight size={18} aria-hidden="true" />Registrar movimiento
            </button>
          ) : null}
          {permissions.create ? (
            <button type="button" className={btnPrimaryCls} onClick={() => setPanel({ kind: 'create' })}>
              <Plus size={18} aria-hidden="true" />Añadir artículo
            </button>
          ) : null}
        </div>
      </header>

      <nav aria-label="Sedes" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-1.5 border-b border-[#DDE3EC]" role="tablist">
          {sedes.map((sede) => {
            const active = sede.id === sedeActual.id;
            return (
              <li key={sede.id} role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSearch('');
                    const qs = buildInventoryQueryString(
                      { ...query, q: '', categoria: '', ubicacion: '', condicion: '', control: '', page: 1 },
                      { sede: sedeSlug(sede.codigo) },
                    );
                    startTransition(() => router.replace(`${pathname}?${qs}`, { scroll: false }));
                  }}
                  className={`-mb-px flex items-center gap-2 border-b-[3px] px-3.5 py-2.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] ${active ? 'border-[#0066D2] text-[#0054AE]' : 'border-transparent text-[#4A5668] hover:text-[#10233F]'}`}
                >
                  {sede.nombre}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-[#E3EFFC] text-[#0B4A94]' : 'bg-[#EDF0F5] text-[#4A5668]'}`}>{counts[sede.id] ?? 0}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-label={`Artículos de ${sedeActual.nombre}`} className="overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white">
        <InventoryFilters
          query={query}
          search={search}
          categorias={categorias}
          ubicaciones={sedeUbicaciones}
          onSearch={onSearch}
          onFilter={navigate}
          onClear={onClear}
        />

        <div aria-busy={pending} className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {loadError ? (
            <div className="space-y-3 p-6">
              <Notice tone="error" role="alert">{loadError}</Notice>
              <button type="button" className={btnCls} onClick={() => startTransition(() => router.refresh())}>Reintentar</button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-bold text-[#10233F]">
                {filtered ? 'Ningún artículo coincide con los filtros.' : `${sedeActual.nombre} aún no tiene artículos.`}
              </p>
              <p className="mt-1 text-sm text-[#566274]">
                {filtered ? 'Prueba con otra búsqueda o limpia los filtros.' : sedeTotal === 0 && permissions.create ? 'Añade el primero para empezar el inventario de esta sede.' : ''}
              </p>
              <div className="mt-4 flex justify-center gap-2.5">
                {filtered ? <button type="button" className={btnCls} onClick={onClear}>Limpiar filtros</button> : null}
                {!filtered && permissions.create ? (
                  <button type="button" className={btnPrimaryCls} onClick={() => setPanel({ kind: 'create' })}><Plus size={18} aria-hidden="true" />Añadir artículo</button>
                ) : null}
              </div>
            </div>
          ) : (
            <InventoryTable
              items={items}
              sort={query.sort}
              dir={query.dir}
              permissions={permissions}
              onSort={onSort}
              onEdit={(item) => setPanel({ kind: 'edit', item })}
              onMove={(item) => setPanel({ kind: 'move', item })}
              onActivity={(item) => setPanel({ kind: 'activity', item })}
            />
          )}
        </div>

        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EAF1] px-4 py-3 text-[13px] text-[#566274]">
            <p aria-live="polite">Mostrando <b className="text-[#10233F]">{from}–{to}</b> de <b className="text-[#10233F]">{total}</b></p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                Filas
                <select
                  className="h-9 rounded-lg border border-[#CBD3DF] bg-white px-2 text-sm text-[#10233F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066D2]"
                  value={query.pageSize}
                  onChange={(event) => navigate({ pageSize: Number(event.target.value) })}
                >
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" className={btnCls} disabled={query.page <= 1} onClick={() => navigate({ page: query.page - 1 })} aria-label="Página anterior">
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <span className="px-2 tabular-nums">Página {query.page} de {pages}</span>
                <button type="button" className={btnCls} disabled={query.page >= pages} onClick={() => navigate({ page: query.page + 1 })} aria-label="Página siguiente">
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {panel?.kind === 'create' || panel?.kind === 'edit' ? (
        <ArticleForm
          mode={panel.kind}
          item={panel.kind === 'edit' ? panel.item : undefined}
          sedes={sedes}
          categorias={categorias}
          ubicaciones={ubicaciones}
          defaultSedeId={sedeActual.id}
          permissions={permissions}
          onClose={closePanel}
          onSaved={onSaved}
          onMove={(item) => setPanel({ kind: 'move', item })}
        />
      ) : null}
      {panel?.kind === 'move' ? (
        <MovementForm item={panel.item} sedes={sedes} ubicaciones={ubicaciones} onClose={closePanel} onSaved={onSaved} />
      ) : null}
      {panel?.kind === 'activity' ? (
        <ActivityPanel item={panel.item} canMove={permissions.move} onClose={closePanel} onMove={(item) => setPanel({ kind: 'move', item })} />
      ) : null}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
