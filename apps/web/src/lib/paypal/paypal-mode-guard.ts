import type { PayPalLink, PayPalMode } from './paypal-types';

/**
 * Maps a PayPal API host to the environment that serves it. This is the one
 * signal PayPal responses expose that is under PayPal's control rather than
 * ours: every Orders v2 resource (order-creation response, and the order
 * resource returned by capture/get) carries a `links[]` array whose `self`
 * link points back at the host that produced it. Unlike Klump (which returns
 * an explicit `is_live` boolean we can trust outright), PayPal has no such
 * flag on Orders v2 responses, so the self-link host is the most reliable
 * field available without an extra round trip.
 */
const PAYPAL_HOST_MODE: Record<string, PayPalMode> = {
  'api-m.paypal.com': 'live',
  'api-m.sandbox.paypal.com': 'sandbox',
};

/**
 * Determines which PayPal environment actually produced a response, from its
 * HATEOAS links. Returns `'unknown'` when no links are present or the host
 * isn't a recognized PayPal API host (e.g. a malformed/mocked response) —
 * callers implementing the Phase 2 "hard-reject mode mismatches" policy
 * should treat `'unknown'` as its own fail-closed case rather than treating
 * only a positive mismatch as unsafe.
 */
export function detectPayPalResponseMode(
  links: readonly Pick<PayPalLink, 'href' | 'rel'>[] | null | undefined
): PayPalMode | 'unknown' {
  if (!links || links.length === 0) {
    return 'unknown';
  }

  const selfLink = links.find((link) => link.rel === 'self') ?? links[0];

  try {
    const host = new URL(selfLink.href).host;
    return PAYPAL_HOST_MODE[host] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
