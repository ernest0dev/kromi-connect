import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { Publicacion, EstatusEnum } from '@/types';
import KanbanClientView from './KanbanClientView';

export const revalidate = 0;

export default async function KanbanPage() {
  const supabase = await getSupabaseAdmin();

  const { data: publicaciones, error } = await supabase
    .from('publicaciones')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al cargar tickets para Kanban:', error);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Tablero Kanban Operativo</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Seguimiento de flujo de producción y fichas técnicas de tickets[cite: 4, 6].
          </p>
        </div>
      </header>

      <KanbanClientView publicacionesIniciales={(publicaciones as Publicacion[]) || []} />
    </div>
  );
}