import { describe, expect, it, vi } from 'vitest';
import {
  fetchProductRouteDetails,
  mapOrderItemsWithRoutes,
  resolveMerchantIdBySlug,
} from './route-helpers';

describe('storefront order route helpers', () => {
  it('maps item names, product routes, and canonical condition labels', () => {
    const items = mapOrderItemsWithRoutes(
      [
        {
          id: 'item-1',
          product_id: 'product-1',
          condition: 'used',
          name: 'Fallback name',
          quantity: 1,
          price: 5000,
        },
      ],
      new Map([
        [
          'product-1',
          {
            product_slug: 'phone',
            category: 'phones',
            category_slug: 'smartphones',
            gtin: '0123456789012',
            categories: { name: 'Smartphones', slug: 'smartphones' },
          },
        ],
      ])
    );

    expect(items[0]).toMatchObject({
      name: 'Fallback name',
      product_name: 'Fallback name',
      product_slug: 'phone',
      category_slug: 'smartphones',
      variant_name: 'Used',
    });
  });

  it('returns an empty product map when the product query fails', async () => {
    const result = await fetchProductRouteDetails(
      [{ id: 'item-1', product_id: 'product-1', quantity: 1, price: 1 }],
      vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } })
    );

    expect(result.size).toBe(0);
  });

  it('resolves a merchant id from its slug', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'merchant-1' },
      error: null,
    });
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single,
      }),
    };

    await expect(resolveMerchantIdBySlug('shop', supabase)).resolves.toBe(
      'merchant-1'
    );
  });
});
