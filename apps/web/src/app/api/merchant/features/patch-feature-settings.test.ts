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

import { createPatchFeatureSettings } from './patch-feature-settings';

describe('patchFeatureSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
  });

  it('rejects unauthenticated updates before invoking CSRF validation', async () => {
    const patchFeatureSettings = createPatchFeatureSettings(vi.fn());
    const response = await patchFeatureSettings(
      new NextRequest('http://localhost/api/merchant/features', {
        body: JSON.stringify({ loyalty_enabled: true }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });
});
