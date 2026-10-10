'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { EstatusEnum } from '@/types';
import { recalculateSlaDates } from './recalculateSla';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { transitionPublicationAction } from './workflow';

export async function actualizarEstatusTicketAction(input: {
  publicacionId: string;
  nuevoEstatus: EstatusEnum;
}): Promise<{ success: boolean; error?: string }> {
  if (!input?.publicacionId || !input.nuevoEstatus) return { success: false, error: 'Se requieren publicación y estado.' };
  return transitionPublicationAction({ publicationId: input.publicacionId, status: input.nuevoEstatus });
}

export async function editarCamposRapidosTicketAction(input: {
  publicacionId: string;
  titulo?: string;
  fechaPublicacion?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { publicacionId, titulo, fechaPublicacion } = input;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

  if (fechaPublicacion) {
    const access = await authorizeAction('social-media.posts.reschedule');
    if (access.error) return { success: false, error: access.error };
  }
  if (titulo) {
    const access = await authorizeAction('social-media.posts.edit');
    if (access.error) return { success: false, error: access.error };
    if (!access.context) return { success: false, error: 'Inicia sesión para continuar.' };
    supabase = access.context.supabase;
  }
  try {
    if (!publicacionId) {
      return { success: false, error: 'Se requiere publicacionId' };
    }

    if (!titulo && !fechaPublicacion) {
      return { success: false, error: 'No se proporcionaron campos para actualizar.' };
    }

    if (!supabase) {
      const access = await authorizeAction('social-media.posts.reschedule');
      if (access.error) return { success: false, error: access.error };
      if (!access.context) return { success: false, error: 'Inicia sesión para continuar.' };
      supabase = access.context.supabase;
    }

    const { data: canManageAllAccounts, error: accountScopeError } = await supabase.rpc('user_has_all_publication_accounts', {
      p_publicacion_id: publicacionId,
    });
    if (accountScopeError || !canManageAllAccounts) {
      return { success: false, error: accountScopeError?.message || 'Para editar esta publicación necesitas tener asignadas todas sus cuentas destino.' };
    }

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
