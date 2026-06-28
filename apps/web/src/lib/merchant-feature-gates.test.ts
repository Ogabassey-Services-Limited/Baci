import { describe, expect, it, vi } from 'vitest';
import {
  getMerchantFeatureAccess,
  merchantFeatureUpgradeResponse,
  merchantHasFeature,
} from './merchant-feature-gates';

describe('merchantHasFeature', () => {
  it('allows active paid plan tiers', () => {
    expect(
      merchantHasFeature(
        { plan_tier: 'business', premium_features: [] },
        'marketplace_sync'
      )
    ).toBe(true);
  });

  it('allows explicit feature grants for free plans', () => {
    expect(
      merchantHasFeature(
        { plan_tier: 'free', premium_features: ['custom_domain'] },
        'custom_domain'
      )
    ).toBe(true);
  });

  it('blocks expired paid plans without an explicit grant', () => {
    expect(
      merchantHasFeature(
        {
          plan_expires_at: '2026-01-01T00:00:00.000Z',
          plan_tier: 'pro',
          premium_features: [],
        },
        'marketplace_sync',
        new Date('2026-06-28T00:00:00.000Z')
      )
    ).toBe(false);
  });
});

describe('getMerchantFeatureAccess', () => {
  it('checks merchant plan fields with a column-limited query', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-1',
        plan_expires_at: null,
        plan_tier: 'pro',
        premium_features: [],
      },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const supabase = {
      from: vi.fn(() => ({ select })),
    };

    const result = await getMerchantFeatureAccess(
      supabase as never,
      'merchant-1',
      'custom_domain'
    );

    expect(result).toMatchObject({ allowed: true, error: null });
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(select).toHaveBeenCalledWith(
      'id, plan_tier, plan_expires_at, premium_features'
    );
    expect(eq).toHaveBeenCalledWith('id', 'merchant-1');
  });
});

describe('merchantFeatureUpgradeResponse', () => {
  it('returns a payment-required upgrade response', async () => {
    const response = merchantFeatureUpgradeResponse('custom_domain');

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      code: 'requires_upgrade',
      error: 'Custom domains require Baci Pro',
    });
  });
});
