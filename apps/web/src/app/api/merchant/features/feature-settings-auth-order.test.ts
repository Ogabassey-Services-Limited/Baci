import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.authenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

import { PATCH, PUT } from './route';

describe('feature settings mutation authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    mocks.checkCsrfProtection.mockResolvedValue({ valid: false });
  });

  it.each([
    ['PATCH', PATCH],
    ['PUT', PUT],
  ])('returns 401 before CSRF validation for an unauthenticated %s request', async (method, handler) => {
    const response = await handler(
      new NextRequest('http://localhost/api/merchant/features', {
        body: JSON.stringify({ loyalty_enabled: true }),
        headers: { 'Content-Type': 'application/json' },
        method,
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.authenticateApiRequest).toHaveBeenCalledOnce();
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });
});
