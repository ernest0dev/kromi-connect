import { applyFilters, DEFAULT_FILTERS, groupPublicaciones, hasActiveFilters, needsMyAction, parseFilters, sortPublicaciones, writeFiltersToParams } from './filters';
import type { GridFilters } from './filters';
import { makePub } from './testFactory';

const ctx = { today: '2026-11-05', campanaNombrePorId: new Map([['camp-1', 'Ofertas Noviembre']]) };
const withFilters = (patch: Partial<GridFilters>): GridFilters => ({ ...DEFAULT_FILTERS, ...patch });

describe('URL', () => {
  it('ida y vuelta sin perder filtros y con URL vacía por defecto', () => {
    const params = new URLSearchParams();
    writeFiltersToParams(DEFAULT_FILTERS, params);
    expect(params.toString()).toBe('');

    const filters = withFilters({ q: 'carne', formato: 'REEL', estatus: ['APROBADO', 'PROGRAMADO'], campana: 'none', accion: true, vista: 'por-revisar', sort: 'prioridad', dir: 'desc', group: 'semana' });
    writeFiltersToParams(filters, params);
    expect(parseFilters(new URLSearchParams(params.toString()))).toEqual(filters);
  });

  it('descarta valores inválidos y conserva parámetros ajenos', () => {
    const parsed = parseFilters(new URLSearchParams('formato=NOPE&estado=APROBADO,XXX,APROBADO&orden=zzz&vista=otra&mes=2026-11'));
    expect(parsed.formato).toBe('TODOS');
    expect(parsed.estatus).toEqual(['APROBADO']);
    expect(parsed.sort).toBe('fecha');
    expect(parsed.vista).toBe('');

    const params = new URLSearchParams('mes=2026-11&q=hola');
    writeFiltersToParams(DEFAULT_FILTERS, params);
    expect(params.get('mes')).toBe('2026-11');
    expect(params.has('q')).toBe(false);
  });

  it('hasActiveFilters ignora orden y agrupación', () => {
    expect(hasActiveFilters(withFilters({ sort: 'titulo', group: 'dia' }))).toBe(false);
    expect(hasActiveFilters(withFilters({ q: ' x ' }))).toBe(true);
  });
});

describe('applyFilters', () => {
  const pubs = [
    makePub({ titulo: 'Gluten Free', campana_id: 'camp-1', linea_contenido: 'Ofertas, Evento', social_account_ids: ['ig'], estatus: 'APROBADO' }),
    makePub({ titulo: 'Al mayor', requiere_diseno: false, requiere_rodaje: true, sedes: ['PREBO'], social_account_ids: ['tt'] }),
    makePub({ titulo: 'Inauguración', estatus: 'EN_DISENO', linea_contenido: 'Evento' }),
  ];

  it('busca sin distinguir acentos ni mayúsculas, incluyendo la campaña', () => {
    expect(applyFilters(pubs, withFilters({ q: 'inauguracion' }), ctx)).toHaveLength(1);
    expect(applyFilters(pubs, withFilters({ q: 'NOVIEMBRE' }), ctx).map((p) => p.titulo)).toEqual(['Gluten Free']);
  });

  it('combina campaña, tema, cuenta, diseño y rodaje', () => {
    expect(applyFilters(pubs, withFilters({ campana: 'none' }), ctx)).toHaveLength(2);
    expect(applyFilters(pubs, withFilters({ campana: 'camp-1' }), ctx)).toHaveLength(1);
    expect(applyFilters(pubs, withFilters({ tema: 'Evento' }), ctx)).toHaveLength(2);
    expect(applyFilters(pubs, withFilters({ cuenta: 'tt' }), ctx).map((p) => p.titulo)).toEqual(['Al mayor']);
    expect(applyFilters(pubs, withFilters({ diseno: 'no' }), ctx)).toHaveLength(1);
    expect(applyFilters(pubs, withFilters({ rodaje: 'PREBO' }), ctx)).toHaveLength(1);
    expect(applyFilters(pubs, withFilters({ rodaje: 'MANONGO' }), ctx)).toHaveLength(0);
  });

  it('"necesita mi acción" excluye lo que espera a otros', () => {
    expect(needsMyAction({ estatus: 'EN_DISENO', fecha_publicacion: '2026-11-10' }, '2026-11-05')).toBe(false);
    expect(needsMyAction({ estatus: 'PROGRAMADO', fecha_publicacion: '2026-11-10' }, '2026-11-05')).toBe(false);
    expect(needsMyAction({ estatus: 'PROGRAMADO', fecha_publicacion: '2026-11-05' }, '2026-11-05')).toBe(true);
    expect(applyFilters(pubs, withFilters({ accion: true }), ctx)).toHaveLength(2);
  });
});

