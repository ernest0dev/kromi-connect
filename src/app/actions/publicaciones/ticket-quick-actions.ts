'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { EstatusEnum } from '@/types';
import { recalculateSlaDates } from './recalculateSla';

export async function actualizarEstatusTicketAction(input: {
  publicacionId: string;
  nuevoEstatus: EstatusEnum;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { publicacionId, nuevoEstatus } = input;

    if (!publicacionId || !nuevoEstatus) {
      return { success: false, error: 'Se requieren publicacionId y nuevoEstatus' };
    }

    const supabase = getSupabaseAdmin();

    const { error: updateError } = await supabase
      .from('publicaciones')
      .update({ estatus: nuevoEstatus })
      .eq('id', publicacionId);

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar el estatus en Supabase: ${updateError.message}`,
      };
    }

    revalidatePath('/social-media/grid');
    revalidatePath('/social-media/kanban');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Error interno en actualizarEstatusTicketAction: ${err instanceof Error ? err.message : 'Error desconocido'}`,
    };
  }
}

export async function editarCamposRapidosTicketAction(input: {
  publicacionId: string;
  titulo?: string;
  fechaPublicacion?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { publicacionId, titulo, fechaPublicacion } = input;

    if (!publicacionId) {
      return { success: false, error: 'Se requiere publicacionId' };
    }

    if (!titulo && !fechaPublicacion) {
      return { success: false, error: 'No se proporcionaron campos para actualizar.' };
    }

    const supabase = getSupabaseAdmin();

    // Si viene fechaPublicacion, delegar en recalculateSlaDates que ya hace
    // el update de fecha + recálculo SLA 3+2 + revalidatePath
    if (fechaPublicacion) {
      const res = await recalculateSlaDates({
        publicacionId,
        nuevaFechaPublicacion: fechaPublicacion,
      });
      if (!res.success) {
        return { success: false, error: res.error };
      }
    }

    // Si viene titulo (con o sin fechaPublicacion), actualizarlo por separado
    if (titulo) {
      const { error: updateError } = await supabase
        .from('publicaciones')
        .update({ titulo: titulo.trim() })
        .eq('id', publicacionId);

      if (updateError) {
        return {
          success: false,
          error: `Error al actualizar el título en Supabase: ${updateError.message}`,
        };
      }
    }

    // Revalidar rutas si solo se actualizó el título (si hubo fecha, recalculateSlaDates ya lo hizo)
    if (titulo && !fechaPublicacion) {
      revalidatePath('/social-media/grid');
      revalidatePath('/social-media/kanban');
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Error interno en editarCamposRapidosTicketAction: ${err instanceof Error ? err.message : 'Error desconocido'}`,
    };
  }
}