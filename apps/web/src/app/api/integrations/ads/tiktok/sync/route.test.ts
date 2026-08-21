import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
const csrf = vi.fn();
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));

import { POST } from './route';

describe('TikTok Ads sync route', () => {
  it('denies a sync before any provider call', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/sync',
            { body: '{}', method: 'POST' }
          )
        )
      ).status
    ).toBe(401);
  });

  it('rejects a malformed authenticated sync body after CSRF validation', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/sync',
            {
              body: JSON.stringify({ startDate: 'bad' }),
              method: 'POST',
            }
          )
        )
      ).status
    ).toBe(400);
  });
});
