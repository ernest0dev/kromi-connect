'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createStoreTasksAction, getStoreTaskDetailAction, transitionStoreTaskAction, updateStoreTaskAction } from '@/app/actions/internal/tasks';
import { requestInternalDesignCorrectionAction } from '@/app/actions/internal/design-work';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS, getDesignDates, getUrgency, type InternalStore, type StoreTaskRow } from '@/lib/internalTasks';
import { TaskBriefPanel } from './TaskBriefPanel';
import { TaskHistoryPanel } from './TaskHistoryPanel';

type Props = { stores: InternalStore[]; task?: StoreTaskRow; initialStoreId?: string; duplicate?: boolean; onClose: () => void };
const TASK_DESIGN_STATUS_LABEL: Record<string, string> = { SOLICITADO: 'Solicitado', EN_DISENO: 'En diseño', EN_CORRECCION: 'Con correcciones', ENTREGADO: 'Entregado' };

export function TaskDrawer({ stores, task: initialTask, initialStoreId, duplicate = false, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState(initialTask ? duplicate ? 'create' : 'detail' : 'create');
  const [taskType, setTaskType] = useState<string>(initialTask && !['IMPRESION', 'SONIDO_INTERNO', 'REPARACION', 'OTRO'].includes(initialTask.tipo) ? duplicate ? 'OTRO' : initialTask.tipo : initialTask?.tipo ?? 'IMPRESION');
  const [requiresDesign, setRequiresDesign] = useState(initialTask?.requiere_diseno ?? true);
  const [selectedStores, setSelectedStores] = useState<string[]>(initialTask ? [initialTask.sede_id] : initialStoreId ? [initialStoreId] : []);
  const [requiredDate, setRequiredDate] = useState(initialTask?.fecha_requerida ?? '');
  const [createdTask, setCreatedTask] = useState<StoreTaskRow | null>(null);
  const [designRequestedAt, setDesignRequestedAt] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState('');
  const [busy, startTransition] = useTransition();
  const task = createdTask ?? initialTask;
  const taskId = task?.id;
  const taskRequiresDesign = task?.requiere_diseno;

  useEffect(() => {
    if (!taskId || mode !== 'detail' || !taskRequiresDesign) return;
    let active = true;
    void getStoreTaskDetailAction(taskId).then((result) => {
      if (active && result.success) setDesignRequestedAt(result.data.diseno_solicitado_en ?? null);
    });
    return () => { active = false; };
  }, [taskId, taskRequiresDesign, mode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function save(formData: FormData) {
    setError('');
    if (task && mode === 'edit') {
      const result = await updateStoreTaskAction({ id: task.id, version: task.version,
        tipo: String(formData.get('tipo') ?? ''), titulo: String(formData.get('titulo') ?? ''),
        detalle: String(formData.get('detalle') ?? ''), cantidad: String(formData.get('cantidad') ?? ''),
        fechaRequerida: String(formData.get('fecha') ?? ''),
        requiereDiseno: formData.get('requiereDiseno') === 'on',
        instruccionesDiseno: String(formData.get('instruccionesDiseno') ?? ''), fechaEntregaDiseno: formData.get('requiereDiseno') === 'on' ? getDesignDates(String(formData.get('fecha') ?? '') || null).designDueDate ?? '' : '',
      });
      if (!result.success) { setError(result.error); return; }
      setMode('detail'); startTransition(() => router.refresh()); return;
    }
    const result = await createStoreTasksAction({
      tipo: String(formData.get('tipo') ?? ''), titulo: String(formData.get('titulo') ?? ''),
      detalle: String(formData.get('detalle') ?? ''), cantidad: String(formData.get('cantidad') ?? ''),
      fechaRequerida: String(formData.get('fecha') ?? ''),
      sedeIds: selectedStores, requiereDiseno: formData.get('requiereDiseno') === 'on',
      instruccionesDiseno: String(formData.get('instruccionesDiseno') ?? ''), fechaEntregaDiseno: formData.get('requiereDiseno') === 'on' ? getDesignDates(String(formData.get('fecha') ?? '') || null).designDueDate ?? '' : '',
    });
    if (!result.success) { setError(result.error); return; }
    const firstId = result.createdIds[0];
    const detail = firstId ? await getStoreTaskDetailAction(firstId) : null;
    if (detail?.success) {
      setCreatedTask(detail.data as unknown as StoreTaskRow);
      setCreatedCount(result.createdIds.length);
      setMode('detail');
      startTransition(() => router.refresh());
    } else { onClose(); startTransition(() => router.refresh()); }
  }

  async function updateStatus(status: string) {
    if (!task) return;
    setError('');
    let reason = '';
    if (status === 'CANCELADO' || status === 'PENDIENTE' || task.estatus === 'ENTREGADO') {
      const answer = window.prompt('Indica el motivo para cambiar el estado:');
      if (answer === null) return;
      reason = answer.trim();
      if (!reason) { setError('El motivo es obligatorio.'); return; }
    }
    const result = await transitionStoreTaskAction({ id: task.id, version: task.version, status, reason });
    if (!result.success) { setError(result.error); return; }
    startTransition(() => router.refresh()); onClose();
  }

  const title = mode === 'create' ? 'Nuevo pendiente' : mode === 'edit' ? 'Editar pendiente' : 'Detalle del pendiente';
  const urgency = task ? getUrgency(task.fecha_requerida) : 'sin_fecha';
  return <div className="fixed inset-0 z-50 flex justify-end bg-[#10233F]/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="task-drawer-title" className="flex h-full w-full max-w-[600px] flex-col border-l border-[#dce2ea] bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#0066D2]">Pendientes</p><h2 id="task-drawer-title" className="mt-1 text-xl font-extrabold text-[#10233F]">{title}</h2>{task && mode !== 'create' && <p className="mt-1 text-sm text-slate-500">{task.titulo} · {task.sede_nombre}</p>}</div>
        <button type="button" aria-label="Cerrar panel" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-lg text-slate-600 hover:bg-slate-50">×</button>
      </header>

      {mode === 'detail' && task ? <>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {createdCount > 1 && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Se crearon {createdCount} pendientes, uno por tienda. Este panel muestra el primero; cierra el panel para abrir los demás.</p>}
          <div className="flex flex-wrap gap-2"><Badge>{TASK_TYPE_LABELS[task.tipo]}</Badge><Badge>{TASK_STATUS_LABELS[task.estatus]}</Badge><Badge tone={urgency === 'vencido' ? 'red' : urgency === 'proximo' ? 'amber' : 'slate'}>{urgency === 'vencido' ? 'Vencido' : urgency === 'proximo' ? 'Próximo a vencer' : task.fecha_requerida ? `Para el ${task.fecha_requerida}` : 'Sin fecha'}</Badge>{task.diseno_estatus && <Badge tone="blue">Diseño: {TASK_DESIGN_STATUS_LABEL[task.diseno_estatus] ?? task.diseno_estatus}</Badge>}</div>
          <h3 className="text-lg font-bold text-[#10233F]">{task.titulo}</h3>
          <div className="grid grid-cols-2 gap-3"><Info label="Fecha requerida en tienda" value={task.fecha_requerida ?? 'Sin fecha'} />{task.requiere_diseno && <Info label="Entrega de la pieza de diseño" value={task.fecha_entrega_diseno ?? 'Sin fecha'} />}{task.cantidad && <Info label="Cantidad" value={String(task.cantidad)} />}</div>
          {(task.detalle || task.enlace_referencia) && <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold">Detalle</h3>{task.detalle && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{task.detalle}</p>}{task.enlace_referencia && <a className="mt-3 inline-block text-sm font-semibold text-[#0066D2] underline" href={task.enlace_referencia} target="_blank" rel="noreferrer">Abrir referencia anterior</a>}</section>}
          {task.requiere_diseno && <section className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Solicitud a Design</h3><Badge tone="blue">{task.diseno_estatus ? TASK_DESIGN_STATUS_LABEL[task.diseno_estatus] ?? task.diseno_estatus : 'Por solicitar'}</Badge></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><Step label="Solicitado" active={Boolean(task.diseno_estatus)} /><Step label="En diseño" active={['EN_DISENO', 'EN_CORRECCION', 'ENTREGADO'].includes(task.diseno_estatus ?? '')} /><Step label="Entregado" active={['EN_CORRECCION', 'ENTREGADO'].includes(task.diseno_estatus ?? '')} /></div>{task.instrucciones_diseno && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{task.instrucciones_diseno}</p>}{designRequestedAt && <p className="mt-3 text-xs font-semibold text-slate-600">Entrega estimada de Design: {getDesignDates(null, designRequestedAt).estimatedDelivery} (dos días calendario desde la solicitud).</p>}{task.diseno_estatus === 'ENTREGADO' && <p className="mt-3 text-xs text-slate-500">Los archivos entregables se consultan desde la carpeta de Drive.</p>}</section>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <TaskBriefPanel task={task} onChange={() => startTransition(() => router.refresh())} />
          {task.requiere_diseno && task.diseno_estatus === 'ENTREGADO' && !['CANCELADO', 'ENTREGADO'].includes(task.estatus) && !task.archivado_en && <section className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><label className="block text-xs font-semibold text-amber-950">Solicitar corrección a Design<textarea maxLength={500} rows={3} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm" placeholder="Describe los cambios necesarios."/></label><button type="button" disabled={busy || !correctionReason.trim()} onClick={() => startTransition(async () => { const result = await requestInternalDesignCorrectionAction(task.id, correctionReason); if (!result.success) { setError(result.error); return; } setCorrectionReason(''); setMode('detail'); router.refresh(); })} className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Pedir corrección</button></section>}
          <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold">Historial</h3><TaskHistoryPanel taskId={task.id} /></section>
        </div>
        <footer className="flex shrink-0 flex-wrap gap-2 border-t border-slate-200 bg-white p-4 sm:px-6">
          {['ENTREGADO', 'CANCELADO'].includes(task.estatus) && <button type="button" onClick={() => { setMode('create'); setError(''); }} className="rounded-lg bg-[#0066D2] px-3 py-2 text-sm font-semibold text-white">Crear nuevo pendiente con estos datos</button>}
          {task.estatus === 'PENDIENTE' && <button type="button" onClick={() => void updateStatus('EN_PROCESO')} className="rounded-lg bg-[#073b78] px-3 py-2 text-sm font-semibold text-white">Marcar en proceso</button>}
          {task.estatus === 'EN_PROCESO' && <button type="button" onClick={() => void updateStatus('LISTO')} className="rounded-lg bg-[#073b78] px-3 py-2 text-sm font-semibold text-white">Marcar listo para entregar</button>}
          {task.estatus === 'LISTO' && <button type="button" onClick={() => void updateStatus('ENTREGADO')} className="rounded-lg bg-[#073b78] px-3 py-2 text-sm font-semibold text-white">Marcar entregado</button>}
          {!['ENTREGADO', 'CANCELADO'].includes(task.estatus) && <button type="button" onClick={() => void updateStatus('CANCELADO')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Cancelar pendiente</button>}
          {task.estatus !== 'ENTREGADO' && task.estatus !== 'CANCELADO' && task.diseno_estatus !== 'SOLICITADO' && task.diseno_estatus !== 'EN_DISENO' && <button type="button" onClick={() => setMode('edit')} className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Editar</button>}
        </footer>
      </> : <form action={save} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><select name="tipo" required value={taskType} onChange={(event) => { const value = event.target.value; setTaskType(value); if (!task || mode === 'create') setRequiresDesign(value === 'IMPRESION'); }} className="field-input"><option value="IMPRESION">Impresión</option><option value="SONIDO_INTERNO">Sonido interno</option><option value="REPARACION">Reparación</option><option value="OTRO">Otro</option>{task && mode === 'edit' && !['IMPRESION', 'SONIDO_INTERNO', 'REPARACION', 'OTRO'].includes(task.tipo) && <option value={task.tipo}>{TASK_TYPE_LABELS[task.tipo]}</option>}</select></Field>
            <Field label="Título"><input name="titulo" required maxLength={160} defaultValue={task?.titulo ?? ''} className="field-input" /></Field>
          </div>
          {!task && <fieldset><legend className="mb-2 text-sm font-bold">Tiendas</legend><div className="flex flex-wrap gap-2">{stores.map((store) => { const checked = selectedStores.includes(store.id); return <label key={store.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${checked ? 'border-[#0066D2] bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}><input type="checkbox" checked={checked} onChange={() => setSelectedStores((current) => checked ? current.filter((id) => id !== store.id) : [...current, store.id])} className="accent-[#0066D2]" />{store.nombre}</label>; })}</div><p className="mt-2 text-xs text-slate-500">Se crea un pendiente por cada tienda seleccionada.</p></fieldset>}
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Cantidad (opcional)"><input name="cantidad" type="number" min="1" step="1" defaultValue={task?.cantidad ?? ''} className="field-input" /></Field><Field label="Fecha requerida en tienda"><input name="fecha" type="date" value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} className="field-input" /></Field></div>
          <Field label="Detalle"><textarea name="detalle" maxLength={2000} rows={4} defaultValue={task?.detalle ?? ''} className="field-input resize-y" /></Field>
          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <label className="flex items-start gap-3"><input name="requiereDiseno" type="checkbox" checked={requiresDesign} onChange={(event) => setRequiresDesign(event.target.checked)} className="mt-1 accent-[#0066D2]" /><span><b className="text-sm">Requiere diseño</b><span className="mt-0.5 block text-xs text-slate-500">Impresión o pieza digital que preparará el equipo de Design.</span></span></label>
            {requiresDesign && <><Field label="Instrucciones para Design"><textarea name="instruccionesDiseno" maxLength={4000} rows={4} defaultValue={task?.instrucciones_diseno ?? ''} className="field-input resize-y" /></Field><p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">La fecha de entrega de la pieza y la fecha límite para subir el brief se calculan a partir de la fecha requerida en tienda. Se reservan dos días calendario para Design y el brief vence cinco días calendario antes. La estimación final de Design es de dos días calendario desde que recibe la solicitud.</p>{requiredDate && <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2"><p>Entrega requerida a Design: {getDesignDates(requiredDate).designDueDate}</p><p>Fecha límite del brief: {getDesignDates(requiredDate).briefDeadline}</p></div>}</>}
          </section>
          {mode === 'create' && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">Al guardar se crea la carpeta de Drive. Luego podrás subir uno o varios archivos de brief desde el detalle del pendiente.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4 sm:px-6"><button type="button" onClick={() => task ? setMode('detail') : onClose()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{task && mode === 'create' ? 'Volver al detalle' : 'Cerrar'}</button><button disabled={busy} className="rounded-lg bg-[#0066D2] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Crear pendiente'}</button></footer>
      </form>}
    </section>
    <style jsx global>{`.field-input{width:100%;border:1px solid #cbd3df;border-radius:8px;background:#fff;padding:10px 12px;font-size:14px;color:#10233f}.field-input:focus{outline:2px solid #0066d2;outline-offset:1px}`}</style>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold text-[#203047]"><span>{label}</span>{children}</label>; }
function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'red' | 'amber' | 'blue' }) { const styles = { slate: 'bg-slate-100 text-slate-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800', blue: 'bg-blue-50 text-blue-800' }; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{label}</span><b className="mt-1 block text-sm text-[#10233F]">{value}</b></div>; }
function Step({ label, active }: { label: string; active: boolean }) { return <span className={`rounded-full px-2.5 py-1 font-bold ${active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>{label}</span>; }
