import { renderToStaticMarkup } from 'react-dom/server';
import { adaptPublication } from './designRequests';
import {
  adaptLegacyDesignHistory,
  filterHistoryEntries,
  formatHistoryDate,
  safeHistoryReferenceUrl,
  sortUnifiedHistoryEntries,
  type LegacyDesignHistoryRow,
  type UnifiedHistoryEntry,
} from './designHistory';
import { UnifiedHistoryView } from '../app/(dashboard)/design/publications/history/UnifiedHistoryView';

const legacyRow: LegacyDesignHistoryRow = {
  id: 41,
  title: 'Campaña histórica',
  source_timestamp: '2020-04-15T12:00:00Z',
  due_date: '2020-04-20',
  objective: 'Informar sobre la campaña',
  publication_request: 'Instagram',
  designer_name_raw: 'Diseñadora histórica',
  requester_name_raw: 'Solicitante histórico',
  priority_raw: 'Urgente',
  status_raw: 'Solicitud Incompleta',
  completed_at: null,
  department_raw: 'Mercadeo',
  reference_url: 'https://example.com/brief',
  print_request: 'Volante',
  area_raw: 'Comunicaciones',
  design_quantity_raw: null,
  medium_raw: 'Digital',
  pieces_quantity_raw: '3 piezas',
  publication_details_2: null,
  print_details_2: null,
  material: null,
  dimensions: null,
};

function historyEntries(): UnifiedHistoryEntry[] {
  const operational = adaptPublication({ id: 'publication-1', titulo: 'Publicación activa', estatus: 'EN_REVISION_CM' });
  const cancelled = { ...adaptPublication({ id: 'publication-2', titulo: 'Publicación cancelada', estatus: 'CANCELADO' }), design_status: 'CANCELLED' as const };
  return [
    { source: 'OPERATIONAL', request: operational },
    { source: 'OPERATIONAL', request: cancelled },
    adaptLegacyDesignHistory(legacyRow),
  ];
}

describe('Design history', () => {
  it('keeps the original status and never maps it into an operational status', () => {
    const entry = adaptLegacyDesignHistory(legacyRow);
    expect(entry.source).toBe('LEGACY');
    expect(entry.status_raw).toBe('Solicitud Incompleta');
    expect(entry).not.toHaveProperty('design_status');
  });

  it('keeps legacy rows out of operational filters while exposing a legacy filter', () => {
    const entries = historyEntries();
    expect(filterHistoryEntries(entries, 'ALL')).toHaveLength(3);
    expect(filterHistoryEntries(entries, 'DELIVERED').map((entry) => entry.source)).toEqual(['OPERATIONAL']);
    expect(filterHistoryEntries(entries, 'CANCELLED').map((entry) => entry.source)).toEqual(['OPERATIONAL']);
    expect(filterHistoryEntries(entries, 'LEGACY')).toEqual([entries[2]]);
  });

  it('sorts by historic request timestamp and places missing or invalid dates last', () => {
    const entries: UnifiedHistoryEntry[] = [
      adaptLegacyDesignHistory({ ...legacyRow, id: 3, source_timestamp: null }),
      adaptLegacyDesignHistory({ ...legacyRow, id: 1, source_timestamp: '2020-04-15T12:00:00Z' }),
      adaptLegacyDesignHistory({ ...legacyRow, id: 2, source_timestamp: 'not-a-date' }),
    ];
    expect(sortUnifiedHistoryEntries(entries).map((entry) => entry.source === 'LEGACY' ? entry.id : entry.request.request_id))
      .toEqual([1, 2, 3]);
  });

  it('formats absent and invalid dates as a neutral value', () => {
    expect(formatHistoryDate(null)).toBe('Sin dato');
    expect(formatHistoryDate('not-a-date')).toBe('Sin dato');
    expect(formatHistoryDate('2026-02-30')).toBe('Sin dato');
    expect(formatHistoryDate('2026-02-28')).not.toBe('Sin dato');
  });

  it('offers only HTTP and HTTPS external references', () => {
    expect(safeHistoryReferenceUrl('https://example.com/brief')).toBe('https://example.com/brief');
    expect(safeHistoryReferenceUrl('javascript:alert(1)')).toBeNull();
    expect(safeHistoryReferenceUrl('not a url')).toBeNull();
  });

  it('renders legacy rows as read-only with original status and no operational detail link', () => {
    const markup = renderToStaticMarkup(
      <UnifiedHistoryView entries={historyEntries()} page={1} hasNextPage={false}/>,
    );
    const titleIndex = markup.indexOf('Campaña histórica');
    const rowStart = markup.lastIndexOf('<tr', titleIndex);
    const rowEnd = markup.indexOf('</tr>', titleIndex) + '</tr>'.length;
    const legacyRowMarkup = markup.slice(rowStart, rowEnd);

    expect(markup).toContain('Solicitud Incompleta');
    expect(markup).toContain('Diseñadora histórica');
    expect(markup).toContain('Campaña histórica');
    expect(markup).toContain('Abrir referencia externa');
    expect(legacyRowMarkup).not.toContain('/design/requests/');
    expect(markup).toContain('/design/requests/social_media/publication-1');
  });
});
