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

import { createPutFeatureSettings } from './put-feature-settings';

describe('putFeatureSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
  });

  it('rejects unauthenticated replacements before invoking CSRF validation', async () => {
    const putFeatureSettings = createPutFeatureSettings(vi.fn());
    const response = await putFeatureSettings(
      new NextRequest('http://localhost/api/merchant/features', {
        body: JSON.stringify({ loyalty_enabled: true }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });
});
