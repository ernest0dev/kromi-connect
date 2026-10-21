import { DESIGN_STATUS_LABELS } from './designLabels';

describe('Design status labels', () => {
  it('uses consistent labels for new and returned requests', () => {
    expect(DESIGN_STATUS_LABELS.REQUESTED).toBe('Solicitada');
    expect(DESIGN_STATUS_LABELS.NEEDS_CHANGES).toBe('Devuelta con correcciones');
  });
});
