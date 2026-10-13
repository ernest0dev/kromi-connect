'use client';

import { useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { createInventoryItemAction, createInventoryLocationAction, updateInventoryItemAction } from '@/app/actions/inventory/inventory';
import { CONDICIONES, LIMITES, TIPOS_CONTROL, UNIDADES_SUGERIDAS, formatQty, formatStamp, shortName } from '@/lib/inventory';
import type {
  InventarioArticuloRow,
  InventarioCategoria,
  InventarioCondicion,
  InventarioPermisos,
  InventarioSede,
  InventarioTipoControl,
  InventarioUbicacion,
} from '@/types';
import { ControlChip, Field, Notice, SectionLabel, SidePanel, Spinner, btnCls, btnPrimaryCls, inputCls, textareaCls } from './ui';

type Props = {
  mode: 'create' | 'edit';
  item?: InventarioArticuloRow;
  sedes: InventarioSede[];
  categorias: InventarioCategoria[];
  ubicaciones: InventarioUbicacion[];
  defaultSedeId: string;
  permissions: InventarioPermisos;
  onClose: () => void;
  onSaved: (message: string) => void;
  onMove?: (item: InventarioArticuloRow) => void;
};

type Values = {
  categoriaId: string;
  nombre: string;
  especificaciones: string;
  tipoControl: InventarioTipoControl;
  codigo: string;
  cantidad: string;
  unidadMedida: string;
  sedeId: string;
  ubicacionId: string;
  condicion: InventarioCondicion;
};

const valuesFromItem = (item: InventarioArticuloRow): Values => ({
  categoriaId: item.categoria_id,
  nombre: item.nombre,
  especificaciones: item.especificaciones ?? '',
  tipoControl: item.tipo_control,
  codigo: item.codigo ?? '',
  cantidad: String(item.cantidad),
  unidadMedida: item.unidad_medida,
  sedeId: item.sede_id,
  ubicacionId: item.ubicacion_id,
  condicion: item.condicion,
});

const conditionLabel = (value: string) => CONDICIONES.find((c) => c.value === value)?.label ?? value;

export function ArticleForm({ mode, item, sedes, categorias, ubicaciones, defaultSedeId, permissions, onClose, onSaved, onMove }: Props) {
  const formId = useId();
  const [base, setBase] = useState<InventarioArticuloRow | undefined>(item);
  const [values, setValues] = useState<Values>(() =>
    item
      ? valuesFromItem(item)
      : {
          categoriaId: '',
          nombre: '',
          especificaciones: '',
          tipoControl: 'LOTE',
          codigo: '',
          cantidad: '',
          unidadMedida: 'unidades',
          sedeId: defaultSedeId,
          ubicacionId: '',
          condicion: 'DISPONIBLE',
        },
  );
  const [version, setVersion] = useState(item?.version ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [conflict, setConflict] = useState<InventarioArticuloRow | null>(null);
  const [extraLocations, setExtraLocations] = useState<InventarioUbicacion[]>([]);
  const [newLocation, setNewLocation] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);

  const isCreate = mode === 'create';
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDuplicate(false);
  };

  const sedeUbicaciones = useMemo(
    () =>
      [...ubicaciones, ...extraLocations.filter((extra) => !ubicaciones.some((u) => u.id === extra.id))]
        .filter((u) => u.sede_id === values.sedeId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [ubicaciones, extraLocations, values.sedeId],
  );
  const sedeName = sedes.find((s) => s.id === values.sedeId)?.nombre ?? '';

  async function submit(options: { confirmDuplicate?: boolean; version?: number } = {}) {
    setSaving(true);
    setError(null);
    try {
      const result = isCreate
        ? await createInventoryItemAction({
            categoriaId: values.categoriaId,
            nombre: values.nombre,
            especificaciones: values.especificaciones,
            tipoControl: values.tipoControl,
            codigo: values.codigo,
            cantidad: values.cantidad,
            unidadMedida: values.unidadMedida,
            ubicacionId: values.ubicacionId,
            condicion: values.condicion,
            confirmarDuplicado: options.confirmDuplicate === true,
          })
        : await updateInventoryItemAction({
            id: base!.id,
            expectedVersion: options.version ?? version,
            tipoControl: values.tipoControl,
            categoriaId: values.categoriaId,
            nombre: values.nombre,
            especificaciones: values.especificaciones,
            codigo: values.codigo,
            unidadMedida: values.unidadMedida,
            condicion: values.condicion,
          });

      if (result.success) {
        onSaved(isCreate ? 'Artículo creado.' : 'Cambios guardados.');
        return;
      }
      if (result.code === 'POSIBLE_DUPLICADO') setDuplicate(true);
      else if (result.code === 'CONFLICTO_VERSION' && result.current) setConflict(result.current);
      else setError(result.error);
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function createLocation() {
    if (newLocation === null) return;
    setLocationSaving(true);
    setLocationError(null);
    try {
      const result = await createInventoryLocationAction({ sedeId: values.sedeId, nombre: newLocation });
      if (result.success) {
        setExtraLocations((current) => [...current, { id: result.id, sede_id: values.sedeId, nombre: newLocation.trim() }]);
        set('ubicacionId', result.id);
        setNewLocation(null);
      } else {
        setLocationError(result.error);
      }
    } catch {
      setLocationError('No se pudo crear la ubicación. Inténtalo de nuevo.');
    } finally {
      setLocationSaving(false);
    }
  }

  function loadCurrent() {
    if (!conflict) return;
    setBase(conflict);
    setValues(valuesFromItem(conflict));
    setVersion(conflict.version);
    setConflict(null);
    setError(null);
  }

  const conflictRows = conflict && base
    ? ([
        ['Categoría', categorias.find((c) => c.id === values.categoriaId)?.nombre ?? '—', conflict.categoria_nombre],
        ['Nombre', values.nombre.trim(), conflict.nombre],
        ['Especificaciones', values.especificaciones.trim() || '—', conflict.especificaciones ?? '—'],
        ['Código', values.codigo.trim() || '—', conflict.codigo ?? '—'],
        ['Unidad de medida', values.unidadMedida.trim(), conflict.unidad_medida],
        ['Condición', conditionLabel(values.condicion), conditionLabel(conflict.condicion)],
        ['Cantidad', `${formatQty(base.cantidad)} ${base.unidad_medida}`, `${formatQty(conflict.cantidad)} ${conflict.unidad_medida}`],
        ['Ubicación', `${base.sede_nombre} · ${base.ubicacion_nombre}`, `${conflict.sede_nombre} · ${conflict.ubicacion_nombre}`],
      ] as const).filter((row) => row[1] !== row[2])
    : [];

  const title = isCreate ? 'Añadir artículo' : 'Editar artículo';
  const subtitle = isCreate ? 'Se guardará en el inventario compartido de Eventos' : `${base?.sede_nombre} · Inventario compartido de Eventos`;

  return (
    <SidePanel
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-[#566274]">
            {isCreate || !base ? (
              <>Los datos de creación y modificación<br />se completan al guardar.</>
            ) : (
              <>
                Creado {formatStamp(base.creado_en)} por {shortName(base.creado_por_nombre)}
                <br />
                Modificado {formatStamp(base.modificado_en)} por {shortName(base.modificado_por_nombre)}
              </>
            )}
          </p>
          <div className="flex gap-2.5">
            <button type="button" className={btnCls} onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" form={formId} className={btnPrimaryCls} disabled={saving} aria-busy={saving}>
              {saving ? (<><Spinner />Guardando…</>) : isCreate ? 'Guardar artículo' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <Notice tone="error" role="alert">{error}</Notice> : null}

        {duplicate ? (
          <Notice tone="warning" role="alert">
            <p className="font-semibold">Ya existe un artículo igual en esa ubicación.</p>
            <p className="mt-1">Si es la misma existencia, suma la cantidad con un movimiento. Si es otro lote distinto, puedes crearlo de todos modos.</p>
            <button type="button" className={`${btnCls} mt-2.5 min-h-9`} disabled={saving} onClick={() => void submit({ confirmDuplicate: true })}>
              Crear de todos modos
            </button>
          </Notice>
        ) : null}

        {conflict ? (
          <Notice tone="warning" role="alert">
            <p className="font-semibold">
              {shortName(conflict.modificado_por_nombre)} cambió este artículo {formatStamp(conflict.modificado_en).toLowerCase()} mientras lo editabas.
            </p>
            <p className="mt-1">Revisa las diferencias antes de guardar.</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#EFCB8A] bg-white text-[13px] text-[#10233F]">
              <div className="grid grid-cols-3 bg-[#F7F9FC] text-xs font-bold text-[#4A5668]">
                <div className="px-3 py-2">Campo</div>
                <div className="px-3 py-2">Tu versión</div>
                <div className="px-3 py-2">Versión actual</div>
              </div>
              {conflictRows.length === 0 ? (
                <p className="border-t border-[#E6EAF1] px-3 py-2.5">Los datos coinciden; solo cambió la versión.</p>
              ) : (
                conflictRows.map(([campo, mine, theirs]) => (
                  <div key={campo} className="grid grid-cols-3 border-t border-[#E6EAF1]">
                    <div className="px-3 py-2.5 font-semibold">{campo}</div>
                    <div className="break-words px-3 py-2.5">{mine}</div>
                    <div className="break-words px-3 py-2.5 font-bold">{theirs}</div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button type="button" className={`${btnPrimaryCls} min-h-9`} onClick={loadCurrent} disabled={saving}>Cargar versión actual</button>
              <button
                type="button"
                className={`${btnCls} min-h-9`}
                disabled={saving}
                onClick={() => {
                  const current = conflict;
                  setConflict(null);
                  setVersion(current.version);
                  void submit({ version: current.version });
                }}
              >
                Guardar mis cambios de todos modos
              </button>
            </div>
            <p className="mt-2 text-xs">Guardar mis cambios reemplaza lo que hizo la otra persona en los campos editables.</p>
          </Notice>
        ) : null}

        <section className="space-y-3.5" aria-labelledby={`${formId}-general`}>
          <span id={`${formId}-general`}><SectionLabel>Datos generales</SectionLabel></span>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Categoría" htmlFor={`${formId}-cat`}>
              <select id={`${formId}-cat`} className={inputCls} value={values.categoriaId} onChange={(e) => set('categoriaId', e.target.value)} required>
                <option value="">Elige una categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Nombre del artículo" htmlFor={`${formId}-nombre`}>
              <input id={`${formId}-nombre`} className={inputCls} value={values.nombre} maxLength={LIMITES.nombre} onChange={(e) => set('nombre', e.target.value)} required />
            </Field>
          </div>
          <Field
            label="Descripción / especificaciones"
            htmlFor={`${formId}-espec`}
            hint="Incluye lo que ayude a distinguir artículos parecidos: medida, color, material o uso."
          >
            <textarea id={`${formId}-espec`} rows={3} className={textareaCls} value={values.especificaciones} maxLength={LIMITES.especificaciones} onChange={(e) => set('especificaciones', e.target.value)} />
          </Field>
        </section>

        <section className="space-y-3.5" aria-labelledby={`${formId}-control`}>
          <span id={`${formId}-control`}><SectionLabel>Control y cantidad</SectionLabel></span>
          {isCreate ? (
            <div role="radiogroup" aria-label="Tipo de control" className="flex">
              {TIPOS_CONTROL.map((tipo, index) => {
                const on = values.tipoControl === tipo.value;
                return (
                  <button
                    key={tipo.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set('tipoControl', tipo.value)}
                    className={`h-10 flex-1 border text-sm font-semibold focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] ${index === 0 ? 'rounded-l-lg' : '-ml-px rounded-r-lg'} ${on ? 'border-[#0066D2] bg-[#E3EFFC] text-[#0B4A94]' : 'border-[#AEB9C9] bg-white text-[#3A4658]'}`}
                  >
                    {tipo.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#3A4658]">
              Control: <ControlChip value={values.tipoControl} />
              <span className="text-xs text-[#566274]">(no cambia después de crear)</span>
            </div>
          )}

          {values.tipoControl === 'INDIVIDUAL' ? (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Código o etiqueta" htmlFor={`${formId}-codigo`} hint="Identifica esta unidad. Formato por definir con el equipo.">
                <input id={`${formId}-codigo`} className={inputCls} value={values.codigo} maxLength={LIMITES.codigo} onChange={(e) => set('codigo', e.target.value)} required />
              </Field>
              <Field label="Cantidad" htmlFor={`${formId}-cant`} hint="Una unidad individual siempre vale 1.">
                <input id={`${formId}-cant`} className={inputCls} value={isCreate ? '1' : base && base.cantidad === 0 ? '0 (fuera de sede)' : '1'} readOnly />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field
                label={isCreate ? 'Cantidad inicial' : 'Cantidad actual'}
                htmlFor={`${formId}-cant`}
                hint={isCreate ? 'Se registra como conteo inicial en el historial.' : undefined}
              >
                <input
                  id={`${formId}-cant`}
                  className={inputCls}
                  inputMode="decimal"
                  value={values.cantidad}
                  readOnly={!isCreate}
                  onChange={(e) => set('cantidad', e.target.value)}
                  required={isCreate}
                />
              </Field>
              <Field label="Unidad de medida" htmlFor={`${formId}-unidad`}>
                <input id={`${formId}-unidad`} className={inputCls} list={`${formId}-unidades`} value={values.unidadMedida} maxLength={LIMITES.unidad} onChange={(e) => set('unidadMedida', e.target.value)} />
                <datalist id={`${formId}-unidades`}>
                  {UNIDADES_SUGERIDAS.map((unidad) => <option key={unidad} value={unidad} />)}
                </datalist>
              </Field>
            </div>
          )}
          {!isCreate && base ? (
            <Notice tone="info">
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1">
                  <b>La cantidad y la ubicación no se editan aquí.</b> Para que el cambio quede en el historial, regístralo como movimiento
                  (un error de captura se corrige con un conteo / ajuste y su motivo).
                </p>
                {permissions.move && onMove ? (
                  <button type="button" className={`${btnCls} min-h-9 shrink-0`} onClick={() => onMove(base)}>
                    Registrar movimiento
                  </button>
                ) : null}
              </div>
            </Notice>
          ) : null}
        </section>

        <section className="space-y-3.5" aria-labelledby={`${formId}-ubic`}>
          <span id={`${formId}-ubic`}><SectionLabel>Ubicación y condición</SectionLabel></span>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Sede actual" htmlFor={`${formId}-sede`}>
              {isCreate ? (
                <select
                  id={`${formId}-sede`}
                  className={inputCls}
                  value={values.sedeId}
                  onChange={(e) => {
                    setValues((current) => ({ ...current, sedeId: e.target.value, ubicacionId: '' }));
                    setNewLocation(null);
                  }}
                >
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              ) : (
                <input id={`${formId}-sede`} className={inputCls} value={base?.sede_nombre ?? ''} readOnly />
              )}
            </Field>
            <Field
              label="Ubicación interna"
              htmlFor={`${formId}-ubic-sel`}
              hint={isCreate ? `Solo ubicaciones de ${sedeName}.` : undefined}
            >
              {isCreate ? (
                <select id={`${formId}-ubic-sel`} className={inputCls} value={values.ubicacionId} onChange={(e) => set('ubicacionId', e.target.value)} required>
                  <option value="">{sedeUbicaciones.length ? 'Elige una ubicación' : 'Sin ubicaciones todavía'}</option>
                  {sedeUbicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              ) : (
                <input id={`${formId}-ubic-sel`} className={inputCls} value={base?.ubicacion_nombre ?? ''} readOnly />
              )}
            </Field>
            <Field label="Condición" htmlFor={`${formId}-cond`}>
              <select id={`${formId}-cond`} className={inputCls} value={values.condicion} onChange={(e) => set('condicion', e.target.value as InventarioCondicion)}>
                {CONDICIONES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>

          {isCreate && permissions.createLocation ? (
            newLocation === null ? (
              <button
                type="button"
                onClick={() => { setNewLocation(''); setLocationError(null); }}
                className="inline-flex items-center gap-1.5 rounded text-[13px] font-semibold text-[#0054AE] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19]"
              >
                <Plus size={15} aria-hidden="true" />
                Nueva ubicación en {sedeName}
              </button>
            ) : (
              <div className="rounded-lg border border-[#DDE3EC] bg-[#F7F9FC] p-3">
                <Field label={`Nombre de la nueva ubicación en ${sedeName}`} htmlFor={`${formId}-newloc`} error={locationError ?? undefined}>
                  <div className="flex gap-2">
                    <input
                      id={`${formId}-newloc`}
                      autoFocus
                      className={inputCls}
                      value={newLocation}
                      maxLength={LIMITES.ubicacion}
                      onChange={(e) => setNewLocation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void createLocation();
                        }
                      }}
                    />
                    <button type="button" className={`${btnPrimaryCls} shrink-0`} disabled={locationSaving || !newLocation.trim()} onClick={() => void createLocation()}>
                      {locationSaving ? <Spinner /> : null}
                      Crear
                    </button>
                    <button type="button" className={`${btnCls} shrink-0`} onClick={() => setNewLocation(null)} disabled={locationSaving}>Cancelar</button>
                  </div>
                </Field>
              </div>
            )
          ) : null}

          {isCreate ? (
            <Notice tone="info">Al guardar se registra un <b>conteo inicial</b> en el historial, con tu usuario y la fecha.</Notice>
          ) : null}
        </section>
      </form>
    </SidePanel>
  );
}
