'use client';

import { useState } from 'react';
import { getStoreTaskDetailAction } from '@/app/actions/internal/tasks';

type HistoryRow = { id: string; tipo: string; anterior: Record<string, unknown>; nuevo: Record<string, unknown>; motivo: string | null; cambiado_por_nombre: string; cambiado_en: string };

export function TaskHistoryPanel({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true); setMessage('');
    const result = await getStoreTaskDetailAction(taskId);
    if (result.success) setRows((result.data.historial ?? []) as HistoryRow[]);
    else setMessage(result.error ?? 'No se pudo cargar el historial.');
    setBusy(false);
  }

  return <details className="mt-2 text-sm" onToggle={(event) => { const expanded = event.currentTarget.open; setOpen(expanded); if (expanded && rows.length === 0) void load(); }}>
    <summary className="cursor-pointer font-semibold text-[#0066D2]">Historial</summary>
    {busy && <p className="mt-2 text-xs text-[#566274]">Cargando historial…</p>}
    {message && <p role="alert" className="mt-2 text-xs text-red-700">{message}</p>}
    {open && !busy && !message && <ol className="mt-2 space-y-2 border-l border-[#dce2ea] pl-3">
      {rows.map((row) => <li key={row.id} className="text-xs text-[#566274]"><span className="font-semibold text-[#203047]">{row.cambiado_por_nombre || 'Sistema'}</span> · {new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' }).format(new Date(row.cambiado_en))}<div>{row.tipo === 'ESTATUS' ? `${String(row.anterior.estatus ?? '—')} → ${String(row.nuevo.estatus ?? '—')}` : row.tipo === 'DISENO' ? `Diseño: ${String(row.anterior.estatus ?? '—')} → ${String(row.nuevo.estatus ?? '—')}` : 'Datos del pendiente actualizados'}</div>{row.motivo && <div>Motivo: {row.motivo}</div>}</li>)}
      {rows.length === 0 && <li>No hay movimientos registrados.</li>}
    </ol>}
  </details>;
}
