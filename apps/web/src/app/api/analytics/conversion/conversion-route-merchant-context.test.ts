import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/lib/events/event-ingress-context', () => ({
  resolveEventIngressContext: mocks.resolve,
}));

import { resolveConversionRouteMerchantContext } from './conversion-route-merchant-context';

const request = new NextRequest(
  'https://shop.usebaci.com/api/analytics/conversion',
  { headers: { host: 'shop.usebaci.com' } }
);

function client(legacyId: string | null) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => ({
      data: legacyId ? { id: legacyId } : null,
      error: null,
    })),
    select: vi.fn(() => query),
  };
  return { from: vi.fn(() => query) };
}

describe('resolveConversionRouteMerchantContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns independently verified identity for privileged fanout', async () => {
    mocks.resolve.mockResolvedValue({
      merchantId: 'merchant-1',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });

    await expect(
      resolveConversionRouteMerchantContext({
        claimedMerchantId: 'merchant-1',
        request,
        supabase: client('merchant-1') as unknown as Parameters<
          typeof resolveConversionRouteMerchantContext
        >[0]['supabase'],
      })
    ).resolves.toMatchObject({
      persistenceMerchantId: 'merchant-1',
      verifiedMerchantId: 'merchant-1',
    });
  });

  it('keeps legacy persistence but removes authority on mismatch', async () => {
    mocks.resolve.mockResolvedValue({ code: 'merchant_mismatch', ok: false });

    await expect(
      resolveConversionRouteMerchantContext({
        claimedMerchantId: 'body-merchant',
        request,
        supabase: client('body-merchant') as unknown as Parameters<
          typeof resolveConversionRouteMerchantContext
        >[0]['supabase'],
      })
    ).resolves.toMatchObject({
      context: { code: 'merchant_mismatch', ok: false },
      persistenceMerchantId: 'body-merchant',
      verifiedMerchantId: null,
    });
  });

  it('runs Referer-aware ingestion before Host-only authority resolution', async () => {
    mocks.resolve
      .mockResolvedValueOnce({
        merchantId: 'merchant-1',
        ok: true,
        trustLevel: 'tenant_verified_client',
        verified: true,
      })
      .mockResolvedValueOnce({
        merchantId: 'merchant-1',
        ok: true,
        trustLevel: 'anonymous_client',
        verified: false,
      });
    const result = await resolveConversionRouteMerchantContext({
      claimedMerchantId: 'merchant-1',
      request: new NextRequest('https://usebaci.com/api/analytics/conversion', {
        headers: {
          host: 'usebaci.com',
          referer: 'https://usebaci.com/shop/product',
        },
      }),
      supabase: client('merchant-1') as unknown as Parameters<
        typeof resolveConversionRouteMerchantContext
      >[0]['supabase'],
    });
    expect(result.context).toMatchObject({
      merchantId: 'merchant-1',
      trustLevel: 'tenant_verified_client',
      verified: true,
    });
    expect(result.persistenceMerchantId).toBe('merchant-1');
    expect(result.verifiedMerchantId).toBeNull();
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
    expect(
      mocks.resolve.mock.calls[0]?.[0].request.headers.get('referer')
    ).toBe('https://usebaci.com/shop/product');
    expect(
      mocks.resolve.mock.calls[1]?.[0].request.headers.get('referer')
    ).toBeNull();
  });
});
