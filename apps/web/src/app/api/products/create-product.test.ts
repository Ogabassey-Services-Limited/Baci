import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

import { createProduct } from './create-product';

describe('createProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the CSRF rejection before reading merchant or product input', async () => {
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
  });
});
