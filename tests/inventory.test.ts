import {
  buildInventoryQueryString,
  formatStamp,
  parseInventoryQuery,
  parseQuantity,
  sedeSlug,
  shortName,
  validateItemInput,
  validateMovementInput,
} from '@/lib/inventory';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('parseInventoryQuery', () => {
  it('usa valores por defecto', () => {
    const q = parseInventoryQuery({});
    expect(q).toMatchObject({ sede: '', q: '', sort: 'nombre', dir: 'asc', page: 1, pageSize: 10 });
  });

  it('descarta valores desconocidos', () => {
    const q = parseInventoryQuery({ condicion: 'X', control: 'Y', sort: 'hack', size: '999', page: '-3', categoria: 'no-uuid' });
    expect(q).toMatchObject({ condicion: '', control: '', sort: 'nombre', pageSize: 10, page: 1, categoria: '' });
  });

  it('acepta valores válidos', () => {
    const q = parseInventoryQuery({ categoria: UUID, condicion: 'DANADO', control: 'LOTE', size: '25', page: '2', dir: 'desc' });
    expect(q).toMatchObject({ categoria: UUID, condicion: 'DANADO', control: 'LOTE', pageSize: 25, page: 2, dir: 'desc' });
  });
});

describe('buildInventoryQueryString', () => {
  it('omite los valores por defecto', () => {
    expect(buildInventoryQueryString(parseInventoryQuery({}))).toBe('');
  });

  it('hace viaje de ida y vuelta', () => {
    const q = parseInventoryQuery({ sede: 'prebo', q: 'silla', page: '3', size: '50', sort: 'cantidad', dir: 'desc' });
    expect(parseInventoryQuery(Object.fromEntries(new URLSearchParams(buildInventoryQueryString(q))))).toEqual(q);
  });
});

describe('utilidades', () => {
  it('sedeSlug', () => expect(sedeSlug('TRIGAL_SUR')).toBe('trigal-sur'));

  it('parseQuantity', () => {
    expect(parseQuantity('12,5')).toBe(12.5);
    expect(parseQuantity('0')).toBe(0);
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('1.234')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });

  it('shortName', () => {
    expect(shortName(null)).toBe('Usuario');
    expect(shortName('Ana')).toBe('Ana');
    expect(shortName('Ana Pérez')).toBe('Ana P.');
    expect(shortName('Ana María Pérez Soto')).toBe('Ana P.');
  });

  it('formatStamp usa hora de Caracas', () => {
    const now = new Date('2026-10-13T18:00:00Z');
    expect(formatStamp('2026-10-13T15:20:00Z', now)).toBe('Hoy 11:20');
    expect(formatStamp('2026-10-12T15:20:00Z', now)).toBe('Ayer 11:20');
    expect(formatStamp('2026-10-01T15:20:00Z', now)).toBe('1 oct, 11:20');
    expect(formatStamp('nope', now)).toBe('—');
  });
});

describe('validadores', () => {
  const base = { categoriaId: UUID, nombre: 'Silla', especificaciones: '', tipoControl: 'LOTE' as const, codigo: '', cantidad: '5', unidadMedida: 'unidad', ubicacionId: UUID, condicion: 'DISPONIBLE' as const };

  it('validateItemInput', () => {
    expect(validateItemInput(base)).toBeNull();
    expect(validateItemInput({ ...base, nombre: ' ' })).toMatch(/nombre/);
    expect(validateItemInput({ ...base, cantidad: '-2' })).toMatch(/cantidad/);
    expect(validateItemInput({ ...base, tipoControl: 'INDIVIDUAL' })).toMatch(/código/);
    expect(validateItemInput({ ...base, tipoControl: 'INDIVIDUAL', codigo: 'EV-1', cantidad: '' })).toBeNull();
  });

  it('validateMovementInput', () => {
    const mov = { articuloId: UUID, tipo: 'TRASLADO' as const, cantidad: '2', expectedVersion: 1, destinoUbicacionId: UUID };
    expect(validateMovementInput(mov)).toBeNull();
    expect(validateMovementInput({ ...mov, destinoUbicacionId: undefined })).toMatch(/destino/);
    expect(validateMovementInput({ ...mov, cantidad: '0' })).toMatch(/mayor que 0/);
    expect(validateMovementInput({ ...mov, tipo: 'AJUSTE', cantidad: '0' })).toMatch(/motivo/);
    expect(validateMovementInput({ ...mov, tipo: 'AJUSTE', cantidad: '0', observacion: 'Conteo' })).toBeNull();
  });
});
