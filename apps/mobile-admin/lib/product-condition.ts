const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  new_and_used: 'New & Used',
  'new_&_used': 'New & Used',
  open_box: 'Open Box',
  refurbished: 'Refurbished',
  uk_used: 'UK Used',
  used: 'Used',
};

export function formatProductCondition(
  condition?: string | null
): string | null {
  const normalized = condition
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) {
    return null;
  }

  return (
    CONDITION_LABELS[normalized] ??
    normalized
      .split('_')
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' ')
  );
}
