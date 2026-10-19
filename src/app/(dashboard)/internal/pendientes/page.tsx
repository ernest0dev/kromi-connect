import { requirePermission, hasPermission } from '@/lib/auth/dal';
import type { StoreTaskRow, InternalStore } from '@/lib/internalTasks';
import { TaskListView } from './TaskListView';

export const metadata = { title: 'Pendientes · Interno' };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const integer = (value: string | string[] | undefined, fallback: number) => { const parsed = Number(one(value)); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; };

export default async function InternalTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requirePermission('internal.store-tasks.read');
  const query = await searchParams;
  const page = integer(query.page, 1);
  const requestedSize = integer(query.page_size, 25);
  const pageSize = [10, 25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const common = {
    p_archived: false, p_tipo: one(query.tipo) || null, p_estatus: one(query.estado) || null,
    p_sede_id: one(query.sede) || null, p_search: one(query.q)?.slice(0, 100) || null,
  };
  const [storesResult, tasksResult, mapResult, canCreate] = await Promise.all([
    supabase.rpc('list_internal_stores'),
    supabase.rpc('list_store_tasks', { ...common, p_limit: pageSize, p_offset: (page - 1) * pageSize }),
    supabase.rpc('list_store_tasks', { ...common, p_limit: 100, p_offset: 0 }),
    hasPermission('internal.store-tasks.create'),
  ]);
  const loadError = storesResult.error || tasksResult.error || mapResult.error;
  return <>
    {loadError && <div role="alert" className="mx-auto mt-6 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">No se pudieron cargar los pendientes. Confirma que esté aplicada la migración manual de Interno.</div>}
    <TaskListView rows={(tasksResult.data ?? []) as StoreTaskRow[]} mapRows={(mapResult.data ?? []) as StoreTaskRow[]} stores={(storesResult.data ?? []) as InternalStore[]} canCreate={canCreate} page={page} pageSize={pageSize}
      filters={{ q: one(query.q) || '', tipo: one(query.tipo) || '', estado: one(query.estado) || '', sede: one(query.sede) || '' }} />
  </>;
}
