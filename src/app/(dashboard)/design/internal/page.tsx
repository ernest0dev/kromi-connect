import Link from 'next/link';
import { requirePermission } from '@/lib/auth/dal';

export const metadata = { title: 'Pendientes del Interno · Diseño' };

export default async function InternalDesignQueuePage() {
  const { supabase } = await requirePermission('design.internal.read');
  const { data, error } = await supabase.rpc('get_design_internal_queue');
  const ids = (data ?? []).map((item) => item.disenador_id).filter((id): id is string => Boolean(id));
  const { data: names } = ids.length ? await supabase.rpc('get_pendiente_designer_names', { p_ids: ids }) : { data: [] };
  const designerNames = new Map((names ?? []).map((item) => [item.user_id, item.full_name || 'Diseñador']));
  return <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
    <header><p className="text-xs font-bold uppercase tracking-[.12em] text-[#0066D2]">Diseño</p><h1 className="text-2xl font-extrabold text-[#10233F]">Pendientes del Interno</h1><p className="mt-1 text-sm text-[#566274]">Solicitudes de impresión y piezas para tiendas.</p></header>
    <Link className="inline-block text-sm font-semibold text-[#0066D2] underline" href="/design/internal/history">Ver historial</Link>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">No se pudo cargar la cola. Confirma que la migración de Design esté aplicada.</p>}
    {!error && (!data || data.length === 0) ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-[#566274]">No hay solicitudes pendientes.</p> : <div className="grid gap-3 md:grid-cols-2">{(data ?? []).map((item) => <Link key={item.id} href={`/design/internal/${item.id}`} className="rounded-xl border border-[#dce2ea] bg-white p-4 transition hover:border-[#0066D2] hover:shadow-sm">
      <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-xs font-bold text-[#073b78]">{item.tipo}</span><span className="text-xs font-semibold text-[#566274]">{item.diseno_estatus === 'SOLICITADO' ? 'Por tomar' : 'En diseño'}</span></div>
      <h2 className="mt-3 font-bold text-[#10233F]">{item.titulo}</h2><p className="mt-1 text-sm text-[#566274]">{item.sede_nombre}{item.cantidad ? ` · ${item.cantidad} unidades` : ''}</p>
      <p className="mt-2 text-sm text-[#566274]">Entrega de pieza: {item.fecha_entrega_diseno}{item.disenador_id ? ` · Tomó: ${designerNames.get(item.disenador_id) ?? 'Diseñador'}` : ''}</p>
    </Link>)}</div>}
  </main>;
}
