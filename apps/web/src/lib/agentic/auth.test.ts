import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAgenticApiKey } from './auth';

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) {
    headers.set('authorization', authHeader);
  }
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('verifyAgenticApiKey', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'test-secret-key');
  });

  it('returns true for valid Bearer token', () => {
    expect(verifyAgenticApiKey(makeRequest('Bearer test-secret-key'))).toBe(
      true
    );
  });

  it('returns false for wrong token', () => {
    expect(verifyAgenticApiKey(makeRequest('Bearer wrong-key'))).toBe(false);
  });

  it('returns false when no authorization header', () => {
    expect(verifyAgenticApiKey(makeRequest())).toBe(false);
  });

  it('returns false when header is not Bearer scheme', () => {
    expect(verifyAgenticApiKey(makeRequest('Basic dXNlcjpwYXNz'))).toBe(false);
  });

  it('returns false when env var is not set', () => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', '');
    expect(verifyAgenticApiKey(makeRequest('Bearer test-secret-key'))).toBe(
      false
    );
  });
});
