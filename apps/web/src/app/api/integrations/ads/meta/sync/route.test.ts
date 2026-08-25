import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const csrf = vi.fn();
const access = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));

import { POST } from './route';

describe('Meta Ads sync route', () => {
  it('requires auth before parsing a browser sync request', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/meta/sync',
            { method: 'POST' }
          )
        )
      ).status
    ).toBe(401);
  });

  it('validates an authenticated body before resolving merchant access', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    csrf.mockResolvedValue({ valid: true });
    access.mockClear();

    const response = await POST(
      new NextRequest('https://usebaci.com/api/integrations/ads/meta/sync', {
        body: '{',
        method: 'POST',
      })
    );

    expect(response.status).toBe(400);
    expect(access).not.toHaveBeenCalled();
  });
});
