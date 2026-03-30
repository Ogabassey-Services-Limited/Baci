import crypto from 'node:crypto';

/**
 * HMAC-based constant-time string comparison.
 * Uses an ephemeral key to HMAC both inputs, producing fixed-length
 * digests that can be safely compared with timingSafeEqual — no
 * length leak, no timing leak.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}
