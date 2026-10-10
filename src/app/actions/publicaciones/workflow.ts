'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';
import { EstatusEnum } from '@/types';
import { hasPublicacionDeliverable } from '@/lib/googleDrive';

const ESTADOS_DE_FLUJO: EstatusEnum[] = [
  'PENDIENTE_BRIEF', 'EN_RODAJE', 'EN_DISENO', 'EN_REVISION_CM', 'RECHAZADO_DISENO',
  'PENDIENTE_APROBACION_GERENCIA', 'APROBADO', 'PROGRAMADO', 'PUBLICADO', 'SOLICITADO',
  'EN_CORRECCION', 'CANCELADO', 'INCOMPLETO',
];

export async function transitionPublicationAction(input: {
  publicationId: string;
  status: EstatusEnum;
  reason?: string;
}) {
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.publicationId) || !ESTADOS_DE_FLUJO.includes(input.status)) {
    return { success: false as const, error: 'La transición solicitada no es válida.' };
  }
  if ((input.status === 'CANCELADO' || input.status === 'EN_CORRECCION') && !input.reason?.trim()) {
    return { success: false as const, error: input.status === 'CANCELADO' ? 'Indica el motivo de cancelación.' : 'Indica las correcciones solicitadas.' };
  }

  let access: Awaited<ReturnType<typeof authorizeAction>>;
  if (input.status === 'CANCELADO') access = await authorizeAction('social-media.posts.status.update');
  else if (input.status === 'EN_DISENO') access = await authorizeAction('design.posts.start');
  else if (input.status === 'EN_REVISION_CM') {
    access = await authorizeAction('design.posts.deliver');
    if (access.error || !access.context) return { success: false as const, error: access.error || 'Solo Diseño puede entregar una pieza.' };
    const { data: queue, error: queueError } = await access.context.supabase.rpc('get_design_publication_queue');
    if (queueError) return { success: false as const, error: queueError.message };
    const publication = queue?.find((item) => item.id === input.publicationId);
    if (!publication || publication.estatus !== 'EN_DISENO') return { success: false as const, error: 'La solicitud no está en diseño o ya cambió de estado.' };
    if (!publication.drive_folder_id) return { success: false as const, error: 'Esta publicación no tiene carpeta de Drive. Pide a Social Media que la cree antes de entregar.' };
    const deliverable = await hasPublicacionDeliverable(publication.drive_folder_id);
    if (deliverable.error) return { success: false as const, error: `No se pudo verificar la carpeta de Drive: ${deliverable.error}` };
    if (!deliverable.hasFile) return { success: false as const, error: 'Sube la pieza final a la carpeta de Drive antes de entregarla a revisión.' };
  } else access = await authorizeAction('social-media.posts.status.update');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.' };

  const { data, error } = await access.context.supabase.rpc('transition_publicacion_status', {
    p_publicacion_id: input.publicationId,
    p_estatus_nuevo: input.status,
    p_motivo: input.reason?.trim() || null,
  });
  if (error) return { success: false as const, error: error.message };

  revalidatePath('/social-media/grid');
  revalidatePath('/social-media/grid/archive');
  revalidatePath('/social-media/kanban');
  revalidatePath('/design/publications');
  return { success: true as const, data };
}

export async function getPublicationReviewHistoryAction(publicationId: string) {
  const access = await authorizeAction('social-media.posts.read');
  if (access.error || !access.context) return { success: false as const, error: access.error || 'Inicia sesión para continuar.', comments: [], history: [] };
  const supabase = access.context.supabase;
  const [comments, history] = await Promise.all([
    supabase.from('publicacion_comentarios').select('id, texto, tipo, creado_en, autor_id').eq('publicacion_id', publicationId).order('creado_en', { ascending: true }),
    supabase.from('publicacion_estatus_historial').select('id, estatus_anterior, estatus_nuevo, motivo, cambiado_en').eq('publicacion_id', publicationId).order('cambiado_en', { ascending: true }),
  ]);
  if (comments.error || history.error) return { success: false as const, error: comments.error?.message || history.error?.message || 'No se pudo cargar el historial.', comments: [], history: [] };
  return { success: true as const, comments: comments.data || [], history: history.data || [] };
}
