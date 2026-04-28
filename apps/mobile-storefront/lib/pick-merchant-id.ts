/**
 * Pick the first candidate that looks like a real merchant id.
 *
 * `??` is not enough at the call sites that need this: the auth store
 * can return an empty string before merchant context loads, which would
 * skip a downstream config fallback and let an empty value reach a
 * NOT NULL DB column. This helper trims and rejects empty/whitespace,
 * returning `null` only when no candidate qualifies.
 */
export function pickMerchantId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
