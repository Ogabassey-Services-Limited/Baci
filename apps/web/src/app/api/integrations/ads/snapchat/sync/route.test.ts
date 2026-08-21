import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const csrf = vi.fn();
const sync = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));
vi.mock('@/lib/ads/snapchat/sync', () => ({
  syncSnapchatAdsSpendForMerchant: (...args: unknown[]) => sync(...args),
  SnapchatAdsSyncError: class SnapchatAdsSyncError extends Error {},
}));

import { POST } from './route';

describe('Snapchat Ads sync route', () => {
  it('denies unauthenticated sync requests before JSON parsing', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/sync',
            { body: 'bad', method: 'POST' }
          )
        )
      ).status
    ).toBe(401);
  });

  it('validates CSRF and input before synchronizing, then returns safe success data', async () => {
    auth.mockResolvedValue({ error: null, supabase: {}, user: { id: 'user' } });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    sync.mockResolvedValue({ accountId: 'ad', rowsWritten: 1 });
    const response = await POST(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/sync',
        {
          body: JSON.stringify({
            startDate: '2026-08-01',
            endDate: '2026-08-02',
          }),
          method: 'POST',
        }
      )
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accountId: 'ad',
      rowsWritten: 1,
      synced: true,
    });
    const invalid = await POST(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/sync',
        { body: '{}', method: 'POST' }
      )
    );
    expect(invalid.status).toBe(400);
  });

  it('drives CSRF, permission, and malformed JSON denials before sync work', async () => {
    auth.mockResolvedValue({ error: null, supabase: {}, user: { id: 'user' } });
    csrf.mockResolvedValue({ valid: false });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/sync',
            { body: '{}', method: 'POST' }
          )
        )
      ).status
    ).toBe(403);
    csrf.mockResolvedValue({ valid: true });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(false);
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/sync',
            { body: '{}', method: 'POST' }
          )
        )
      ).status
    ).toBe(403);
    permission.mockReturnValue(true);
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/sync',
            { body: '{', method: 'POST' }
          )
        )
      ).status
    ).toBe(400);
  });
});
