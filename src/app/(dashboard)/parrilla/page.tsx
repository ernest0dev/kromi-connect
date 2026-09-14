import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { Publicacion } from '@/types';
import ParrillaClientView from './ParrillaClientView';

export const revalidate = 0;

export default async function ParrillaPage() {
  const supabase = await getSupabaseAdmin();

  const { data: publicaciones, error } = await supabase
    .from('publicaciones')
    .select('*')
    .order('fecha_publicacion', { ascending: true });

  if (error) {
    console.error('Error al obtener publicaciones:', error);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Grilla Macro de Contenidos</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Planificación mensual y reprogramación mediante Drag & Drop[cite: 4, 6].
          </p>
        </div>
      </header>

      <ParrillaClientView publicacionesIniciales={(publicaciones as Publicacion[]) || []} />
    </div>
  );
}