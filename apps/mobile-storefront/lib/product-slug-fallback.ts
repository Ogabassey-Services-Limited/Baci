const CONDITION_SUFFIXES = [
  'new-open-box',
  'open-box',
  'premium-used',
  'uk-used',
  'refurbished',
  'used',
  'new',
] as const;

const CAPACITY_SUFFIX = /-\d+(?:gb|tb)$/i;

function stripKnownSuffix(slug: string): string | null {
  for (const suffix of CONDITION_SUFFIXES) {
    const token = `-${suffix}`;
    if (slug.endsWith(token)) {
      return slug.slice(0, -token.length);
    }
  }

  if (CAPACITY_SUFFIX.test(slug)) {
    return slug.replace(CAPACITY_SUFFIX, '');
  }

  return null;
}

export function getProductSlugFallbackCandidates(slug: string): string[] {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return [];

  const candidates: string[] = [];
  const seen = new Set<string>([normalized]);
  let current = normalized;

  while (true) {
    const next = stripKnownSuffix(current);
    if (!next || seen.has(next)) {
      break;
    }

    candidates.push(next);
    seen.add(next);
    current = next;
  }

  return candidates;
}
