const LEGACY_ORDER_NUMBER_PATTERN = /^\d{8}$/;

export function getOrderNumberLookupCandidates(input: string): string[] {
  const normalized = input.trim().replace(/\s+/g, '').toUpperCase();

  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([normalized]);
  const withoutHash = normalized.replace(/^#/, '');

  if (normalized.startsWith('#')) {
    candidates.add(withoutHash);
  } else if (LEGACY_ORDER_NUMBER_PATTERN.test(withoutHash)) {
    candidates.add(`#${withoutHash}`);
  }

  return Array.from(candidates).filter((candidate) => candidate.length > 0);
}
