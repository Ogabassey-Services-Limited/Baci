import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { verifyAgenticRequestIntegrity } from '@/lib/agentic/request-integrity';

vi.mock('@/lib/agentic/request-integrity', () => ({
  getAgenticSigningSecrets: vi.fn(() => ['signing-secret']),
  verifyAgenticRequestIntegrity: vi.fn(),
}));

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/agentic/checkout_sessions', {
    body,
    headers: {
      'idempotency-key': 'idem-1',
      ...headers,
    },
    method: 'POST',
  });
}

describe('readAgenticMutationRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAgenticRequestIntegrity).mockReturnValue({
      apiVersion: '2026-04-30',
      ok: true,
      requestId: 'req_123',
    });
  });

  it('parses signed JSON mutation requests', async () => {
    const result = await readAgenticMutationRequest({
      request: request('{"items":[]}'),
    });

    expect(result).toMatchObject({
      apiVersion: '2026-04-30',
      body: { items: [] },
      idempotencyKey: 'idem-1',
      method: 'POST',
      ok: true,
      pathname: '/api/agentic/checkout_sessions',
      rawBody: '{"items":[]}',
      requestId: 'req_123',
    });
  });

  it('uses an empty object for signed empty request bodies', async () => {
    const result = await readAgenticMutationRequest({ request: request('') });

    expect(result).toMatchObject({ body: {}, ok: true });
  });

  it('rejects missing required idempotency keys', async () => {
    const result = await readAgenticMutationRequest({
      request: request('{}', { 'idempotency-key': '' }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: 'Missing idempotency key',
      });
    }
  });

  it('maps integrity failures to API errors', async () => {
    vi.mocked(verifyAgenticRequestIntegrity).mockReturnValueOnce({
      error: 'Missing signing secret',
      ok: false,
    });

    const missingSecret = await readAgenticMutationRequest({
      request: request('{}'),
    });

    expect(missingSecret.ok).toBe(false);
    if (!missingSecret.ok) {
      expect(missingSecret.response.status).toBe(503);
    }

    vi.mocked(verifyAgenticRequestIntegrity).mockReturnValueOnce({
      error: 'Invalid signature',
      ok: false,
    });

    const invalidSignature = await readAgenticMutationRequest({
      request: request('{}'),
    });

    expect(invalidSignature.ok).toBe(false);
    if (!invalidSignature.ok) {
      expect(invalidSignature.response.status).toBe(401);
    }
  });

  it('rejects malformed JSON after integrity succeeds', async () => {
    const result = await readAgenticMutationRequest({
      request: request('{bad json'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: 'Invalid JSON body',
      });
    }
  });
});
