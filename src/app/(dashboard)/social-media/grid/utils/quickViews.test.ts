import { computeIndicators, matchesQuickView } from './quickViews';
import { makePub } from './testFactory';

const TODAY = '2026-11-05';

describe('matchesQuickView', () => {
  it('brief-vencido solo cuenta piezas con diseño y brief aún abierto', () => {
    expect(matchesQuickView(makePub({ fecha_limite_brief: '2026-11-01' }), 'brief-vencido', TODAY)).toBe(true);
    expect(matchesQuickView(makePub({ fecha_limite_brief: TODAY }), 'brief-vencido', TODAY)).toBe(true);
    expect(matchesQuickView(makePub({ fecha_limite_brief: '2026-11-06' }), 'brief-vencido', TODAY)).toBe(false);
    // ya solicitada a Design: el brief se entregó, no está vencido
    expect(matchesQuickView(makePub({ fecha_limite_brief: '2026-11-01', estatus: 'SOLICITADO' }), 'brief-vencido', TODAY)).toBe(false);
    // sin diseño no hay SLA de brief
    expect(matchesQuickView(makePub({ fecha_limite_brief: '2026-11-01', requiere_diseno: false }), 'brief-vencido', TODAY)).toBe(false);
  });

  it('ignora piezas publicadas o canceladas en todas las vistas', () => {
    for (const estatus of ['PUBLICADO', 'CANCELADO'] as const) {
      const pub = makePub({ estatus, fecha_publicacion: TODAY, fecha_limite_brief: '2026-11-01' });
      expect(matchesQuickView(pub, 'brief-vencido', TODAY)).toBe(false);
      expect(matchesQuickView(pub, 'hoy', TODAY)).toBe(false);
    }
  });

  it('sin-copy mira los próximos 7 días y no aplica a Stories', () => {
    const base = { fecha_publicacion: '2026-11-08' };
    expect(matchesQuickView(makePub(base), 'sin-copy', TODAY)).toBe(true);
    expect(matchesQuickView(makePub({ ...base, formato: 'STORY' }), 'sin-copy', TODAY)).toBe(false);
    expect(matchesQuickView(makePub({ ...base, body_texto: 'Texto' }), 'sin-copy', TODAY)).toBe(false);
    expect(matchesQuickView(makePub({ fecha_publicacion: '2026-11-13' }), 'sin-copy', TODAY)).toBe(false);
    expect(matchesQuickView(makePub({ fecha_publicacion: '2026-11-04' }), 'sin-copy', TODAY)).toBe(false);
  });
});

describe('computeIndicators', () => {
  it('separa vencidos de los que vencen hoy y cuenta cada vista', () => {
    const result = computeIndicators(
      [
        makePub({ fecha_limite_brief: '2026-11-01' }),
        makePub({ fecha_limite_brief: '2026-11-02' }),
        makePub({ fecha_limite_brief: TODAY }),
        makePub({ estatus: 'EN_REVISION_CM', fecha_limite_brief: '2026-11-01' }),
        makePub({ estatus: 'PENDIENTE_APROBACION_GERENCIA' }),
      ],
      TODAY,
    );
    expect(result.briefVencidos).toBe(2);
    expect(result.briefHoy).toBe(1);
    expect(result.porRevisar).toBe(1);
    expect(result.porAprobar).toBe(1);
  });
});
