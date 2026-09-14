'use me' // Server Action
'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseClient'; // Cliente de Supabase optimizado para Server Actions
import { calcularMatrizSLA } from '@/utils/sla';
import { Publicacion } from '@/types';

export interface RecalcularFechasSLAInput {
  publicacionId: string;
  nuevaFechaPublicacion: string; // Formato YYYY-MM-DD
}

export interface RecalcularFechasSLAResponse {
  success: boolean;
  data?: Publicacion;
  error?: string;
}

/**
 * Server Action: recalcularFechasSLAAction
 * Soporta "Quick Reschedule" (Drag & Drop desde la Grilla/Calendario).
 * Actualiza la fecha_publicacion en Supabase y recorta hacia atrás las fechas de SLA (Regla 3+2).
 */
export async function recalcularFechasSLAAction(
  input: RecalcularFechasSLAInput
): Promise<RecalcularFechasSLAResponse> {
  try {
    const { publicacionId, nuevaFechaPublicacion } = input;

    if (!publicacionId || !nuevaFechaPublicacion) {
      return { success: false, error: 'Se requieren publicacionId y nuevaFechaPublicacion' };
    }

    const supabase = await getSupabaseAdmin();

    // 1. Obtener el registro actual para validar existencia y fecha de solicitud a diseño
    const { data: publicacionExistente, error: fetchError } = await supabase
      .from('publicaciones')
      .select('id, fecha_solicitud_diseno')
      .eq('id', publicacionId)
      .single();

    if (fetchError || !publicacionExistente) {
      return {
        success: false,
        error: `No se encontró la publicación especificada: ${fetchError?.message || 'ID inexistente'}`,
      };
    }

    // 2. Aplicar la lógica de negocio SLA (Regla 3+2)
    const { fecha_limite_brief, fecha_entrega_diseno_estimada } = calcularMatrizSLA(
      nuevaFechaPublicacion,
      publicacionExistente.fecha_solicitud_diseno
    );

    // 3. Actualizar la publicación en Supabase
    const { data: publicacionActualizada, error: updateError } = await supabase
      .from('publicaciones')
      .update({
        fecha_publicacion: nuevaFechaPublicacion,
        fecha_limite_brief,
        fecha_entrega_diseno_estimada,
      })
      .eq('id', publicacionId)
      .select()
      .single();

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar las fechas en Supabase: ${updateError.message}`,
      };
    }

    // 4. Revalidar la caché de la vista de Parrilla / Calendario para reflejar el cambio en UI
    revalidatePath('/parrilla');

    return {
      success: true,
      data: publicacionActualizada as Publicacion,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error interno en recalcularFechasSLAAction: ${err?.message || 'Error desconocido'}`,
    };
  }
}