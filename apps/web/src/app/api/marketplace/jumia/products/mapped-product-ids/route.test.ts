import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  getMerchantIdForApiUser: vi.fn(),
  requireMerchantFeatureAccess: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.authenticateApiRequest(...args),
  getMerchantIdForApiUser: (...args: unknown[]) =>
    mocks.getMerchantIdForApiUser(...args),
}));

vi.mock('@/lib/merchant-feature-gates', () => ({
  requireMerchantFeatureAccess: (...args: unknown[]) =>
    mocks.requireMerchantFeatureAccess(...args),
}));

import { GET } from './route';

function createSupabaseMock(
  mappedPages: Array<Array<{ product_id: string | null }>> = [
    [{ product_id: 'product-1' }],
  ]
) {
  let mappedPageIndex = 0;
  const limit = vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: (mappedPages[mappedPageIndex++] ?? []).map((row, index) => ({
        id: `${mappedPageIndex}-${index}`,
        ...row,
      })),
      error: null,
    })
  );
  const order = vi.fn().mockReturnValue({ limit });
  const gt = vi.fn().mockReturnValue({ order });

  return {
    from: (table: string) => {
      if (table === 'marketplace_integrations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        shop_id: 'shop-1',
                        marketplace_key: 'Jumia Nigeria',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'jumia_product_mappings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    gt,
                    order,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe('Jumia mapped product ids GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: createSupabaseMock(),
    });
    mocks.getMerchantIdForApiUser.mockResolvedValue('merchant-1');
    mocks.requireMerchantFeatureAccess.mockResolvedValue(null);
  });

  it('returns integration-scoped mapped product ids', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/marketplace/jumia/products/mapped-product-ids?integrationId=00000000-0000-4000-8000-000000000099'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      productIds: ['product-1'],
    });
  });

  it('loads mapped product ids across response pages', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      product_id: `product-${index}`,
    }));
    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: createSupabaseMock([
        firstPage,
        [{ product_id: 'product-500' }],
      ]),
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/marketplace/jumia/products/mapped-product-ids?integrationId=00000000-0000-4000-8000-000000000099'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      productIds: [...firstPage.map((row) => row.product_id), 'product-500'],
    });
  });
});
