'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAction } from '@/lib/auth/dal';

export async function requestEventDesignAction(eventId: string) {
  const access = await authorizeAction('events.schedule.design');
  if (access.error || !access.context) return { success: false as const, error: access.error ?? 'No tienes permiso.' };
  const { error } = await access.context.supabase.rpc('request_evento_to_design', { p_evento_id: eventId });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/events/calendar'); revalidatePath('/design/publications');
  return { success: true as const };
}

export async function retractEventDesignAction(eventId: string, expectedVersion: number) {
  const access = await authorizeAction('events.schedule.design');
  if (access.error || !access.context) return { success: false as const, error: access.error ?? 'No tienes permiso.' };
  const { error } = await access.context.supabase.rpc('retract_evento_design_request', { p_evento_id: eventId, p_expected_version: expectedVersion });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/events/calendar'); revalidatePath('/design/publications');
  return { success: true as const };
}

export async function startEventDesignWorkAction(eventId: string) {
  const access = await authorizeAction('design.requests.start');
  if (access.error || !access.context) return { success: false as const, error: access.error ?? 'No tienes permiso.' };
  const { error } = await access.context.supabase.rpc('design_start_event_request', { p_evento_id: eventId });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/design/publications'); revalidatePath(`/design/events/${eventId}`); revalidatePath('/events/calendar');
  return { success: true as const };
}

export async function deliverEventDesignWorkAction(eventId: string) {
  const access = await authorizeAction('design.requests.deliver');
  if (access.error || !access.context) return { success: false as const, error: access.error ?? 'No tienes permiso.' };
  const { error } = await access.context.supabase.rpc('design_deliver_event_request', { p_evento_id: eventId });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/design/publications'); revalidatePath(`/design/events/${eventId}`); revalidatePath('/events/calendar');
  return { success: true as const };
}
