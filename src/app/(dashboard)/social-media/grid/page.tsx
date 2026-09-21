import React from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { Publicacion } from '@/types';
import GridClientView from './GridClientView';

export const revalidate = 0;

export default async function ParrillaPage() {
  // getSupabaseAdmin es sincrónico; se obtiene directamente sin await
  const supabase = getSupabaseAdmin();

  const { data: publicaciones, error } = await supabase
    .from('publicaciones')
    .select('*')
    .order('fecha_publicacion', { ascending: true });

  if (error) {
    console.error('Error al obtener publicaciones:', error);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7E4DC] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#10233F]">Parrilla macro de contenidos</h1>
          <p className="text-sm text-[#6B7482] mt-0.5">
            Planificación mensual y reprogramación mediante arrastrar y soltar.
          </p>
        </div>
      </header>

      <GridClientView publicacionesIniciales={(publicaciones as Publicacion[]) || []} />
    </div>
  );
}