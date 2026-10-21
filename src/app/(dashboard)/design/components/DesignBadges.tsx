import { AlertCircle, CircleHelp, Clock3 } from 'lucide-react';
import type { DesignSource, DesignStatus } from '@/lib/designRequests';
import { DESIGN_SOURCE_LABELS, DESIGN_STATUS_LABELS } from '@/lib/design/designLabels';
import { getDesignDueLabel, getDesignDueTone, getDesignSlaOutcome } from '@/lib/designSla';

const statusTones: Record<DesignStatus, string> = {
  REQUESTED: 'bg-[#E6F0FB] text-[#002F80]',
  IN_PROGRESS: 'bg-[#E0F4FD] text-[#05526F]',
  NEEDS_CHANGES: 'bg-[#FDEBD0] text-[#7A3E00]',
  DELIVERED: 'bg-[#E3F5EC] text-[#0B6B3F]',
  CANCELLED: 'bg-[#EFEDE8] text-[#3C4663]',
};

const dueTones = {
  late: 'border-[#F0B5B0] bg-[#FDE8E6] text-[#A5281B]',
  soon: 'border-[#F0C98A] bg-[#FDEBD0] text-[#7A3E00]',
  neutral: 'border-[#D2CCC0] bg-[#F3F0E9] text-[#3C4663]',
};

export function DesignStatusBadge({ status }: { status: DesignStatus }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTones[status]}`}>{DESIGN_STATUS_LABELS[status]}</span>;
}

export function OriginChip({ source }: { source: DesignSource }) {
  return <span className="inline-flex min-h-6 items-center rounded-full bg-[#F3F0E9] px-2.5 py-0.5 text-xs font-semibold text-[#3C4663]">{DESIGN_SOURCE_LABELS[source]}</span>;
}

export function DueBadge({ estimate, today }: { estimate: string | null; today: string }) {
  const tone = getDesignDueTone(estimate, today);
  const Icon = tone === 'late' ? AlertCircle : tone === 'soon' ? Clock3 : CircleHelp;
  return <span className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${dueTones[tone]}`}><Icon size={13}/>{getDesignDueLabel(estimate, today)}</span>;
}

export function SlaPill({ estimate, delivered, cancelled }: { estimate: string | null; delivered: string | null; cancelled: boolean }) {
  if (cancelled) return <span className="text-[#5E6680]">—</span>;
  const outcome = getDesignSlaOutcome(estimate, delivered);
  if (outcome === '—') return <span className="text-[#5E6680]">—</span>;
  const onTime = outcome === 'A tiempo';
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${onTime ? 'bg-[#E3F5EC] text-[#0B6B3F]' : 'bg-[#FDE8E6] text-[#A5281B]'}`}>{outcome}</span>;
}
