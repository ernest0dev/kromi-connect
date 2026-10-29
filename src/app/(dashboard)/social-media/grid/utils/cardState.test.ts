import { getDesignRequestBlocker, getNextAction, getReadiness } from './cardState';
import { makePub } from './testFactory';

const NOW = Date.parse('2026-11-05T15:00:00Z');
const fresh = new Date(NOW - 60_000).toISOString();
const stale = new Date(NOW - 10 * 60_000).toISOString();

describe('getDesignRequestBlocker', () => {
  it('explica qué falta, en orden', () => {
    expect(getDesignRequestBlocker(makePub(), NOW)).toMatch(/archivos/i);
    expect(getDesignRequestBlocker(makePub({ drive_brief_file_count: 2 }), NOW)).toMatch(/instrucciones/i);
    expect(getDesignRequestBlocker(makePub({ drive_brief_file_count: 2, instrucciones_diseno: 'Algo', drive_brief_checked_at: stale }), NOW)).toMatch(/verifica/i);
    expect(getDesignRequestBlocker(makePub({ drive_brief_file_count: 2, instrucciones_diseno: 'Algo', drive_brief_checked_at: fresh }), NOW)).toBeNull();
  });

  it('trata la hora desconocida (0) como brief sin verificar', () => {
    const pub = makePub({ drive_brief_file_count: 1, instrucciones_diseno: 'Algo', drive_brief_checked_at: fresh });
    expect(getDesignRequestBlocker(pub, 0)).toMatch(/verifica/i);
  });

  it('no bloquea cuando no requiere diseño', () => {
    expect(getDesignRequestBlocker(makePub({ requiere_diseno: false }), NOW)).toBeNull();
  });
});

describe('getNextAction', () => {
  it('sigue las mismas transiciones que el selector de estado', () => {
    expect(getNextAction(makePub(), NOW)?.status).toBe('SOLICITADO');
    expect(getNextAction(makePub({ requiere_diseno: false, requiere_rodaje: true }), NOW)?.status).toBe('EN_RODAJE');
    expect(getNextAction(makePub({ requiere_diseno: false }), NOW)?.status).toBe('PENDIENTE_APROBACION_GERENCIA');
    expect(getNextAction(makePub({ estatus: 'EN_RODAJE', requiere_diseno: false }), NOW)?.status).toBe('PENDIENTE_APROBACION_GERENCIA');
    expect(getNextAction(makePub({ estatus: 'EN_REVISION_CM' }), NOW)?.status).toBe('PENDIENTE_APROBACION_GERENCIA');
    expect(getNextAction(makePub({ estatus: 'PENDIENTE_APROBACION_GERENCIA' }), NOW)?.status).toBe('APROBADO');
    expect(getNextAction(makePub({ estatus: 'APROBADO' }), NOW)?.status).toBe('PROGRAMADO');
    expect(getNextAction(makePub({ estatus: 'PROGRAMADO' }), NOW)?.status).toBe('PUBLICADO');
  });

  it('no propone nada mientras espera a Diseño ni en estados finales', () => {
    for (const estatus of ['SOLICITADO', 'EN_DISENO', 'EN_CORRECCION', 'PUBLICADO', 'CANCELADO'] as const) {
      expect(getNextAction(makePub({ estatus }), NOW)).toBeNull();
    }
  });

  it('marca como bloqueada la solicitud a Diseño sin requisitos', () => {
    expect(getNextAction(makePub(), NOW)?.blocker).toBeTruthy();
  });
});

describe('getReadiness', () => {
  it('omite el copy en Stories y todo en estados finales', () => {
    expect(getReadiness(makePub({ formato: 'STORY', requiere_diseno: false }))).toEqual([]);
    expect(getReadiness(makePub({ estatus: 'PUBLICADO' }))).toEqual([]);
  });

  it('marca lo que falta y lo que ya está', () => {
    const items = getReadiness(makePub({ body_texto: 'Hola', requiere_rodaje: true, drive_brief_file_count: 1 }));
    const byKey = Object.fromEntries(items.map((item) => [item.key, item.ok]));
    expect(byKey).toEqual({ copy: true, brief: false, rodaje: false });
  });
});
