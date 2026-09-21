'use server';

import { EstatusEnum } from '@/types';

/**
 * PLACEHOLDER — no implementada todavía.
 *
 * Contrato esperado una vez conectada a Supabase:
 *  - Actualiza `publicaciones.estatus` para el id dado.
 *  - Debe respetar las mismas reglas de RLS/Service Role que
 *    `recalcularFechasSLAAction` (ver `getSupabaseAdmin`).
 *  - Debe llamar `revalidatePath('/social-media/grid')` y
 *    `revalidatePath('/social-media/kanban')` al terminar, porque ambas
 *    vistas leen la misma tabla.
 *
 * GridClientView.tsx ya llama a esta función asumiendo esta firma — al
 * implementarla, no debería requerir cambios en el componente.
 */
export async function actualizarEstatusTicketAction(_input: {
  publicacionId: string;
  nuevoEstatus: EstatusEnum;
}): Promise<{ success: boolean; error?: string }> {
  console.warn(
    'actualizarEstatusTicketAction: Server Action no implementada todavía. ' +
      'El cambio de estatus no se está persistiendo en Supabase.'
  );
  return { success: false, error: 'Acción no implementada todavía.' };
}

/**
 * PLACEHOLDER — no implementada todavía.
 *
 * Contrato esperado: actualiza `titulo` y/o `fecha_publicacion` de una
 * publicación existente. Si `fecha_publicacion` cambia, debería
 * probablemente delegar en `recalcularFechasSLAAction` para mantener el
 * recálculo en cascada de SLA en un solo lugar, en vez de duplicar esa
 * lógica aquí.
 */
export async function editarCamposRapidosTicketAction(_input: {
  publicacionId: string;
  titulo?: string;
  fechaPublicacion?: string;
}): Promise<{ success: boolean; error?: string }> {
  console.warn(
    'editarCamposRapidosTicketAction: Server Action no implementada todavía. ' +
      'Los cambios no se están persistiendo en Supabase.'
  );
  return { success: false, error: 'Acción no implementada todavía.' };
}