import { adaptEventDetail, adaptInternalDetail, adaptPublicationDetail } from './detailAdapters';

describe('detail adapters', () => {
  it('normalizes common publication data and its own context', () => {
    const detail = adaptPublicationDetail({ id: 'p1', titulo: 'Post', formato: 'REEL', creador_id: 'u1', estatus: 'EN_DISENO', fecha_publicacion: '2026-10-28', hook_texto: 'Hook' }, ['INSTAGRAM']);
    expect(detail.requested_by).toBe('u1');
    expect(detail.context).toEqual({ source: 'SOCIAL_MEDIA', format: 'REEL', channels: ['INSTAGRAM'], publication_date: '2026-10-28' });
    expect(detail).not.toHaveProperty('context.store');
  });

  it('preserves Story copy and maps numeric priority', () => {
    const detail = adaptPublicationDetail({ id: 'p2', titulo: 'Story', formato: 'STORY', estatus: 'SOLICITADO', prioridad: 1, hook_texto: 'Texto story' }, ['INSTAGRAM']);
    expect(detail.copy?.hook).toBe('Texto story');
    expect(detail.priority).toBe('HIGH');
    expect(detail.requested_outputs.some((output) => output.label === 'INSTAGRAM')).toBe(false);
  });

  it('keeps Internal context isolated from Social Media fields', () => {
    const detail = adaptInternalDetail({ id: 'i1', titulo: 'Impresión', tipo: 'IMPRESION', sede_nombre: 'Prebo', cantidad: 3, fecha_requerida: '2026-10-30', diseno_estatus: 'EN_DISENO' });
    expect(detail.context).toEqual({ source: 'INTERNAL', task_type: 'IMPRESION', store: 'Prebo', quantity: 3, needed_by: '2026-10-30' });
    expect(detail.copy).toBeNull();
    expect(detail.context).not.toHaveProperty('channels');
  });

  it('exposes an Internal correction and reopen capability', () => {
    const detail = adaptInternalDetail({ id: 'i2', titulo: 'Corrección', tipo: 'IMPRESION', sede_nombre: 'Prebo', diseno_estatus: 'EN_CORRECCION' }, {
      canStart: true, history: [{ at: '2026-10-20T12:00:00Z', label: 'EN_CORRECCION', note: 'Ajustar el tamaño' }],
    });
    expect(detail.correction).toEqual({ at: '2026-10-20T12:00:00Z', text: 'Ajustar el tamaño' });
    expect(detail.capabilities.canReopen).toBe(true);
  });

  it('keeps Event context and copy absent', () => {
    const detail = adaptEventDetail({ id: 'e1', nombre: 'Feria', inicio: '2026-10-30T16:00:00Z', sedes: [{ nombre: 'Prebo' }], diseno_formatos: ['DIGITAL'], diseno_estatus: 'SOLICITADO' });
    expect(detail.context).toEqual({ source: 'EVENTS', event_name: 'Feria', stores: ['Prebo'], starts_at: '2026-10-30T16:00:00Z', ends_at: null, formats: ['DIGITAL'] });
    expect(detail.copy).toBeNull();
    expect(detail.context).not.toHaveProperty('task_type');
  });
});
