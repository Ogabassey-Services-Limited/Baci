/**
 * Classifies a raw provider status string as "clean"/safe vs "flagged"/danger,
 * for cleanAware result cards. Ported verbatim from the mobile checker
 * (apps/mobile-storefront/components/imei-check/is-status-clean.ts) so both
 * clients render the same provider vocabulary identically.
 */
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
    // Inactive/negated lock statuses (Knox Guard, MDM) — treated as safe.
    'not active',
    'inactive',
    'not locked',
    'no lock',
  ]);
  return directMatches.has(normalized) || /\bclean\b/.test(normalized);
}
