import crypto from 'node:crypto';

/**
 * Constant-time string comparison using HMAC (2026 OWASP best practice).
 *
 * Unlike `crypto.timingSafeEqual`, this handles different-length inputs
 * safely — no `TypeError` on length mismatch, no timing leak about
 * whether the lengths matched. A fresh random HMAC key per call prevents
 * precomputation attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}
