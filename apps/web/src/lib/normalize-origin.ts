const TRAILING_SLASHES_REGEX = /\/+$/;

/**
 * Trim trailing slashes from a URL origin or already-resolved base URL.
 *
 * @example
 * normalizeOrigin('https://usebaci.com/') // 'https://usebaci.com'
 *
 * @param origin URL origin or base URL string to normalize.
 * @returns The input string with trailing slashes removed.
 */
export function normalizeOrigin(origin: string): string {
  return origin.replace(TRAILING_SLASHES_REGEX, '');
}
