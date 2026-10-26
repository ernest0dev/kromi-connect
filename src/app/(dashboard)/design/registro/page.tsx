import Link from 'next/link';
import { hasPermission, requirePermission } from '@/lib/auth/dal';
import { formatDesignDate } from '@/lib/designSla';
import {
  addDesignDeliverableAction,
  assignDesignRequestAction,
  createDesignRequestAction,
  transitionDesignDeliverableAction,
  transitionDesignRequestAction,
  updateDesignRequestAction,
} from '@/app/actions/design/registry';

const STATUS_LABELS: Record<string, string> = {
  HISTORICA: 'Histórica',
  ABIERTA: 'Abierta',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  HISTORICO: 'Histórico',
  PENDIENTE: 'Pendiente',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENTE: 'Urgente',
  IMPORTANTE: 'Importante',
  NORMAL: 'Normal',
};
const PAGE_SIZE = 25;
const REQUEST_FILTER_STATES = ['HISTORICA', 'ABIERTA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];

function pageHref(page: number, filters: { q: string; estado: string; origen: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.origen) params.set('origen', filters.origen);
  params.set('page', String(page));
  return `/design/registro?${params.toString()}`;
}

function statusOptions(status: string) {
  if (status === 'HISTORICA' || status === 'COMPLETADA' || status === 'CANCELADA') {
    return [{ value: 'ABIERTA', label: 'Reabrir' }];
  }
  if (status === 'ABIERTA') {
    return [
      { value: 'EN_CURSO', label: 'En curso' },
      { value: 'CANCELADA', label: 'Cancelar' },
    ];
  }
  return [
    { value: 'ABIERTA', label: 'Reabrir' },
    { value: 'COMPLETADA', label: 'Completar' },
    { value: 'CANCELADA', label: 'Cancelar' },
  ];
}

function deliverableStatusOptions(status: string) {
  if (status === 'HISTORICO' || status === 'COMPLETADO' || status === 'CANCELADO') {
    return [{ value: 'PENDIENTE', label: 'Reabrir como pendiente' }];
  }
  if (status === 'PENDIENTE') {
    return [
      { value: 'EN_CURSO', label: 'En curso' },
      { value: 'CANCELADO', label: 'Cancelar' },
    ];
  }
  return [
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'COMPLETADO', label: 'Completar' },
    { value: 'CANCELADO', label: 'Cancelar' },
  ];
}

function Field({ label, name, defaultValue, type = 'text' }: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
}) {
  return <label className="grid gap-1 text-xs font-semibold text-[#5E6680]">
    {label}
    <input name={name} type={type} defaultValue={defaultValue ?? ''} className="min-h-10 rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]" />
  </label>;
}

