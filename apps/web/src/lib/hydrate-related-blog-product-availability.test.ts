import { describe, expect, it, vi } from 'vitest';
import type { RelatedBlogProduct } from '@/lib/related-blog-products';
import { hydrateRelatedBlogProductAvailability } from './hydrate-related-blog-product-availability';

function product(
  overrides: Partial<RelatedBlogProduct> = {}
): RelatedBlogProduct {
  return {
    id: 'product-1',
    name: 'iPhone 16',
    slug: 'iphone-16',
    category_slug: 'smartphones',
    manage_stock: true,
    stock: 0,
    has_condition_offers: true,
    ...overrides,
  };
}

const VARIANT_PRODUCT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('hydrateRelatedBlogProductAvailability', () => {
  it('marks an empty primary product as available when an active condition offer has stock', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ stock_quantity: 2 }],
      error: null,
    });

    const result = await hydrateRelatedBlogProductAvailability(
      { rpc } as never,
      [product()]
    );

    expect(result[0]?.has_purchasable_condition_offer).toBe(true);
    expect(rpc).toHaveBeenCalledWith('get_product_offers', {
      p_product_id: 'product-1',
    });
  });

  it('marks an empty primary product unavailable when every active offer is empty', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ stock_quantity: 0 }, { stock_quantity: null }],
      error: null,
    });

    const result = await hydrateRelatedBlogProductAvailability(
      { rpc } as never,
      [product()]
    );

    expect(result[0]?.has_purchasable_condition_offer).toBe(false);
  });

  it('does not read offers for products that are not currently unavailable', async () => {
    const rpc = vi.fn();
    const products = [
      product({ stock_quantity: 3 }),
      product({ id: 'product-2', manage_stock: false }),
      product({ id: 'product-3', has_condition_offers: false }),
    ];

    const result = await hydrateRelatedBlogProductAvailability(
      { rpc } as never,
      products
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual(products);
  });

  it('fails open when the offer lookup errors', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'timeout' },
    });

    try {
      const result = await hydrateRelatedBlogProductAvailability(
        { rpc } as never,
        [product()]
      );

      expect(result[0]?.has_purchasable_condition_offer).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('keeps a managed product available when a public variant has stock', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          product_id: VARIANT_PRODUCT_ID,
          stock_quantity: 3,
        },
      ],
      error: null,
    });
    const variantProduct = product({
      id: VARIANT_PRODUCT_ID,
      has_condition_offers: false,
      has_variants: true,
    });

    const result = await hydrateRelatedBlogProductAvailability(
      { rpc } as never,
      [variantProduct]
    );

    expect(result[0]?.has_purchasable_variant).toBe(true);
    expect(rpc).toHaveBeenCalledWith('get_storefront_product_variants', {
      p_product_ids: [VARIANT_PRODUCT_ID],
    });
  });

  it('marks a managed product unavailable when every public variant is empty', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          product_id: VARIANT_PRODUCT_ID,
          stock_quantity: 0,
        },
      ],
      error: null,
    });
    const variantProduct = product({
      id: VARIANT_PRODUCT_ID,
      has_condition_offers: false,
      has_variants: true,
    });

    const result = await hydrateRelatedBlogProductAvailability(
      { rpc } as never,
      [variantProduct]
    );

    expect(result[0]?.has_purchasable_variant).toBe(false);
  });

  it('fails open when the public variant lookup errors', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'timeout' },
    });
    const variantProduct = product({
      id: VARIANT_PRODUCT_ID,
      has_condition_offers: false,
      has_variants: true,
    });

    try {
      const result = await hydrateRelatedBlogProductAvailability(
        { rpc } as never,
        [variantProduct]
      );

      expect(result[0]?.has_purchasable_variant).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
