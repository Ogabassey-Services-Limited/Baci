export function isStatusClean(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes('not clean')) {
    return false;
  }

  const directMatches = new Set(['clean', 'not found', 'off', 'unlocked']);
  return directMatches.has(normalized) || /\bclean\b/.test(normalized);
}
