const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:2f|5c)/i;

/**
 * Validates a wallet "return to your purchase" destination as a safe internal
 * path: single-slash-rooted, no protocol-relative `//`, no backslashes, no
 * traversal segments, and no encoded path separators before OR after one
 * decode. Mirrors the mobile-storefront sanitizer so the server persists only
 * values the app would accept (mobile keeps an expo-router-typed copy in
 * `apps/mobile-storefront/lib/sanitize-wallet-return-to.ts`).
 */
export function sanitizeWalletReturnToPath(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (ENCODED_PATH_SEPARATOR_PATTERN.test(value)) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }

  if (ENCODED_PATH_SEPARATOR_PATTERN.test(decoded)) {
    return undefined;
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    decoded.includes('/../') ||
    decoded.includes('/./') ||
    decoded.endsWith('/..') ||
    decoded.endsWith('/.')
  ) {
    return undefined;
  }

  return value;
}
