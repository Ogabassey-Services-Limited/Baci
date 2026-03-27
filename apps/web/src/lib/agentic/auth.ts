import type { NextRequest } from 'next/server';

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

  // Use constant-time comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  const crypto = require('node:crypto');
  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

/**
 * Extract idempotency key from headers
 */
export function getIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get('idempotency-key');
}
