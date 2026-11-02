import {
  normalizeInventoryActivity,
  normalizeInventoryItem,
  normalizeInventoryMovementArticleId,
} from '@/lib/inventory-rpc';

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  categoria_id: '22222222-2222-4222-8222-222222222222',
  categoria_nombre: 'Mobiliario',
  nombre: 'Silla',
  especificaciones: null,
  atributos: { color: 'azul' },
  tipo_control: 'LOTE',
  codigo: null,
  cantidad: 4,
  unidad_medida: 'unidades',
  sede_id: '33333333-3333-4333-8333-333333333333',
  sede_nombre: 'Prebo',
  ubicacion_id: '44444444-4444-4444-8444-444444444444',
  ubicacion_nombre: 'Depósito',
  condicion: 'DISPONIBLE',
  version: 1,
  creado_en: '2026-10-13T00:00:00Z',
  creado_por: null,
  creado_por_nombre: null,
  modificado_en: '2026-10-13T00:00:00Z',
  modificado_por: null,
  modificado_por_nombre: null,
  total_count: 1,
};

describe('inventory RPC normalizers', () => {
  it('accepts a complete inventory item with nullable database fields', () => {
    expect(normalizeInventoryItem(item)).toEqual({ ok: true, value: item });
  });

  it('rejects incomplete inventory rows instead of coercing them', () => {
    const incomplete = Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'total_count'),
    );

    expect(normalizeInventoryItem(incomplete)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/inválidos/i),
    });
  });

  it('validates activity and movement return payloads', () => {
    const activity = {
      id: item.id,
      tipo: 'CONTEO_INICIAL',
      cantidad: 4,
      delta: 4,
      origen_sede_nombre: null,
      origen_ubicacion_nombre: null,
      destino_sede_nombre: 'Prebo',
      destino_ubicacion_nombre: 'Depósito',
      origen_externo: null,
      destino_externo: null,
      fecha_hora: '2026-10-13T00:00:00Z',
      registrado_por: null,
      registrado_por_nombre: null,
      registrado_en: '2026-10-13T00:00:00Z',
      estado: 'COMPLETADO',
      observacion: null,
      saldo: 4,
      corrige_movimiento_id: null,
      total_count: 1,
    };

    expect(normalizeInventoryActivity([activity])).toEqual({ ok: true, value: [activity] });
    expect(normalizeInventoryMovementArticleId({ articulo_id: item.id })).toEqual({ ok: true, value: item.id });
    expect(normalizeInventoryMovementArticleId({})).toMatchObject({ ok: false });
  });
});