function SelectField({ label, name, options, defaultValue = '' }: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return <label className="grid gap-1 text-xs font-semibold text-[#5E6680]">
    {label}
    <select name={name} defaultValue={defaultValue} className="min-h-10 rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]">
      <option value="">Sin especificar</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export default async function DesignRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    created?: string;
    updated?: string;
    deliverable?: string;
    q?: string;
    estado?: string;
    origen?: string;
    page?: string;
  }>;
}) {
  const [{ supabase }, params, canAssign, canCreate, canUpdate, canChangeStatus] = await Promise.all([
    requirePermission('design.solicitudes.read'),
    searchParams,
    hasPermission('design.solicitudes.assign'),
    hasPermission('design.solicitudes.create'),
    hasPermission('design.solicitudes.update'),
    hasPermission('design.solicitudes.status.update'),
  ]);
  const query = (params.q ?? '').trim().slice(0, 100);
  const estado = REQUEST_FILTER_STATES.includes(params.estado ?? '') ? params.estado ?? '' : '';
  const origen = params.origen === 'KROMI' || params.origen === 'IMPORTACION' ? params.origen : '';
  const parsedPage = Number(params.page);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const escapedQuery = query.replace(/[\\%_]/g, '\\$&');
  let requestQuery = supabase.from('solicitudes_diseno')
    .select('id,titulo,objetivo,alcance_original,origen,solicitante_nombre_original,departamento_id,area_id,prioridad,fecha_objetivo,referencia_manual,estado,motivo_cierre,responsable_actual_id,requiere_revision,motivos_revision,version,creado_en')
    .order('creado_en', { ascending: false });
  let countQuery = supabase.from('solicitudes_diseno').select('id', { count: 'exact', head: true });
  if (estado) {
    requestQuery = requestQuery.eq('estado', estado);
    countQuery = countQuery.eq('estado', estado);
  }
  if (origen) {
    requestQuery = requestQuery.eq('origen', origen);
    countQuery = countQuery.eq('origen', origen);
  }
  if (escapedQuery) {
    requestQuery = requestQuery.ilike('titulo', `%${escapedQuery}%`);
    countQuery = countQuery.ilike('titulo', `%${escapedQuery}%`);
  }
  const [countResult, departmentsResult, areasResult, formatsResult, mediumsResult] = await Promise.all([
    countQuery,
    supabase.from('catalogo_departamentos_solicitud').select('id,nombre').eq('activo', true).order('orden'),
    supabase.from('catalogo_areas_solicitud').select('id,nombre').eq('activo', true).order('orden'),
    supabase.from('catalogo_formatos_entregable').select('id,nombre,categoria').eq('activo', true).order('orden'),
    supabase.from('catalogo_medios').select('id,nombre').eq('activo', true).order('orden'),
  ]);
  if (countResult.error) throw new Error(`No se pudo contar el registro de Diseño: ${countResult.error.message}`);
  const totalCount = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const requestsPageResult = await requestQuery.range(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE - 1,
  );
  if (requestsPageResult.error) throw new Error(`No se pudieron cargar las solicitudes de Diseño: ${requestsPageResult.error.message}`);
  if (departmentsResult.error || areasResult.error || formatsResult.error || mediumsResult.error) {
    throw new Error('No se pudieron cargar los catálogos para el registro de Diseño.');
  }

  const requests = requestsPageResult.data ?? [];
  const ids = requests.map((request) => request.id);
  const [deliverablesResult, historyResult, originalsResult, assigneesResult] = await Promise.all([
    ids.length
      ? supabase.from('solicitud_diseno_entregables')
        .select('id,solicitud_id,orden,pieza,categoria,formato_original,medio_original,cantidad_piezas,cantidad_formatos,alcance_texto,material,medidas,fecha_objetivo,estado,version')
        .in('solicitud_id', ids)
        .order('orden')
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from('solicitud_diseno_historial')
        .select('id,solicitud_id,tipo,anterior,nuevo,motivo,cambiado_en')
        .in('solicitud_id', ids)
        .order('cambiado_en', { ascending: false })
        .limit(500)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from('solicitud_diseno_importacion_filas')
        .select('solicitud_id,datos_originales')
        .in('solicitud_id', ids)
      : Promise.resolve({ data: [], error: null }),
    canAssign
      ? supabase.rpc('list_solicitud_diseno_responsables')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (deliverablesResult.error || historyResult.error || originalsResult.error || assigneesResult.error) {
    throw new Error('No se pudieron cargar los detalles de las solicitudes de Diseño.');
  }

  const deliverables = deliverablesResult.data ?? [];
  const history = historyResult.data ?? [];
  const originals = originalsResult.data ?? [];
  const assignees = assigneesResult.data ?? [];
  const deliverablesByRequest = new Map<string, typeof deliverables>();
  const historyByRequest = new Map<string, typeof history>();
  const originalsByRequest = new Map<string, (typeof originals)[number]['datos_originales']>();
  for (const deliverable of deliverables) {
    const current = deliverablesByRequest.get(deliverable.solicitud_id) ?? [];
    current.push(deliverable);
    deliverablesByRequest.set(deliverable.solicitud_id, current);
  }
  for (const event of history) {
    const current = historyByRequest.get(event.solicitud_id) ?? [];
    current.push(event);
    historyByRequest.set(event.solicitud_id, current);
  }
  for (const original of originals) {
    if (original.solicitud_id) originalsByRequest.set(original.solicitud_id, original.datos_originales);
  }

  const errorMessage = params.error?.slice(0, 240);
  const successMessage = params.created ? 'La solicitud se creó.' :
    params.updated ? 'Los cambios se guardaron.' :
      params.deliverable ? 'El entregable se agregó.' : null;
  const departments = departmentsResult.data ?? [];
  const areas = areasResult.data ?? [];
  const formats = formatsResult.data ?? [];
  const mediums = mediumsResult.data ?? [];

  return <main className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 text-[#10233F] sm:px-6 sm:py-8">
    <header>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0066D2]">Diseño</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight">Registro</h1>
      <p className="mt-1 max-w-2xl text-sm text-[#5E6680]">Solicitudes manuales e históricas, en un registro independiente de la cola de trabajo.</p>
    </header>

    {errorMessage && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</p>}
    {successMessage && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">{successMessage}</p>}

    {canCreate && <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-6">
      <h2 className="text-lg font-bold">Crear solicitud</h2>
      <p className="mt-1 text-sm text-[#5E6680]">El alta manual no depende de la importación histórica.</p>
      <form action={createDesignRequestAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Título *" name="titulo" />
        <Field label="Nombre del solicitante" name="solicitante_nombre_original" />
        <label className="grid gap-1 text-xs font-semibold text-[#5E6680] sm:col-span-2">
          Objetivo o instrucciones
          <textarea name="objetivo" rows={3} className="rounded-lg border border-[#D8D6CF] bg-white px-3 py-2 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]" />
        </label>
        <SelectField label="Departamento" name="departamento_id" options={departments.map((item) => ({ value: item.id, label: item.nombre }))} />
        <SelectField label="Área" name="area_id" options={areas.map((item) => ({ value: item.id, label: item.nombre }))} />
        <SelectField label="Prioridad" name="prioridad" options={[
          { value: 'URGENTE', label: 'Urgente' },
          { value: 'IMPORTANTE', label: 'Importante' },
          { value: 'NORMAL', label: 'Normal' },
        ]} />
        <Field label="Fecha objetivo" name="fecha_objetivo" type="date" />
        <Field label="Referencia manual (publicación u otra)" name="referencia_manual" />
        <label className="grid gap-1 text-xs font-semibold text-[#5E6680] sm:col-span-2">
          Alcance
          <textarea name="alcance_original" rows={2} className="rounded-lg border border-[#D8D6CF] bg-white px-3 py-2 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]" />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="min-h-10 rounded-lg bg-[#0066D2] px-4 text-sm font-bold text-white hover:bg-[#0057B8]">Crear solicitud</button>
        </div>
      </form>
    </section>}

    <section className="space-y-3">
      <form method="get" action="/design/registro" className="grid gap-3 rounded-xl border border-[#E7E4DC] bg-white p-4 sm:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto] sm:items-end">
        <Field label="Buscar por título" name="q" defaultValue={query} />
        <SelectField label="Estado" name="estado" defaultValue={estado} options={REQUEST_FILTER_STATES.map((value) => ({ value, label: STATUS_LABELS[value] }))} />
        <SelectField label="Origen" name="origen" defaultValue={origen} options={[
          { value: 'KROMI', label: 'Manual' },
          { value: 'IMPORTACION', label: 'Importada' },
        ]} />
        <div className="flex gap-2">
          <button type="submit" className="min-h-10 rounded-lg bg-[#0066D2] px-4 text-sm font-bold text-white hover:bg-[#0057B8]">Filtrar</button>
          <Link href="/design/registro" className="inline-flex min-h-10 items-center rounded-lg border border-[#D8D6CF] px-3 text-sm font-semibold">Limpiar</Link>
        </div>
      </form>
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold">Solicitudes</h2><p className="text-sm text-[#5E6680]">Mostrando {requests.length} de {totalCount}. El detalle importado incluye las 22 respuestas originales del formulario.</p></div>
        <span className="rounded-full bg-[#E6F0FB] px-3 py-1 text-xs font-bold text-[#002F80]">{totalCount}</span>
      </div>
      {requests.length === 0 ? <p className="rounded-xl border border-dashed border-[#D8D6CF] bg-white p-6 text-sm text-[#5E6680]">Aún no hay solicitudes registradas.</p> :
        requests.map((request) => {
          const requestDeliverables = deliverablesByRequest.get(request.id) ?? [];
          const requestHistory = historyByRequest.get(request.id) ?? [];
          const requestOriginal = originalsByRequest.get(request.id);
          const requestOptions = statusOptions(request.estado);
          const editable = canUpdate && request.origen === 'KROMI';
          return <details key={request.id} className="group rounded-xl border border-[#E7E4DC] bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold">{request.titulo}</h3>
                  <span className="rounded-full bg-[#F1F0EC] px-2 py-0.5 text-[11px] font-semibold">{request.origen === 'KROMI' ? 'Manual' : 'Importada'}</span>
                  {request.requiere_revision && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Revisión</span>}
                </div>
                <p className="mt-1 text-xs text-[#5E6680]">
                  {STATUS_LABELS[request.estado] ?? request.estado}
                  {request.prioridad ? ` · ${PRIORITY_LABELS[request.prioridad] ?? request.prioridad}` : ''}
                  {request.fecha_objetivo ? ` · Entrega ${formatDesignDate(request.fecha_objetivo, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  {` · ${formatDesignDate(request.creado_en, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <span aria-hidden="true" className="text-lg text-[#5E6680] group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-5 border-t border-[#E7E4DC] p-4 sm:p-5">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-[#5E6680]">Solicitante</dt><dd>{request.solicitante_nombre_original || 'Sin especificar'}</dd></div>
                <div><dt className="text-xs font-semibold text-[#5E6680]">Objetivo</dt><dd className="whitespace-pre-wrap">{request.objetivo || 'Sin especificar'}</dd></div>
                {request.alcance_original && <div><dt className="text-xs font-semibold text-[#5E6680]">Alcance original</dt><dd className="whitespace-pre-wrap">{request.alcance_original}</dd></div>}
                {request.motivo_cierre && <div><dt className="text-xs font-semibold text-[#5E6680]">Motivo de cierre</dt><dd>{request.motivo_cierre}</dd></div>}
              </dl>

              {requestOriginal && <details className="rounded-lg border border-[#E7E4DC] bg-[#FAF8F4] p-3">
                <summary className="cursor-pointer text-sm font-semibold">Datos originales de la hoja (incluye el correo del remitente)</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(requestOriginal, null, 2)}</pre>
              </details>}

              {editable && <form action={updateDesignRequestAction} className="grid gap-3 rounded-xl bg-[#FAF8F4] p-4 sm:grid-cols-2">
                <input type="hidden" name="solicitud_id" value={request.id} />
                <input type="hidden" name="version" value={request.version} />
                <Field label="Editar título" name="titulo" defaultValue={request.titulo} />
                <SelectField label="Prioridad" name="prioridad" defaultValue={request.prioridad ?? ''} options={[
                  { value: 'URGENTE', label: 'Urgente' }, { value: 'IMPORTANTE', label: 'Importante' }, { value: 'NORMAL', label: 'Normal' },
                ]} />
                <Field label="Fecha objetivo" name="fecha_objetivo" type="date" defaultValue={request.fecha_objetivo} />
                <Field label="Referencia manual" name="referencia_manual" defaultValue={request.referencia_manual} />
                <label className="grid gap-1 text-xs font-semibold text-[#5E6680] sm:col-span-2">
                  Objetivo o instrucciones
                  <textarea name="objetivo" defaultValue={request.objetivo ?? ''} rows={2} className="rounded-lg border border-[#D8D6CF] bg-white px-3 py-2 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#5E6680] sm:col-span-2">
                  Alcance
                  <textarea name="alcance_original" defaultValue={request.alcance_original ?? ''} rows={2} className="rounded-lg border border-[#D8D6CF] bg-white px-3 py-2 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]" />
                </label>
                <button type="submit" className="min-h-9 w-fit rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-semibold">Guardar cambios</button>
              </form>}

              {canAssign && editable && request.estado !== 'HISTORICA' && <form action={assignDesignRequestAction} className="flex flex-wrap items-end gap-3 rounded-xl bg-[#FAF8F4] p-4">
                <input type="hidden" name="solicitud_id" value={request.id} />
                <input type="hidden" name="version" value={request.version} />
                <SelectField label="Responsable de Diseño" name="responsable_id" defaultValue={request.responsable_actual_id ?? ''} options={assignees.map((person) => ({ value: person.user_id, label: person.full_name ?? 'Diseñador sin nombre' }))} />
                <button type="submit" className="min-h-10 rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-semibold">Asignar</button>
              </form>}

              {canChangeStatus && requestOptions.length > 0 && <form action={transitionDesignRequestAction} className="flex flex-wrap items-end gap-3 rounded-xl bg-[#FAF8F4] p-4">
                <input type="hidden" name="solicitud_id" value={request.id} />
                <input type="hidden" name="version" value={request.version} />
                <SelectField label="Cambiar estado" name="estado" options={requestOptions} />
                <Field label="Motivo (requerido para cerrar o reabrir)" name="motivo" />
                <button type="submit" className="min-h-10 rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-semibold">Aplicar</button>
              </form>}

              <section>
                <h4 className="font-bold">Entregables ({requestDeliverables.length})</h4>
                {requestDeliverables.length === 0 ? <p className="mt-1 text-sm text-[#5E6680]">Sin entregables desglosados.</p> :
                  <ul className="mt-2 divide-y divide-[#E7E4DC] rounded-lg border border-[#E7E4DC]">
                    {requestDeliverables.map((deliverable) => <li key={deliverable.id} className="space-y-3 p-3">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-semibold">{deliverable.orden}. {deliverable.pieza}</p>
                        <span className="rounded-full bg-[#F1F0EC] px-2 py-0.5 text-xs">{STATUS_LABELS[deliverable.estado] ?? deliverable.estado}</span>
                      </div>
                      <p className="text-sm text-[#5E6680]">
                        {[deliverable.categoria, deliverable.formato_original, deliverable.medio_original,
                          deliverable.cantidad_piezas ? `${deliverable.cantidad_piezas} piezas` : null,
                          deliverable.fecha_objetivo ? `Entrega ${formatDesignDate(deliverable.fecha_objetivo)}` : null,
                        ].filter(Boolean).join(' · ') || 'Sin especificaciones adicionales'}
                      </p>
                      {deliverable.alcance_texto && <p className="whitespace-pre-wrap text-sm">{deliverable.alcance_texto}</p>}
                      {canChangeStatus && editable && <form action={transitionDesignDeliverableAction} className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="entregable_id" value={deliverable.id} />
                        <input type="hidden" name="version" value={deliverable.version} />
                        <SelectField label="Estado del entregable" name="estado" options={deliverableStatusOptions(deliverable.estado)} />
                        <Field label="Motivo (si se cancela o reabre)" name="motivo" />
                        <button type="submit" className="min-h-9 rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-semibold">Actualizar</button>
                      </form>}
                    </li>)}
                  </ul>}
              </section>

              {editable && request.estado !== 'COMPLETADA' && request.estado !== 'CANCELADA' && request.estado !== 'HISTORICA' &&
                <form action={addDesignDeliverableAction} className="grid gap-3 rounded-xl bg-[#FAF8F4] p-4 sm:grid-cols-2">
                  <input type="hidden" name="solicitud_id" value={request.id} />
                  <h4 className="font-bold sm:col-span-2">Agregar entregable</h4>
                  <Field label="Pieza *" name="pieza" defaultValue={request.titulo} />
                  <SelectField label="Categoría" name="categoria" options={[{ value: 'DIGITAL', label: 'Digital' }, { value: 'IMPRESO', label: 'Impreso' }]} />
                  <SelectField label="Formato" name="formato_id" options={formats.map((item) => ({ value: item.id, label: `${item.nombre} (${item.categoria.toLowerCase()})` }))} />
                  <SelectField label="Medio" name="medio_id" options={mediums.map((item) => ({ value: item.id, label: item.nombre }))} />
                  <Field label="Formato original" name="formato_original" />
                  <Field label="Medio original" name="medio_original" />
                  <Field label="Cantidad de piezas" name="cantidad_piezas" type="number" />
                  <Field label="Cantidad de formatos" name="cantidad_formatos" type="number" />
                  <Field label="Fecha objetivo" name="fecha_objetivo" type="date" />
                  <Field label="Material" name="material" />
                  <Field label="Medidas" name="medidas" />
                  <label className="grid gap-1 text-xs font-semibold text-[#5E6680] sm:col-span-2">
                    Alcance textual
                    <textarea name="alcance_texto" rows={2} className="rounded-lg border border-[#D8D6CF] bg-white px-3 py-2 text-sm font-normal text-[#10233F] outline-none focus:border-[#0066D2]" />
                  </label>
                  <button type="submit" className="min-h-9 w-fit rounded-lg border border-[#D8D6CF] bg-white px-3 text-sm font-semibold">Agregar entregable</button>
                </form>}

              <section>
                <h4 className="font-bold">Actividad reciente</h4>
                {requestHistory.length === 0 ? <p className="mt-1 text-sm text-[#5E6680]">Sin actividad registrada.</p> :
                  <ol className="mt-2 space-y-2">
                    {requestHistory.slice(0, 8).map((event) => <li key={event.id} className="border-l-2 border-[#D8D6CF] pl-3 text-sm">
                      <span className="font-semibold">{event.tipo}</span>
                      <span className="ml-2 text-xs text-[#5E6680]">{formatDesignDate(event.cambiado_en, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {event.motivo && <p className="text-[#5E6680]">{event.motivo}</p>}
                    </li>)}
                  </ol>}
              </section>
            </div>
          </details>;
        })}
      {totalCount > 0 && <nav aria-label="Paginación del registro" className="flex items-center justify-between rounded-xl border border-[#E7E4DC] bg-white px-4 py-3 text-sm">
        {currentPage > 1
          ? <Link href={pageHref(currentPage - 1, { q: query, estado, origen })} className="font-semibold text-[#0066D2]">Anterior</Link>
          : <span aria-disabled="true" className="text-[#8A8F9C]">Anterior</span>}
        <span className="text-[#5E6680]">Página {currentPage} de {totalPages}</span>
        {currentPage < totalPages
          ? <Link href={pageHref(currentPage + 1, { q: query, estado, origen })} className="font-semibold text-[#0066D2]">Siguiente</Link>
          : <span aria-disabled="true" className="text-[#8A8F9C]">Siguiente</span>}
      </nav>}
    </section>
  </main>;
}
