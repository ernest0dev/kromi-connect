import Link from 'next/link';
import { requirePermission } from '@/lib/auth/dal';
import { ROLE_LABELS, type AppRole } from '@/lib/auth/permissions';
import { getCaracasToday } from '@/lib/designSla';
import { listSedesActivas } from '@/lib/sedes';
import { GeneralRequestForm } from './request-form';

export default async function GeneralRequestsPage() {
  const { profile, supabase } = await requirePermission('requests.general.create');
  if (!['social-media', 'events', 'internal'].includes(profile.role_code)) return null;
  // social-media lacks events.inventory.read in the local grants, so its approved
  // request page uses the admin fallback only after requirePermission succeeds.
  const sedesResult = profile.role_code === 'social-media'
    ? await listSedesActivas()
    : await listSedesActivas(supabase);
  const { data: sedes, error: sedesError } = sedesResult;
  return <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Solicitudes generales</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Nueva solicitud de diseño</h1><p className="mt-2 text-sm text-slate-600">Solicita una pieza sin crear antes una publicación, tarea o evento.</p></div><Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-blue-800" href="/requests/mine">Mis solicitudes</Link></header>
    {sedesError && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">No se pudieron cargar las sedes físicas. Puedes continuar con el ámbito Online.</p>}
    <GeneralRequestForm physicalScopes={(sedes ?? []).map((sede) => sede.nombre)} requesterName={profile.full_name} requesterRole={ROLE_LABELS[profile.role_code as AppRole] ?? profile.role_code} today={getCaracasToday()} />
  </main>;
}
