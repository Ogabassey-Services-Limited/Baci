import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify an App Store Connect webhook signature.
 *
 * Apple signs each webhook with HMAC-SHA256 over the raw request body using the
 * secret configured when the webhook is registered, and sends it in the
 * `X-Apple-Signature` header. Apple's docs don't pin the header's exact shape,
 * so we accept the digest bare OR prefixed with an algorithm label (e.g.
 * `hmacsha256=<hex>`), and decode each as hex or base64. All are derived from the
 * same secret-keyed HMAC, so accepting several encodings does not weaken the
 * check (an attacker still needs the secret). Comparison is constant-time.
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

  const trimmed = signatureHeader.trim();

  // Consider the whole header and, when present, the part after the first "="
  // (so an `algorithm=<digest>` prefix verifies). The whole-header candidates
  // still cover a bare base64 value whose only "=" is trailing padding.
  const rawCandidates = [trimmed];
  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex >= 0 && equalsIndex < trimmed.length - 1) {
    rawCandidates.push(trimmed.slice(equalsIndex + 1));
  }

  // Buffer.from with a malformed encoding yields a short/empty buffer rather
  // than throwing; the length check below rejects those before the compare.
  const candidates: Buffer[] = [];
  for (const raw of rawCandidates) {
    candidates.push(Buffer.from(raw, 'hex'));
    candidates.push(Buffer.from(raw, 'base64'));
  }

  return candidates.some(
    (candidate) =>
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
  );
}
