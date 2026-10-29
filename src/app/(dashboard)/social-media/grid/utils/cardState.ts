import type { EstatusEnum, PublicacionConCuentas } from '@/types';
import { hasCopy } from './quickViews';

/** Tiempo máximo desde la última verificación del brief para poder solicitar a Design. */
export const BRIEF_FRESH_MS = 5 * 60 * 1000;

type DesignRow = Pick<PublicacionConCuentas, 'requiere_diseno' | 'drive_brief_file_count' | 'instrucciones_diseno' | 'drive_brief_checked_at'>;

/** Motivo por el que todavía no se puede solicitar a Design, o null si ya se puede. `nowMs = 0` significa "aún sin reloj". */
export function getDesignRequestBlocker(pub: DesignRow, nowMs: number): string | null {
  if (!pub.requiere_diseno) return null;
  if (pub.drive_brief_file_count <= 0) return 'Sube los archivos del brief';
  if (!pub.instrucciones_diseno?.trim()) return 'Escribe las instrucciones para Diseño';
  const checkedAt = pub.drive_brief_checked_at ? Date.parse(pub.drive_brief_checked_at) : 0;
  if (!checkedAt || nowMs === 0 || checkedAt < nowMs - BRIEF_FRESH_MS) return 'Verifica el brief en Ver detalle';
  return null;
}

export interface NextAction {
  status: EstatusEnum;
  label: string;
  blocker: string | null;
}

type ActionRow = DesignRow & Pick<PublicacionConCuentas, 'estatus' | 'requiere_rodaje'>;

/** Siguiente paso principal del flujo; las demás transiciones siguen disponibles en el selector de estado. */
export function getNextAction(pub: ActionRow, nowMs: number): NextAction | null {
  const requestDesign = (): NextAction => ({
    status: 'SOLICITADO',
    label: 'Solicitar a Diseño',
    blocker: getDesignRequestBlocker(pub, nowMs),
  });
  const sendToApproval: NextAction = { status: 'PENDIENTE_APROBACION_GERENCIA', label: 'Enviar a aprobación', blocker: null };

  switch (pub.estatus) {
    case 'PENDIENTE_BRIEF':
      if (pub.requiere_diseno) return requestDesign();
      if (pub.requiere_rodaje) return { status: 'EN_RODAJE', label: 'Iniciar rodaje', blocker: null };
      return sendToApproval;
    case 'EN_RODAJE':
      return pub.requiere_diseno ? requestDesign() : sendToApproval;
    case 'EN_REVISION_CM':
      return sendToApproval;
    case 'PENDIENTE_APROBACION_GERENCIA':
      return { status: 'APROBADO', label: 'Registrar aprobación', blocker: null };
    case 'APROBADO':
      return { status: 'PROGRAMADO', label: 'Marcar programado', blocker: null };
    case 'PROGRAMADO':
      return { status: 'PUBLICADO', label: 'Confirmar publicado', blocker: null };
    default:
      return null;
  }
}

export interface ReadinessItem {
  key: 'copy' | 'brief' | 'rodaje';
  label: string;
  ok: boolean;
  hint: string;
}

type ReadinessRow = DesignRow &
  Pick<PublicacionConCuentas, 'estatus' | 'formato' | 'requiere_rodaje' | 'hook_texto' | 'body_texto' | 'cta_texto'>;

/** Señales de avance de la pieza. No se muestran cuando ya está publicada o cancelada. */
export function getReadiness(pub: ReadinessRow): ReadinessItem[] {
  if (pub.estatus === 'PUBLICADO' || pub.estatus === 'CANCELADO') return [];
  const items: ReadinessItem[] = [];

  if (pub.formato !== 'STORY') {
    const ok = hasCopy(pub);
    items.push({ key: 'copy', label: 'Copy', ok, hint: ok ? 'Copy listo' : 'Falta el copy' });
  }
  if (pub.requiere_diseno) {
    const hasFiles = pub.drive_brief_file_count > 0;
    const hasInstructions = !!pub.instrucciones_diseno?.trim();
    const ok = hasFiles && hasInstructions;
    items.push({
      key: 'brief',
      label: 'Brief',
      ok,
      hint: ok ? 'Brief completo' : !hasFiles ? 'Faltan los archivos del brief' : 'Faltan las instrucciones para Diseño',
    });
  }
  if (pub.requiere_rodaje) {
    const ok = pub.estatus !== 'PENDIENTE_BRIEF' && pub.estatus !== 'EN_RODAJE';
    items.push({ key: 'rodaje', label: 'Rodaje', ok, hint: ok ? 'Rodaje realizado' : 'Rodaje pendiente' });
  }
  return items;
}
