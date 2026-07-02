export function isStatusClean(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes('not clean')) {
    return false;
  }

  const directMatches = new Set([
    'clean',
    'not found',
    'off',
    'unlocked',
    // Benign GSX repair/replacement history values (cleanAware cards).
    'no repairs',
    'no repair',
    'no cases',
    'no case',
    'not replaced',
    'original',
    'none',
    // Inactive/negated lock statuses (Knox Guard, MDM) — the parser treats
    // these as safe, so the card must render clean, not danger.
    'not active',
    'inactive',
    'not locked',
    'no lock',
  ]);
  return directMatches.has(normalized) || /\bclean\b/.test(normalized);
}
