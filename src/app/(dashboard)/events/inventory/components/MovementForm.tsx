'use client';

import { useId, useMemo, useState } from 'react';
import { registerInventoryMovementAction } from '@/app/actions/inventory/inventory';
import { MOVIMIENTOS_REGISTRABLES, LIMITES, formatQty, parseQuantity } from '@/lib/inventory';
import type { InventarioArticuloRow, InventarioMovimientoRegistrable, InventarioSede, InventarioUbicacion } from '@/types';
import { Field, Notice, SectionLabel, SidePanel, Spinner, btnCls, btnPrimaryCls, inputCls, textareaCls } from './ui';

type Props = {
  item: InventarioArticuloRow;
  sedes: InventarioSede[];
  ubicaciones: InventarioUbicacion[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Valor para <input type="datetime-local"> en la hora local del navegador. */
function nowLocalInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function availability(item: InventarioArticuloRow, tipo: InventarioMovimientoRegistrable): string | null {
  const individual = item.tipo_control === 'INDIVIDUAL';
  if (tipo === 'TRASLADO' || tipo === 'SALIDA') {
    if (item.cantidad === 0) return individual ? 'Esta unidad está fuera de la sede.' : 'No hay existencias para mover.';
  }
  if (tipo === 'RETORNO' && individual && item.cantidad !== 0) return 'Esta unidad ya está en la sede; no tiene un retorno pendiente.';
  return null;
}

export function MovementForm({ item: initialItem, sedes, ubicaciones, onClose, onSaved }: Props) {
  const formId = useId();
  const [item, setItem] = useState(initialItem);
  const individual = item.tipo_control === 'INDIVIDUAL';
  const firstAvailable = MOVIMIENTOS_REGISTRABLES.find((m) => availability(initialItem, m.value) === null)?.value ?? 'AJUSTE';

  const [tipo, setTipo] = useState<InventarioMovimientoRegistrable>(firstAvailable);
  const [cantidad, setCantidad] = useState(individual && firstAvailable !== 'AJUSTE' ? '1' : '');
  const [destino, setDestino] = useState('');
  const [externo, setExterno] = useState('');
  const [fecha, setFecha] = useState(nowLocalInput);
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(false);

  const destinos = useMemo(
    () =>
      sedes
        .map((sede) => ({
          sede,
          ubicaciones: ubicaciones
            .filter((u) => u.sede_id === sede.id && (tipo !== 'TRASLADO' || u.id !== item.ubicacion_id))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        }))
        .filter((group) => group.ubicaciones.length > 0),
    [sedes, ubicaciones, tipo, item.ubicacion_id],
  );

  const q = parseQuantity(cantidad);
  let resultado: string | null = null;
  if (q !== null) {
    if (tipo === 'TRASLADO' || tipo === 'SALIDA') {
      if (q <= item.cantidad && !individual) resultado = `${item.ubicacion_nombre}: ${formatQty(item.cantidad)} → ${formatQty(item.cantidad - q)} ${item.unidad_medida}`;
    } else if (tipo === 'RETORNO' && (destino === '' || destino === item.ubicacion_id) && !individual) {
      resultado = `${item.ubicacion_nombre}: ${formatQty(item.cantidad)} → ${formatQty(item.cantidad + q)} ${item.unidad_medida}`;
    } else if (tipo === 'AJUSTE' && q !== item.cantidad) {
      const diff = q - item.cantidad;
      resultado = `${item.ubicacion_nombre}: ${formatQty(item.cantidad)} → ${formatQty(q)} ${item.unidad_medida} (${diff > 0 ? '+' : '−'}${formatQty(Math.abs(diff))})`;
    }
  }

  function chooseTipo(next: InventarioMovimientoRegistrable) {
    setTipo(next);
    setError(null);
    setDestino('');
    setExterno('');
    setCantidad(individual && next !== 'AJUSTE' ? '1' : '');
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const result = await registerInventoryMovementAction({
        articuloId: item.id,
        tipo,
        cantidad,
        expectedVersion: item.version,
        destinoUbicacionId: destino || undefined,
        externo,
        fechaHora: fecha || undefined,
        observacion,
      });
      if (result.success) {
        onSaved('Movimiento registrado.');
        return;
      }
      if (result.code === 'CONFLICTO_VERSION' && result.current) {
        setItem(result.current);
        setRefreshed(true);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError('No se pudo registrar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const isAjuste = tipo === 'AJUSTE';
  const showDestino = tipo === 'TRASLADO' || tipo === 'RETORNO';

  return (
    <SidePanel
      title="Registrar movimiento"
      subtitle={`${item.nombre} · ${item.sede_nombre} · ${item.ubicacion_nombre}`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-[#566274]">Se registrará con tu usuario y estado <b className="text-[#0B6B40]">Completado</b>.</p>
          <div className="flex gap-2.5">
            <button type="button" className={btnCls} onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" form={formId} className={btnPrimaryCls} disabled={saving} aria-busy={saving}>
              {saving ? (<><Spinner />Guardando…</>) : 'Registrar movimiento'}
            </button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
        {refreshed ? (
          <Notice tone="warning" role="alert">
            Otra persona cambió este artículo mientras registrabas el movimiento. Ahora tiene <b>{formatQty(item.cantidad)} {item.unidad_medida}</b> en {item.sede_nombre} · {item.ubicacion_nombre}. Revisa los valores y vuelve a registrar.
          </Notice>
        ) : null}

        <div className="space-y-2.5">
          <SectionLabel>Tipo de movimiento</SectionLabel>
          <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2.5">
            {MOVIMIENTOS_REGISTRABLES.map((m) => {
              const blocked = availability(item, m.value);
              const on = tipo === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={blocked !== null}
                  title={blocked ?? undefined}
                  onClick={() => chooseTipo(m.value)}
                  className={`flex flex-col gap-0.5 rounded-[10px] border px-3 py-2.5 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-[#0066D2] bg-[#E3EFFC] shadow-[inset_0_0_0_1px_#0066D2]' : 'border-[#AEB9C9] bg-white'}`}
                >
                  {m.label}
                  <span className="text-xs font-normal text-[#566274]">{blocked ?? m.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label={isAjuste ? 'Cantidad contada' : 'Cantidad'}
            htmlFor={`${formId}-cant`}
            hint={
              isAjuste
                ? `Registrada: ${formatQty(item.cantidad)} ${item.unidad_medida}`
                : tipo === 'RETORNO'
                  ? individual ? 'Una unidad individual vuelve completa.' : undefined
                  : `Disponible en el origen: ${formatQty(item.cantidad)} ${item.unidad_medida}`
            }
          >
            <input
              id={`${formId}-cant`}
              className={inputCls}
              inputMode="decimal"
              value={cantidad}
              readOnly={individual && !isAjuste}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </Field>
          <Field label="Fecha y hora" htmlFor={`${formId}-fecha`} hint="Por defecto, ahora. Puedes indicar cuándo ocurrió.">
            <input id={`${formId}-fecha`} type="datetime-local" className={inputCls} value={fecha} max={nowLocalInput()} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>

        {tipo !== 'RETORNO' ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Origen" htmlFor={`${formId}-origen`}>
              <input id={`${formId}-origen`} className={inputCls} value={`${item.sede_nombre} · ${item.ubicacion_nombre}`} readOnly />
            </Field>
            {showDestino ? (
              <Field label="Destino" htmlFor={`${formId}-destino`}>
                <select id={`${formId}-destino`} className={inputCls} value={destino} onChange={(e) => setDestino(e.target.value)} required>
                  <option value="">Elige el destino</option>
                  {destinos.map((group) => (
                    <optgroup key={group.sede.id} label={group.sede.nombre}>
                      {group.ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
            ) : null}
            {tipo === 'SALIDA' ? (
              <Field label="Destino fuera de las sedes (opcional)" htmlFor={`${formId}-ext`}>
                <input id={`${formId}-ext`} className={inputCls} value={externo} maxLength={LIMITES.externo} placeholder="Ej.: Evento externo" onChange={(e) => setExterno(e.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Regresa de (opcional)" htmlFor={`${formId}-ext`}>
              <input id={`${formId}-ext`} className={inputCls} value={externo} maxLength={LIMITES.externo} placeholder="Ej.: Evento externo" onChange={(e) => setExterno(e.target.value)} />
            </Field>
            <Field label="Vuelve a" htmlFor={`${formId}-destino`} hint="Si lo dejas igual, se suma en la ubicación actual.">
              <select id={`${formId}-destino`} className={inputCls} value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Misma ubicación ({item.ubicacion_nombre})</option>
                {destinos.map((group) => (
                  <optgroup key={group.sede.id} label={group.sede.nombre}>
                    {group.ubicaciones.filter((u) => u.id !== item.ubicacion_id).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label={isAjuste ? 'Motivo del ajuste' : 'Observación (opcional)'} htmlFor={`${formId}-obs`} hint={isAjuste ? 'Obligatorio: queda en el historial junto a tu usuario.' : undefined}>
          <textarea id={`${formId}-obs`} rows={3} className={textareaCls} value={observacion} maxLength={LIMITES.observacion} onChange={(e) => setObservacion(e.target.value)} required={isAjuste} />
        </Field>

        {resultado ? (
          <div className="rounded-[10px] border border-[#DDE3EC] bg-[#F3F6FB] px-3.5 py-3 text-[13px] leading-relaxed">
            <SectionLabel>Resultado al guardar</SectionLabel>
            <p className="mt-1 font-semibold text-[#10233F]">{resultado}</p>
            {tipo === 'TRASLADO' && !individual ? <p className="text-[#566274]">La cantidad se suma en el destino elegido.</p> : null}
          </div>
        ) : null}
      </form>
    </SidePanel>
  );
}
