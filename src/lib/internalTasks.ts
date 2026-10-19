export const INTERNAL_TASK_TYPES = ['IMPRESION', 'SONIDO_INTERNO', 'REPARACION', 'OTRO'] as const;
export type InternalTaskType = (typeof INTERNAL_TASK_TYPES)[number];
export type LegacyInternalTaskType = 'INSUMO' | 'NECESIDAD';
export const INTERNAL_TASK_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'LISTO', 'ENTREGADO', 'CANCELADO'] as const;
export type InternalTaskStatus = (typeof INTERNAL_TASK_STATUSES)[number];

export const TASK_TYPE_LABELS: Record<InternalTaskType | LegacyInternalTaskType, string> = {
  IMPRESION: 'Impresión', SONIDO_INTERNO: 'Sonido interno', REPARACION: 'Reparación', OTRO: 'Otro',
  INSUMO: 'Insumo (anterior)', NECESIDAD: 'Necesidad (anterior)',
};
export const TASK_STATUS_LABELS: Record<InternalTaskStatus, string> = {
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', LISTO: 'Listo para entregar',
  ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
};

export type StoreTaskRow = {
  id: string; sede_id: string; sede_nombre: string; tipo: InternalTaskType | LegacyInternalTaskType; titulo: string;
  detalle: string | null; cantidad: number | null; enlace_referencia: string | null;
  fecha_requerida: string | null; estatus: InternalTaskStatus; version: number; creado_en: string;
  archivado_en: string | null; requiere_diseno: boolean; instrucciones_diseno: string | null;
  fecha_entrega_diseno: string | null; diseno_estatus: string | null; drive_brief_file_count: number;
  total_count: number;
};

export type InternalStore = { id: string; codigo: string; nombre: string };

export type StoreMapInfo = { lat: number; lng: number; zone: string; address: string };

export const STORE_MAP_INFO: Record<string, StoreMapInfo> = {
  PREBO: { lat: 10.2133212, lng: -68.0279878, zone: 'Valencia Norte', address: 'Urb. Prebo Av. 137 c/c 114, C.C. V Avenida' },
  MANONGO: { lat: 10.2415025, lng: -67.9974483, zone: 'Naguanagua', address: 'Urb. Ciudad Jardín Mañongo, Parcela 1 y 2' },
  TRIGAL_SUR: { lat: 10.2124862, lng: -67.9999188, zone: 'Valencia Norte', address: 'C.C. Trigal Sur, Planta Baja' },
  TRIGAL_NORTE: { lat: 10.2251378, lng: -68.0012985, zone: 'Valencia Norte', address: 'C.C. Las Clavellinas, antiguo Panda' },
  GUATAPARO: { lat: 10.1882288, lng: -68.0435123, zone: 'Valencia Norte', address: 'C.C. Guataparo Express, Valencia 2001' },
  CASTILLITO: { lat: 10.1955375, lng: -67.9692031, zone: 'San Diego', address: 'Urb. Parque Comercio Industrial Castillito, C.C. Tigsa, galpón G-2' },
  SAN_FELIPE: { lat: 10.3427758, lng: -68.7259993, zone: 'Yaracuy', address: 'Av. Intercomunal El Fuerte, San Felipe' },
};

export type InternalDesignRequest = {
  id: string; titulo: string; tipo: string; sede_nombre: string; cantidad: number | null;
  instrucciones_diseno: string; fecha_entrega_diseno: string; diseno_estatus: string;
  disenador_id: string | null; diseno_solicitado_en: string; diseno_iniciado_en: string | null;
  diseno_entregado_en: string | null; drive_folder_id: string | null; drive_brief_folder_id: string | null;
  drive_deliverables_folder_id: string | null;
};

export function validateStoreTask(input: {
  tipo: string; titulo: string; sedeIds: string[]; cantidad?: string;
  enlaceReferencia?: string; fechaRequerida?: string; requiereDiseno?: boolean;
  instruccionesDiseno?: string; fechaEntregaDiseno?: string;
}): string | null {
  if (!INTERNAL_TASK_TYPES.includes(input.tipo as InternalTaskType) && !['INSUMO', 'NECESIDAD'].includes(input.tipo)) return 'Elige un tipo válido.';
  if (!input.titulo.trim() || input.titulo.trim().length > 160) return 'El título es obligatorio y admite hasta 160 caracteres.';
  if (input.sedeIds.length < 1) return 'Elige al menos una tienda.';
  if (input.requiereDiseno && input.sedeIds.length !== 1) return 'Con diseño, elige una sola tienda.';
  if (input.requiereDiseno && !input.fechaRequerida) return 'Indica cuándo se requiere en tienda para calcular las fechas de diseño.';
  if (input.instruccionesDiseno && input.instruccionesDiseno.length > 4000) return 'Las instrucciones admiten hasta 4000 caracteres.';
  if (input.fechaEntregaDiseno && !/^\d{4}-\d{2}-\d{2}$/.test(input.fechaEntregaDiseno)) return 'La fecha de entrega de diseño no es válida.';
  const quantity = input.cantidad?.trim();
  if (quantity && (!/^\d+$/.test(quantity) || Number(quantity) < 1)) return 'La cantidad debe ser un entero mayor que cero.';
  if (input.fechaRequerida && !/^\d{4}-\d{2}-\d{2}$/.test(input.fechaRequerida)) return 'La fecha requerida no es válida.';
  return null;
}

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getDesignDates(requiredDate: string | null, requestedAt?: string | null) {
  return {
    briefDeadline: requiredDate ? addCalendarDays(requiredDate, -5) : null,
    designDueDate: requiredDate ? addCalendarDays(requiredDate, -2) : null,
    estimatedDelivery: requestedAt ? addCalendarDays(requestedAt.slice(0, 10), 2) : null,
  };
}

export function getUrgency(date: string | null, today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })) {
  if (!date) return 'sin_fecha' as const;
  const delta = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (delta < 0) return 'vencido' as const;
  if (delta <= 2) return 'proximo' as const;
  return 'normal' as const;
}
