import type { NextRequest } from 'next/server';
import { getAgenticApiKey } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';

/**
 * Verifies the OpenAI Agentic Commerce API key from the request authorization header.
 *
 * @param request The incoming NextRequest
 * @returns boolean True if authorized, false otherwise
 */
export function verifyAgenticApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice('Bearer '.length);
  const expectedToken = getAgenticApiKey();

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
