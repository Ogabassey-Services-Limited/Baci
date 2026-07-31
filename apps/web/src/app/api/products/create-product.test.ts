import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  checkCsrfProtection: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => new Map()),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { createProduct } from './create-product';

describe('createProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
  });

  it('returns Unauthorized before checking CSRF or parsing an unauthenticated malformed request', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await createProduct(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: '{not valid JSON',
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns the CSRF rejection after authenticating and before parsing product input', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'merchant-1' } },
      error: null,
    });
    const csrfResponse = new Response(
      JSON.stringify({ error: 'CSRF validation failed' }),
      { status: 403 }
    );
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: false,
      response: csrfResponse,
    });

    const response = await createProduct(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: '{not valid JSON',
      })
    );

    expect(response).toBe(csrfResponse);
    expect(response.status).toBe(403);
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.checkCsrfProtection.mock.invocationCallOrder[0]
    );
  });
});
