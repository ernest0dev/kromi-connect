import { requirePermission } from '@/lib/auth/dal';
import type { StoreTaskRow, InternalStore } from '@/lib/internalTasks';
import { TaskListView } from '../TaskListView';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const positiveInt = (value: string | string[] | undefined, fallback: number) => { const parsed = Number(one(value)); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; };

export const metadata = { title: 'Archivo de pendientes · Interno' };

export default async function InternalTasksArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requirePermission('internal.store-tasks.read');
  const query = await searchParams;
  const page = positiveInt(query.page, 1);
  const requestedSize = positiveInt(query.page_size, 25);
  const pageSize = [10, 25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const [storesResult, tasksResult] = await Promise.all([
    supabase.rpc('list_internal_stores'),
    supabase.rpc('list_store_tasks', { p_archived: true, p_limit: pageSize, p_offset: (page - 1) * pageSize }),
  ]);
  const loadError = storesResult.error || tasksResult.error;
  return <>
    {loadError && <div role="alert" className="mx-auto mt-6 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">No se pudo cargar el archivo. Confirma que esté aplicada la migración manual de Interno.</div>}
    <TaskListView rows={(tasksResult.data ?? []) as StoreTaskRow[]} stores={(storesResult.data ?? []) as InternalStore[]} archived canCreate={false} page={page} pageSize={pageSize} />
  </>;
}
