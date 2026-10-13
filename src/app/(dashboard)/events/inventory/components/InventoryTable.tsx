'use client';

import { ArrowLeftRight, ChevronDown, ChevronUp, ChevronsUpDown, History, Pencil } from 'lucide-react';
import { formatQty, formatStamp, shortName } from '@/lib/inventory';
import type { InventarioArticuloRow, InventarioPermisos, InventarioSortKey } from '@/types';
import { CategoryTag, CondicionChip, ControlChip, iconBtnCls } from './ui';

type Props = {
  items: InventarioArticuloRow[];
  sort: InventarioSortKey;
  dir: 'asc' | 'desc';
  permissions: InventarioPermisos;
  onSort: (key: InventarioSortKey) => void;
  onEdit: (item: InventarioArticuloRow) => void;
  onMove: (item: InventarioArticuloRow) => void;
  onActivity: (item: InventarioArticuloRow) => void;
};

function Quantity({ item }: { item: InventarioArticuloRow }) {
  if (item.tipo_control === 'INDIVIDUAL' && item.cantidad === 0) {
    return <span className="inline-flex h-6 items-center rounded-full bg-[#FDEFD6] px-2.5 text-xs font-semibold text-[#7A4800]">Fuera de sede</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <span className="text-base font-extrabold text-[#10233F]">{formatQty(item.cantidad)}</span>{' '}
      <span className="text-xs text-[#566274]">{item.unidad_medida}</span>
    </span>
  );
}

function RowActions({ item, permissions, onEdit, onMove, onActivity }: Pick<Props, 'permissions' | 'onEdit' | 'onMove' | 'onActivity'> & { item: InventarioArticuloRow }) {
  return (
    <div className="flex items-center justify-end">
      {permissions.update ? (
        <button type="button" className={iconBtnCls} onClick={() => onEdit(item)} aria-label={`Editar ${item.nombre}`} title="Editar artículo">
          <Pencil size={19} aria-hidden="true" />
        </button>
      ) : null}
      {permissions.move ? (
        <button type="button" className={iconBtnCls} onClick={() => onMove(item)} aria-label={`Registrar movimiento de ${item.nombre}`} title="Registrar movimiento">
          <ArrowLeftRight size={19} aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" className={iconBtnCls} onClick={() => onActivity(item)} aria-label={`Ver actividad de ${item.nombre}`} title="Ver actividad">
        <History size={19} aria-hidden="true" />
      </button>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: InventarioSortKey;
  sort: InventarioSortKey;
  dir: 'asc' | 'desc';
  onSort: (key: InventarioSortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort === sortKey;
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`h-11 whitespace-nowrap border-b border-[#DDE3EC] bg-[#F7F9FC] px-3.5 text-xs font-bold ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 rounded text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] ${active ? 'text-[#0054AE]' : 'text-[#4A5668]'}`}
      >
        {label}
        <Icon size={14} aria-hidden="true" />
      </button>
    </th>
  );
}

export function InventoryTable(props: Props) {
  const { items, sort, dir, permissions, onSort, onEdit, onMove, onActivity } = props;
  const th = 'h-11 whitespace-nowrap border-b border-[#DDE3EC] bg-[#F7F9FC] px-3.5 text-left text-xs font-bold text-[#4A5668]';

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Artículos del inventario de la sede seleccionada</caption>
          <thead>
            <tr>
              <SortHeader label="Artículo" sortKey="nombre" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Categoría" sortKey="categoria" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Cantidad" sortKey="cantidad" sort={sort} dir={dir} onSort={onSort} align="right" />
              <SortHeader label="Ubicación actual" sortKey="ubicacion" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Condición" sortKey="condicion" sort={sort} dir={dir} onSort={onSort} />
              <th scope="col" className={th}>Control</th>
              <SortHeader label="Modificado" sortKey="modificado" sort={sort} dir={dir} onSort={onSort} />
              <th scope="col" className={`${th} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="group border-b border-[#E6EAF1] last:border-0 hover:bg-[#F5F9FF]">
                <td className="max-w-[320px] px-3.5 py-2.5 align-middle">
                  <div className="font-bold text-[#10233F]">{item.nombre}</div>
                  {item.especificaciones ? <div className="mt-0.5 line-clamp-2 text-xs text-[#566274]">{item.especificaciones}</div> : null}
                </td>
                <td className="px-3.5 py-2.5 align-middle"><CategoryTag name={item.categoria_nombre} /></td>
                <td className="px-3.5 py-2.5 text-right align-middle"><Quantity item={item} /></td>
                <td className="px-3.5 py-2.5 align-middle font-semibold text-[#10233F]">{item.ubicacion_nombre}</td>
                <td className="px-3.5 py-2.5 align-middle"><CondicionChip value={item.condicion} /></td>
                <td className="px-3.5 py-2.5 align-middle">
                  <ControlChip value={item.tipo_control} />
                  {item.codigo ? <div className="mt-1 text-xs tabular-nums text-[#566274]">{item.codigo}</div> : null}
                </td>
                <td className="px-3.5 py-2.5 align-middle">
                  <div className="whitespace-nowrap text-[13px]">{formatStamp(item.modificado_en)}</div>
                  <div className="text-xs text-[#566274]">{shortName(item.modificado_por_nombre)}</div>
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <RowActions item={item} permissions={permissions} onEdit={onEdit} onMove={onMove} onActivity={onActivity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 p-3 md:hidden" aria-label="Artículos del inventario">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-[#DDE3EC] bg-white p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[#10233F]">{item.nombre}</p>
                {item.especificaciones ? <p className="mt-0.5 line-clamp-2 text-xs text-[#566274]">{item.especificaciones}</p> : null}
              </div>
              <div className="shrink-0 text-right"><Quantity item={item} /></div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <CondicionChip value={item.condicion} />
              <ControlChip value={item.tipo_control} />
              {item.codigo ? <span className="text-xs tabular-nums text-[#566274]">{item.codigo}</span> : null}
              <span className="ml-auto text-[13px] font-semibold text-[#10233F]">{item.ubicacion_nombre}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#EDF0F5] pt-2">
              <p className="text-xs text-[#566274]">{formatStamp(item.modificado_en)} · {shortName(item.modificado_por_nombre)}</p>
              <RowActions item={item} permissions={permissions} onEdit={onEdit} onMove={onMove} onActivity={onActivity} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
