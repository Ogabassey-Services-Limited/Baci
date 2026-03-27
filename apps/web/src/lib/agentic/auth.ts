import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Constant-time string comparison using HMAC.
 * Unlike timingSafeEqual, this handles different-length inputs safely
 * without leaking length information via timing or thrown errors.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

/**
 * Verifies the OpenAI Agentic Commerce API key from the request authorization header.
 *
 * @param request The incoming NextRequest
 * @returns boolean True if authorized, false otherwise
 */
export function verifyAgenticApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  const expectedToken = process.env.OPENAI_AGENTIC_API_KEY;

  if (!expectedToken) {
    console.warn('OPENAI_AGENTIC_API_KEY is not set in environment variables');
    return false;
  }

  return constantTimeEqual(token, expectedToken);
}

/**
 * Extract idempotency key from headers
 */
export function getIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get('idempotency-key');
}
