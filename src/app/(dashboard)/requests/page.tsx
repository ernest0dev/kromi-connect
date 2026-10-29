import Link from 'next/link';
import { requirePermission } from '@/lib/auth/dal';
import { ROLE_LABELS, type AppRole } from '@/lib/auth/permissions';
import { getCaracasToday } from '@/lib/designSla';
import { GeneralRequestForm } from './request-form';

export default async function GeneralRequestsPage() {
  const { profile } = await requirePermission('requests.general.create');
  if (!['social-media', 'events', 'internal'].includes(profile.role_code)) return null;
  return <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Solicitudes generales</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Nueva solicitud de diseño</h1><p className="mt-2 text-sm text-slate-600">Solicita una pieza sin crear antes una publicación, tarea o evento.</p></div><Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-blue-800" href="/requests/mine">Mis solicitudes</Link></header>
    <GeneralRequestForm requesterName={profile.full_name} requesterRole={ROLE_LABELS[profile.role_code as AppRole] ?? profile.role_code} today={getCaracasToday()} />
  </main>;
}
