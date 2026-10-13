// Inventario compartido del rol Eventos. Ver docs/design/plan-inventario-eventos.md.
// Los tipos de fila están aquí (y no en database.types.ts) porque los devuelven funciones RPC.

export type InventarioTipoControl = 'LOTE' | 'INDIVIDUAL';

export type InventarioCondicion = 'DISPONIBLE' | 'DANADO' | 'EN_REPARACION' | 'DADO_DE_BAJA';

export type InventarioMovimientoTipo = 'CONTEO_INICIAL' | 'TRASLADO' | 'SALIDA' | 'RETORNO' | 'AJUSTE';

/** Tipos que el usuario puede registrar; CONTEO_INICIAL lo escribe el sistema al crear. */
export type InventarioMovimientoRegistrable = Exclude<InventarioMovimientoTipo, 'CONTEO_INICIAL'>;

/** Fila de public.list_inventory_items(): artículo/lote con nombres ya resueltos. */
export interface InventarioArticuloRow {
  id: string;
  categoria_id: string;
  categoria_nombre: string;
  nombre: string;
  especificaciones: string | null;
  atributos: Record<string, unknown>;
  tipo_control: InventarioTipoControl;
  codigo: string | null;
  cantidad: number;
  unidad_medida: string;
  sede_id: string;
  sede_nombre: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  condicion: InventarioCondicion;
  version: number;
  creado_en: string;
  creado_por: string | null;
  creado_por_nombre: string | null;
  modificado_en: string;
  modificado_por: string | null;
  modificado_por_nombre: string | null;
  total_count: number;
}

/** Fila de public.get_inventory_item_activity(). `delta` es el cambio de saldo visto desde ese artículo. */
export interface InventarioActividadRow {
  id: string;
  tipo: InventarioMovimientoTipo;
  cantidad: number;
  delta: number;
  origen_sede_nombre: string | null;
  origen_ubicacion_nombre: string | null;
  destino_sede_nombre: string | null;
  destino_ubicacion_nombre: string | null;
  origen_externo: string | null;
  destino_externo: string | null;
  fecha_hora: string;
  registrado_por: string | null;
  registrado_por_nombre: string | null;
  registrado_en: string;
  estado: 'COMPLETADO';
  observacion: string | null;
  saldo: number;
  corrige_movimiento_id: string | null;
  total_count: number;
}

export interface InventarioSede {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
}

export interface InventarioUbicacion {
  id: string;
  sede_id: string;
  nombre: string;
}

export interface InventarioCategoria {
  id: string;
  nombre: string;
}

export interface InventarioPermisos {
  create: boolean;
  update: boolean;
  move: boolean;
  createLocation: boolean;
}

export type InventarioSortKey = 'nombre' | 'categoria' | 'cantidad' | 'ubicacion' | 'condicion' | 'modificado';

export interface InventarioConsulta {
  sede: string;
  q: string;
  categoria: string;
  ubicacion: string;
  condicion: InventarioCondicion | '';
  control: InventarioTipoControl | '';
  sort: InventarioSortKey;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
