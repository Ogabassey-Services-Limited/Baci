import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveAccount } = vi.hoisted(() => ({
  mockResolveAccount: vi.fn(),
}));

vi.mock('@/app/api/paystack/resolve/route', () => ({
  POST: (...args: unknown[]) => mockResolveAccount(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

import { POST } from './route';

describe('POST /api/paystack/verify-account', () => {
  function makeRequest(body?: Record<string, unknown>): NextRequest {
    return new Request('http://localhost/api/paystack/verify-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        body ?? { account_number: '1234567890', bank_code: '044' }
      ),
    }) as NextRequest;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the canonical snake_case response into the legacy camelCase shape', async () => {
    mockResolveAccount.mockResolvedValueOnce(
      Response.json({
        account_name: 'Jane Doe',
        account_number: '1234567890',
        bank_id: null,
      })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accountName: 'Jane Doe',
      accountNumber: '1234567890',
    });
  });

  it('passes through canonical errors unchanged', async () => {
    mockResolveAccount.mockResolvedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
  });

  it('passes through unauthorized responses from the canonical route', async () => {
    mockResolveAccount.mockResolvedValueOnce(
      Response.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 502 when the canonical route responds with invalid JSON', async () => {
    mockResolveAccount.mockResolvedValueOnce(
      new Response('not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Failed to verify account',
    });
  });
});
