'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { EstatusEnum } from '@/types';
import { recalculateSlaDates } from './recalculateSla';
import { calcularMatrizSLA } from '@/utils/sla';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function actualizarEstatusTicketAction(input: {
  publicacionId: string;
  nuevoEstatus: EstatusEnum;
}): Promise<{ success: boolean; error?: string }> {
  const access = await authorizeAction('social-media.posts.status.update');
  if (access.error) return { success: false, error: access.error };
  if (!access.context) return { success: false, error: 'Inicia sesión para continuar.' };
  try {
    const { publicacionId, nuevoEstatus } = input;

    if (!publicacionId || !nuevoEstatus) {
      return { success: false, error: 'Se requieren publicacionId y nuevoEstatus' };
    }

    const supabase = access.context.supabase;

    const { data: canManageAllAccounts, error: accountScopeError } = await supabase.rpc('user_has_all_publication_accounts', {
      p_publicacion_id: publicacionId,
    });
    if (accountScopeError || !canManageAllAccounts) {
      return { success: false, error: accountScopeError?.message || 'Para cambiar el estado necesitas tener asignadas todas las cuentas destino.' };
    }

    const { data: current, error: currentError } = await supabase
      .from('publicaciones')
      .select('fecha_publicacion, fecha_solicitud_diseno')
      .eq('id', publicacionId)
      .maybeSingle();
    if (currentError || !current) {
      return { success: false, error: currentError?.message || 'La publicación ya no existe.' };
    }

    const update: { estatus: EstatusEnum; fecha_solicitud_diseno?: string; fecha_limite_brief?: string; fecha_entrega_diseno_estimada?: string | null } = {
      estatus: nuevoEstatus,
    };
    if (nuevoEstatus === 'SOLICITADO' && !current.fecha_solicitud_diseno) {
      const requestedAt = new Date().toISOString();
      update.fecha_solicitud_diseno = requestedAt;
      Object.assign(update, calcularMatrizSLA(current.fecha_publicacion, requestedAt));
    }

    const { error: updateError } = await supabase
      .from('publicaciones')
      .update(update)
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
