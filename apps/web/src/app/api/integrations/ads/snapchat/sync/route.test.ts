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
  SnapchatAdsSyncError: class SnapchatAdsSyncError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
vi.mock('@/lib/ads/snapchat/config', () => ({
  SnapchatAdsConfigError: class SnapchatAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/snapchat/provider', () => ({
  SnapchatAdsProviderError: class SnapchatAdsProviderError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

import { SnapchatAdsConfigError } from '@/lib/ads/snapchat/config';
import { SnapchatAdsProviderError } from '@/lib/ads/snapchat/provider';
import { SnapchatAdsSyncError } from '@/lib/ads/snapchat/sync';
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
    access.mockClear();
    const invalid = await POST(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/sync',
        { body: '{}', method: 'POST' }
      )
    );
    expect(invalid.status).toBe(400);
    expect(access).not.toHaveBeenCalled();
  });

  it('drives CSRF, permission, and malformed JSON denials before sync work', async () => {
    auth.mockResolvedValue({ error: null, supabase: {}, user: { id: 'user' } });
    csrf.mockResolvedValue({ valid: false });
    expect(
      (
        await POST(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/sync',
            {
              body: JSON.stringify({
                endDate: '2026-08-02',
                startDate: '2026-08-01',
              }),
              method: 'POST',
            }
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
            {
              body: JSON.stringify({
                endDate: '2026-08-02',
                startDate: '2026-08-01',
              }),
              method: 'POST',
            }
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

  it('maps config, sync, provider, and database failures to safe codes', async () => {
    auth.mockResolvedValue({ error: null, supabase: {}, user: { id: 'user' } });
    csrf.mockResolvedValue({ valid: true });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const request = () =>
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/sync',
        {
          body: JSON.stringify({
            endDate: '2026-08-02',
            startDate: '2026-08-01',
          }),
          method: 'POST',
        }
      );

    sync.mockRejectedValueOnce(
      new SnapchatAdsConfigError('SNAP_CONFIG_SENTINEL')
    );
    expect((await POST(request())).status).toBe(503);

    sync.mockRejectedValueOnce(
      new SnapchatAdsSyncError('SNAPCHAT_ADS_ACCOUNT_NOT_SELECTED')
    );
    const selection = await POST(request());
    expect(selection.status).toBe(409);
    expect(await selection.json()).toEqual({
      error: 'SNAPCHAT_ADS_ACCOUNT_NOT_SELECTED',
    });

    sync.mockRejectedValueOnce(
      new SnapchatAdsProviderError('SNAP_PROVIDER_SAFE_CODE')
    );
    const provider = await POST(request());
    expect(provider.status).toBe(502);
    expect(await provider.json()).toEqual({ error: 'SNAP_PROVIDER_SAFE_CODE' });

    sync.mockRejectedValueOnce(new Error('SNAP_DATABASE_SENTINEL'));
    const database = await POST(request());
    expect(database.status).toBe(502);
    const databaseBody = await database.json();
    expect(databaseBody).toEqual({ error: 'Snapchat Ads sync failed' });
    expect(JSON.stringify(databaseBody)).not.toContain(
      'SNAP_DATABASE_SENTINEL'
    );
  });
});
