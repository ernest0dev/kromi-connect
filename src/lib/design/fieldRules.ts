import type { DesignRequestDetail } from '@/lib/designRequests';

export type DetailFieldRule = {
  id: 'correction' | 'copy';
  applies: (detail: DesignRequestDetail) => boolean;
  hasContent: (detail: DesignRequestDetail) => boolean;
  missingWhen?: (detail: DesignRequestDetail) => boolean;
};

export const detailFieldRules: DetailFieldRule[] = [
  { id: 'correction', applies: (d) => d.context.source === 'SOCIAL_MEDIA', hasContent: (d) => !!d.correction?.text },
  {
    id: 'copy', applies: (d) => d.context.source === 'SOCIAL_MEDIA',
    hasContent: (d) => !!d.copy && Object.values(d.copy).some((v) => Array.isArray(v) ? v.length > 0 : !!v?.toString().trim()),
    missingWhen: (d) => d.context.source === 'SOCIAL_MEDIA' && d.context.format !== 'STORY',
  },
];

export function shouldRenderDetailField(ruleId: DetailFieldRule['id'], detail: DesignRequestDetail) {
  const rule = detailFieldRules.find((item) => item.id === ruleId)!;
  return rule.applies(detail) && (rule.hasContent(detail) || !!rule.missingWhen?.(detail));
}
