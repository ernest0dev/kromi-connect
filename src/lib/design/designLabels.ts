import type { DesignRequest, DesignSource, DesignStatus } from '@/lib/designRequests';

export const DESIGN_SOURCE_LABELS: Record<DesignSource, string> = {
  SOCIAL_MEDIA: 'Social Media', INTERNAL: 'Interno', EVENTS: 'Eventos', GENERAL: 'General',
};

export const DESIGN_STATUS_LABELS: Record<DesignStatus, string> = {
  REQUESTED: 'Solicitada', IN_PROGRESS: 'En diseño', NEEDS_CHANGES: 'Devuelta con correcciones',
  DELIVERED: 'Entregada', CANCELLED: 'Cancelada',
};

export function designOutputLabel(value: string) {
  const labels: Record<string, string> = { DIGITAL: 'Digital', IMPRESION: 'Impresión', PRINT: 'Impresión', REEL: 'Reel', STORY: 'Story', POST: 'Publicación' };
  return labels[value] ?? value.toLowerCase().replaceAll('_', ' ').replace(/\b\p{L}/gu, (x) => x.toUpperCase());
}

export function designRequestHref(request: Pick<DesignRequest, 'source' | 'source_record_id'>) {
  return `/design/requests/${request.source.toLowerCase()}/${encodeURIComponent(request.source_record_id)}`;
}