describe('sortPublicaciones', () => {
  it('desempata por hora y luego de forma determinista', () => {
    const a = makePub({ titulo: 'A', fecha_publicacion: '2026-11-02', hora_publicacion: '15:00' });
    const b = makePub({ titulo: 'B', fecha_publicacion: '2026-11-02', hora_publicacion: '09:00' });
    const c = makePub({ titulo: 'C', fecha_publicacion: '2026-11-02' });
    const d = makePub({ titulo: 'D', fecha_publicacion: '2026-11-01' });
    expect(sortPublicaciones([a, b, c, d], 'fecha', 'asc').map((p) => p.titulo)).toEqual(['D', 'B', 'A', 'C']);
    expect(sortPublicaciones([c, b, a, d], 'fecha', 'asc').map((p) => p.titulo)).toEqual(['D', 'B', 'A', 'C']);
    expect(sortPublicaciones([a, b, c, d], 'fecha', 'desc').map((p) => p.titulo)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('ordena por prioridad (alta primero), etapa y título', () => {
    const baja = makePub({ titulo: 'Zeta', prioridad: 3, estatus: 'PUBLICADO' });
    const alta = makePub({ titulo: 'Ángel', prioridad: 1, estatus: 'PENDIENTE_BRIEF' });
    const normal = makePub({ titulo: 'Beto', prioridad: 2, estatus: 'APROBADO' });
    expect(sortPublicaciones([baja, alta, normal], 'prioridad', 'asc').map((p) => p.titulo)).toEqual(['Ángel', 'Beto', 'Zeta']);
    expect(sortPublicaciones([baja, alta, normal], 'etapa', 'asc').map((p) => p.titulo)).toEqual(['Ángel', 'Beto', 'Zeta']);
    expect(sortPublicaciones([baja, normal, alta], 'titulo', 'asc').map((p) => p.titulo)).toEqual(['Ángel', 'Beto', 'Zeta']);
  });
});

describe('groupPublicaciones', () => {
  const options = { campanaNombrePorId: ctx.campanaNombrePorId, sort: 'titulo' as const, dir: 'asc' as const };

  it('agrupa por día y por semana en orden cronológico aunque el orden sea otro', () => {
    const items = [
      makePub({ titulo: 'B', fecha_publicacion: '2026-11-10' }),
      makePub({ titulo: 'A', fecha_publicacion: '2026-11-03' }),
      makePub({ titulo: 'C', fecha_publicacion: '2026-11-03' }),
    ];
    expect(groupPublicaciones(items, 'dia', options).map((g) => [g.key, g.items.length])).toEqual([['2026-11-03', 2], ['2026-11-10', 1]]);
    expect(groupPublicaciones(items, 'semana', options).map((g) => g.key)).toEqual(['2026-11-02', '2026-11-09']);
  });

  it('pone "Sin campaña" al final y ordena los estados por etapa', () => {
    const items = [
      makePub({ campana_id: null, estatus: 'PUBLICADO' }),
      makePub({ campana_id: 'camp-1', estatus: 'PENDIENTE_BRIEF' }),
    ];
    expect(groupPublicaciones(items, 'campana', options).map((g) => g.label)).toEqual(['Ofertas Noviembre', 'Sin campaña']);
    expect(groupPublicaciones(items, 'estado', options).map((g) => g.key)).toEqual(['PENDIENTE_BRIEF', 'PUBLICADO']);
  });

  it('sin agrupar devuelve un único grupo, y ninguno si no hay elementos', () => {
    expect(groupPublicaciones([makePub()], 'ninguno', options)).toHaveLength(1);
    expect(groupPublicaciones([], 'ninguno', options)).toEqual([]);
  });
});
