'use server';

import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';
import { startInternalDesignWorkAction, deliverInternalDesignWorkAction } from '@/app/actions/internal/design-work';
import { startEventDesignWorkAction, deliverEventDesignWorkAction } from '@/app/actions/events/design';
import type { DesignSource } from '@/lib/designRequests';

const VALID_SOURCES: readonly string[] = ['SOCIAL_MEDIA', 'INTERNAL', 'EVENTS'];
function valid(input: { source: DesignSource; id: string }) {
  return !!input && VALID_SOURCES.includes(input.source) && /^[0-9a-f-]{36}$/i.test(input.id);
}

export async function startDesignRequestAction(input: { source: DesignSource; id: string }) {
  if (!valid(input)) return { success: false as const, error: 'La solicitud no es válida.' };
  if (input.source === 'SOCIAL_MEDIA') return transitionPublicationAction({ publicationId: input.id, status: 'EN_DISENO' });
  if (input.source === 'INTERNAL') return startInternalDesignWorkAction(input.id);
  return startEventDesignWorkAction(input.id);
}

export async function deliverDesignRequestAction(input: { source: DesignSource; id: string }) {
  if (!valid(input)) return { success: false as const, error: 'La solicitud no es válida.' };
  if (input.source === 'SOCIAL_MEDIA') return transitionPublicationAction({ publicationId: input.id, status: 'EN_REVISION_CM' });
  if (input.source === 'INTERNAL') return deliverInternalDesignWorkAction(input.id);
  return deliverEventDesignWorkAction(input.id);
}

export async function reopenDesignRequestAction(input: { source: DesignSource; id: string }) {
  if (!valid(input)) return { success: false as const, error: 'La solicitud no es válida.' };
  if (input.source !== 'SOCIAL_MEDIA') return { success: false as const, error: 'Este origen no admite reapertura.' };
  return transitionPublicationAction({ publicationId: input.id, status: 'EN_DISENO' });
}
