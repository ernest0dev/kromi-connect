import Link from 'next/link';
import { requirePermission } from '@/lib/auth/dal';

export const metadata = { title: 'Historial del Interno · Diseño' };

export default async function InternalDesignHistoryPage() {
  const { supabase } = await requirePermission('design.internal.read');
  const { data, error } = await supabase.rpc('get_design_internal_history', { p_limit: 100, p_offset: 0 });
  const rows = (data ?? []) as unknown as Array<{ id: string; titulo: string; tipo: string; sede_nombre: string; diseno_estatus: string; estatus_pendiente: string; diseno_entregado_en: string | null }>;
  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6"><header><p className="text-xs font-bold uppercase tracking-[.12em] text-[#0066D2]">Diseño</p><h1 className="text-2xl font-extrabold text-[#10233F]">Historial · Pendientes del Interno</h1><Link className="mt-2 inline-block text-sm font-semibold text-[#0066D2] underline" href="/design/internal">← Volver a la cola</Link></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">No se pudo cargar el historial.</p>}
    <div className="overflow-hidden rounded-xl border bg-white">{rows.length === 0 ? <p className="p-8 text-center text-sm text-[#566274]">Todavía no hay solicitudes entregadas o canceladas.</p> : rows.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b p-4 last:border-0"><div><h2 className="font-semibold text-[#10233F]">{row.titulo}</h2><p className="text-sm text-[#566274]">{row.sede_nombre} · {row.tipo}</p></div><span className="text-xs text-[#566274]">{row.diseno_estatus} · {row.estatus_pendiente}</span></article>)}</div>
  </main>;
}
