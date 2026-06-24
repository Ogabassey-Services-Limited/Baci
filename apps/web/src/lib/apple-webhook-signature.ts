import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify an App Store Connect webhook signature.
 *
 * Apple signs each webhook with HMAC-SHA256 over the raw request body using the
 * secret configured when the webhook is registered, and sends it in the
 * `X-Apple-Signature` header. Apple's docs don't pin the header's encoding, so
 * we accept either hex or base64 — both are derived from the same secret-keyed
 * HMAC, so accepting both does not weaken the check (an attacker still needs the
 * secret). Comparison is constant-time.
 */
export function verifyAppleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest();
  const provided = signatureHeader.trim();

  const candidates: Buffer[] = [];
  // Buffer.from with a malformed encoding yields a short/empty buffer rather
  // than throwing; the length check below rejects those before the compare.
  candidates.push(Buffer.from(provided, 'hex'));
  candidates.push(Buffer.from(provided, 'base64'));

  return candidates.some(
    (candidate) =>
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
  );
}
