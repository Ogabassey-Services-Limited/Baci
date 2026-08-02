import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticateApiRequest: vi.fn() }));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.authenticateApiRequest(...args),
}));

import { getFeatureSettings } from './get-feature-settings';

describe('getFeatureSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
  });

  it('returns a private 401 response before reading settings for an unauthenticated request', async () => {
    const response = await getFeatureSettings(
      new NextRequest('http://localhost/api/merchant/features')
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toContain(
      'private, no-store'
    );
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});
