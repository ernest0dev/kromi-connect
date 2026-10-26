import type { ReactElement } from 'react';
import { requirePermission } from '@/lib/auth/dal';
import type { UnifiedHistoryEntry } from '@/lib/designHistory';
import DesignHistoryPage from './page';

jest.mock('@/lib/auth/dal', () => ({ requirePermission: jest.fn() }));

const mockPublication = {
  id: 'publication-1',
  titulo: 'Solicitud operativa',
  estatus: 'EN_REVISION_CM',
  fecha_solicitud_diseno: '2021-04-15T12:00:00Z',
};
const mockLegacy = {
  id: 41,
  title: 'Solicitud del Excel',
  source_timestamp: '2020-04-15T12:00:00Z',
  due_date: '2020-04-20',
  objective: null,
  publication_request: null,
  designer_name_raw: 'Diseñadora histórica',
  requester_name_raw: null,
  priority_raw: null,
  status_raw: 'Por aprobar',
  completed_at: null,
  department_raw: null,
  reference_url: null,
  print_request: null,
  area_raw: null,
  design_quantity_raw: null,
  medium_raw: null,
  pieces_quantity_raw: null,
  publication_details_2: null,
  print_details_2: null,
  material: null,
  dimensions: null,
};

const mockRequirePermission = requirePermission as jest.MockedFunction<typeof requirePermission>;

function makePageSupabase(
  legacyResult: { data: typeof mockLegacy[] | null; error: { message: string } | null } = { data: [mockLegacy], error: null },
  rpcError = false,
) {
  const rpc = jest.fn(async (name: string, args: { p_offset?: number } = {}) => {
    if (rpcError && name === 'get_design_event_history') {
      return { data: null, error: { message: 'sensitive database internals' } };
    }
    if (name === 'get_design_publication_history') {
      const pageId = args.p_offset === 100 ? 'publication-2' : mockPublication.id;
      return { data: [{ ...mockPublication, id: pageId }], error: null };
    }
    return { data: [], error: null };
  });
  const builder = {
    select: jest.fn(),
    order: jest.fn(),
    range: jest.fn(async (start: number) => start === 0 ? legacyResult : { data: [], error: null }),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  const supabase = { rpc, from: jest.fn(() => builder) };
  mockRequirePermission.mockResolvedValue({ supabase } as unknown as Awaited<ReturnType<typeof requirePermission>>);
  return { rpc, builder, supabase };
}

describe('Design history page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('combines all operational history RPCs with read-only historical rows', async () => {
    const { rpc, builder, supabase } = makePageSupabase();
    const page = await DesignHistoryPage({ searchParams: Promise.resolve({ page: '1' }) });
    const view = page.props.children as ReactElement<{ entries: UnifiedHistoryEntry[] }>;
    const entries = view.props.entries;

    expect(mockRequirePermission).toHaveBeenCalledWith('design.requests.read');
    expect(supabase.from).toHaveBeenCalledWith('design_solicitudes_historicas');
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('raw_payload'));
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('requester_email'));
    expect(builder.order).toHaveBeenNthCalledWith(1, 'source_timestamp', { ascending: false, nullsFirst: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(builder.range).toHaveBeenCalledWith(0, 99);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining([
      'get_design_publication_history',
      'get_design_internal_history',
      'get_design_event_history',
      'get_design_publication_channels',
      'get_publication_designer_names',
    ]));
    expect(entries.map((entry) => entry.source)).toEqual(['OPERATIONAL', 'LEGACY']);
    expect(entries[0]).toMatchObject({ source: 'OPERATIONAL', request: { title: 'Solicitud operativa' } });
    expect(entries[1]).toMatchObject({ source: 'LEGACY', title: 'Solicitud del Excel', status_raw: 'Por aprobar' });
    expect(builder).not.toHaveProperty('insert');
    expect(builder).not.toHaveProperty('update');
    expect(builder).not.toHaveProperty('delete');
  });

  it('applies page offsets independently to the three RPC sources and the legacy table', async () => {
    const { rpc, builder } = makePageSupabase();
    const firstPage = await DesignHistoryPage({ searchParams: Promise.resolve({ page: '1' }) });
    const secondPage = await DesignHistoryPage({ searchParams: Promise.resolve({ page: '2' }) });

    for (const name of ['get_design_publication_history', 'get_design_internal_history', 'get_design_event_history']) {
      expect(rpc).toHaveBeenCalledWith(name, { p_limit: 100, p_offset: 0 });
      expect(rpc).toHaveBeenCalledWith(name, { p_limit: 100, p_offset: 100 });
    }
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 99);
    expect(builder.range).toHaveBeenNthCalledWith(2, 100, 199);

    const firstEntries = (firstPage.props.children as ReactElement<{ entries: UnifiedHistoryEntry[] }>).props.entries;
    const secondEntries = (secondPage.props.children as ReactElement<{ entries: UnifiedHistoryEntry[] }>).props.entries;
    const firstIds = firstEntries.map((entry) => entry.source === 'LEGACY' ? entry.id : entry.request.request_id);
    const secondIds = secondEntries.map((entry) => entry.source === 'LEGACY' ? entry.id : entry.request.request_id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('throws a safe message when an operational history query fails', async () => {
    makePageSupabase({ data: [], error: null }, true);

    await expect(DesignHistoryPage({ searchParams: Promise.resolve({ page: '1' }) }))
      .rejects.toThrow('No se pudo cargar el historial unificado de Diseño.');
  });

  it('throws a safe message when the legacy query fails without exposing database details', async () => {
    makePageSupabase({ data: null, error: { message: 'sensitive database internals' } });

    await expect(DesignHistoryPage({ searchParams: Promise.resolve({ page: '1' }) }))
      .rejects.toThrow('No se pudo cargar el historial unificado de Diseño.');
  });

  it('does not query any history source when permission checking fails', async () => {
    const { rpc, supabase } = makePageSupabase();
    mockRequirePermission.mockRejectedValue(new Error('not found'));

    await expect(DesignHistoryPage({ searchParams: Promise.resolve({ page: '1' }) }))
      .rejects.toThrow('not found');
    expect(rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
