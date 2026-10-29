import type { Database } from '@/types/database.types';
import type { DesignRequest } from './designRequests';
import { formatDesignDate } from './designSla';

export type LegacyDesignHistoryRow = Pick<
  Database['public']['Tables']['design_solicitudes_historicas']['Row'],
  | 'id'
  | 'title'
  | 'source_timestamp'
  | 'due_date'
  | 'objective'
  | 'publication_request'
  | 'designer_name_raw'
  | 'requester_name_raw'
  | 'priority_raw'
  | 'status_raw'
  | 'completed_at'
  | 'department_raw'
  | 'reference_url'
  | 'print_request'
  | 'area_raw'
  | 'design_quantity_raw'
  | 'medium_raw'
  | 'pieces_quantity_raw'
  | 'publication_details_2'
  | 'print_details_2'
  | 'material'
  | 'dimensions'
>;

export type LegacyDesignHistoryRequest = LegacyDesignHistoryRow & { source: 'LEGACY' };

export type UnifiedHistoryEntry =
  | { source: 'OPERATIONAL'; request: DesignRequest }
  | LegacyDesignHistoryRequest;

export type HistoryFilter = 'ALL' | 'DELIVERED' | 'CANCELLED' | 'LEGACY';

export function adaptLegacyDesignHistory(row: LegacyDesignHistoryRow): LegacyDesignHistoryRequest {
  return { ...row, source: 'LEGACY' };
}

export function filterHistoryEntries(entries: UnifiedHistoryEntry[], filter: HistoryFilter) {
  return entries.filter((entry) => {
    if (filter === 'ALL') return true;
    if (filter === 'LEGACY') return entry.source === 'LEGACY';
    if (entry.source === 'LEGACY') return false;
    return filter === 'CANCELLED'
      ? entry.request.design_status === 'CANCELLED'
      : entry.request.design_status !== 'CANCELLED';
  });
}

function historyTimestamp(entry: UnifiedHistoryEntry) {
  return entry.source === 'LEGACY'
    ? entry.source_timestamp
    : entry.request.history_at ?? entry.request.delivered_at ?? entry.request.requested_at;
}

function historyKey(entry: UnifiedHistoryEntry) {
  return entry.source === 'LEGACY' ? `LEGACY:${entry.id}` : entry.request.request_id;
}

export function sortUnifiedHistoryEntries(entries: UnifiedHistoryEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTimestamp = Date.parse(historyTimestamp(left) ?? '');
    const rightTimestamp = Date.parse(historyTimestamp(right) ?? '');
    const leftValid = Number.isFinite(leftTimestamp);
    const rightValid = Number.isFinite(rightTimestamp);
    if (leftValid && rightValid && leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
    if (leftValid !== rightValid) return leftValid ? -1 : 1;
    return historyKey(left).localeCompare(historyKey(right));
  });
}

function validDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  return new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function formatHistoryDate(value: string | null | undefined) {
  if (!value || !validDate(value)) return 'Sin dato';
  return formatDesignDate(value, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function safeHistoryReferenceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
