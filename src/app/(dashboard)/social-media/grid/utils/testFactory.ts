import type { PublicacionConCuentas } from '@/types';

let counter = 0;

/** Fábrica de publicaciones para tests: solo hay que indicar lo que importa en cada caso. */
export function makePub(overrides: Partial<PublicacionConCuentas> = {}): PublicacionConCuentas {
  counter += 1;
  return {
    id: `pub-${String(counter).padStart(3, '0')}`,
    campana_id: null,
    titulo: `Publicación ${counter}`,
    formato: 'POST',
    linea_contenido: null,
    fecha_publicacion: '2026-11-10',
    hora_publicacion: null,
    requiere_rodaje: false,
    requiere_diseno: true,
    instrucciones_diseno: null,
    fecha_rodaje: null,
    sedes: [],
    prioridad: 2,
    fecha_limite_brief: '2026-11-05',
    fecha_solicitud_diseno: null,
    fecha_entrega_diseno_estimada: null,
    fecha_entrega_diseno_real: null,
    fecha_aprobacion_gerencia: null,
    estatus: 'PENDIENTE_BRIEF',
    hook_texto: null,
    body_texto: null,
    cta_texto: null,
    hashtags: null,
    version_copy: 1,
    drive_folder_id: null,
    drive_folder_url: null,
    drive_brief_folder_id: null,
    drive_deliverables_folder_id: null,
    drive_brief_file_count: 0,
    drive_brief_checked_at: null,
    creador_id: null,
    disenador_id: null,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    deleted_at: null,
    drive_cleanup_status: 'NO_APLICA',
    drive_cleanup_error: null,
    drive_cleanup_attempted_at: null,
    drive_deleted_at: null,
    drive_preserved_at: null,
    social_account_ids: [],
    ...overrides,
  } as PublicacionConCuentas;
}
