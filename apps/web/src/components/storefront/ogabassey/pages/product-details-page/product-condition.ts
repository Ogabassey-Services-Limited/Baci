export type ConditionType = 'new' | 'used' | 'open_box' | 'refurbished';

const CONDITION_LABELS: Record<ConditionType, string> = {
  new: 'New',
  used: 'Premium Used',
  open_box: 'Open Box',
  refurbished: 'Refurbished',
};

export function normalizeConditionType(
  condition?: string | null
): ConditionType {
  const normalized = condition?.toLowerCase().trim().replace(/\s+/g, '_');

  if (
    normalized === 'new' ||
    normalized === 'used' ||
    normalized === 'open_box' ||
    normalized === 'refurbished'
  ) {
    return normalized;
  }

  return 'new';
}

export function formatConditionLabel(condition?: string | null): string {
  return CONDITION_LABELS[normalizeConditionType(condition)];
}
