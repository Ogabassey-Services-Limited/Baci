import { sanitizeWalletReturnToPath } from './sanitize-wallet-return-to';

/** The only flows a wallet-credit push is allowed to resume. */
const RESUMABLE_STATIC_PATHNAMES = new Set(['/checkout', '/imei-check']);
/** Mirrors `ValidUtilityType` in apps/mobile-storefront. */
const RESUMABLE_UTILITY_TYPES = new Set([
  'airtime',
  'data',
  'tv',
  'power',
  'gaming',
]);
const UTILITY_PATHNAME_PATTERN = /^\/utilities\/([a-z]+)$/;
const ORDER_PATHNAME_PATTERN =
  /^\/orders\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Any query/fragment parameter that a downstream screen could itself follow
 * (e.g. `/auth/callback?returnTo=//evil.com`), which would turn an accepted
 * internal path into an open-redirect chain.
 */
const NESTED_REDIRECT_PARAM_PATTERN =
  /[?&#](?:returnto|return_to|redirect|redirect_uri|redirect_to|next|url|continue)=/i;

function isResumablePathname(pathname: string): boolean {
  if (
    RESUMABLE_STATIC_PATHNAMES.has(pathname) ||
    ORDER_PATHNAME_PATTERN.test(pathname)
  ) {
    return true;
  }
  const utilityType = UTILITY_PATHNAME_PATTERN.exec(pathname)?.[1];
  return utilityType ? RESUMABLE_UTILITY_TYPES.has(utilityType) : false;
}

/**
 * Strict allowlist for wallet-credit push deep links, layered on top of the
 * generic internal-path sanitizer.
 *
 * The generic sanitizer only proves the OUTER value is an internal path, which
 * is not enough for a value that arrives from a push payload and is navigated
 * to on tap: an internal redirector (`/auth/callback?returnTo=//evil.com`) is a
 * valid internal path yet hands control to an attacker-chosen destination. So
 * this predicate additionally requires the destination to be one of the three
 * genuinely resumable purchase flows (`/checkout`, `/imei-check`,
 * `/utilities/<airtime|data|tv|power|gaming>`, or a UUID-scoped order detail)
 * and rejects any value carrying a
 * nested redirect parameter, checked on both the raw and the once-decoded form.
 *
 * Applied on the server persist path (wallet top-up initialize) so a hostile
 * value never reaches transaction metadata, and again on the mobile tap path
 * before navigation — defence in depth.
 */
export function sanitizeResumableWalletReturnTo(
  value: unknown
): string | undefined {
  const safePath = sanitizeWalletReturnToPath(value);
  if (safePath === undefined) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(safePath);
  } catch {
    return undefined;
  }

  if (
    NESTED_REDIRECT_PARAM_PATTERN.test(safePath) ||
    NESTED_REDIRECT_PARAM_PATTERN.test(decoded) ||
    safePath.includes('#') ||
    decoded.includes('#')
  ) {
    return undefined;
  }

  // Both forms must resolve to an allowlisted pathname: the raw form is what is
  // actually navigated to, the decoded form is what the router resolves it to.
  const rawPathname = safePath.split('?')[0] ?? '';
  const decodedPathname = decoded.split('?')[0] ?? '';
  if (
    !(isResumablePathname(rawPathname) && isResumablePathname(decodedPathname))
  ) {
    return undefined;
  }

  return safePath;
}
