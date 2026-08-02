import { describe, expect, it } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { buildOgabasseyPdpDeferredProductPayload } from './deferred-product-payload';

const product = {
  brand: 'Lenovo',
  categories: {
    id: 'cat-1',
    name: 'Laptops',
    parent_id: null,
    slug: 'laptops',
  },
  category: 'Laptops',
  categorySlug: 'laptops',
  condition: 'new',
  description: 'Creator laptop with RTX graphics.',
  detailedSpecs: [
    {
      category: 'Performance',
      items: [{ label: 'Processor', value: 'Intel Core i9' }],
    },
  ],
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion-fallback.avif',
  image_payloads: [
    {
      alt: 'verbose generated alt payload that must stay server-side',
      source: 'generated',
    },
  ],
  images: [
    'https://cdn.ogabassey.com/core-assets/products/legion.avif',
    'https://cdn.ogabassey.com/core-assets/products/legion-gallery.avif',
    'https://cdn.ogabassey.com/core-assets/products/legion-extra.avif',
  ],
  manage_stock: true,
  merchantId: 'merchant-1',
  name: 'Lenovo Legion Pro 9',
  offers: [
    {
      condition: 'new',
      id: 'offer-1',
      notes: 'verbose offer notes that should not hydrate below-fold islands',
      price: 'NGN 5,985,000',
      rawPrice: 5_985_000,
    },
  ],
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  reviews: 12,
  slug: 'lenovo-legion-pro-9',
  stock: 4,
  storage: '1TB',
  variant_attributes: { platform: ['Windows'] },
  variants: [
    {
      attributes: { platform: 'Windows', ram: '32GB', storage: '1TB' },
      id: 'variant-1',
      images: ['https://cdn.ogabassey.com/core-assets/products/variant.avif'],
      stock: 4,
    },
  ],
} as unknown as Product;

describe('buildOgabasseyPdpDeferredProductPayload', () => {
  it('builds compact tab and related-product payloads without verbose server-only fields', () => {
    const payload = buildOgabasseyPdpDeferredProductPayload(product);

    expect(payload.relatedProduct).toMatchObject({
      category_slug: 'laptops',
      condition: 'new',
      id: 'product-1',
      image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
      merchant_id: 'merchant-1',
      name: 'Lenovo Legion Pro 9',
      price: 5_985_000,
      stock: 4,
    });
    expect(payload.relatedProduct.categories).toEqual({
      id: 'cat-1',
      name: 'Laptops',
      parent_id: undefined,
      slug: 'laptops',
    });

    expect(payload.tabProduct).toMatchObject({
      categorySlug: 'laptops',
      image: 'https://cdn.ogabassey.com/core-assets/products/variant.avif',
      name: 'Lenovo Legion Pro 9',
      platforms: ['Windows'],
      reviewCount: 12,
      storage: ['1TB'],
    });
    // The description is returned out-of-band and NEVER serialized into the
    // client tab payload (multi-KB HTML kept off the RSC/flight wire).
    expect(payload.description).toBe('Creator laptop with RTX graphics.');
    expect(payload.tabProduct).not.toHaveProperty('description');
    expect(JSON.stringify(payload.tabProduct)).not.toContain(
      'Creator laptop with RTX graphics.'
    );
    expect(payload.tabProduct.images).toEqual([
      'https://cdn.ogabassey.com/core-assets/products/variant.avif',
      'https://cdn.ogabassey.com/core-assets/products/legion.avif',
    ]);
    expect(payload.tabProduct.categories).toEqual({
      id: 'cat-1',
      name: 'Laptops',
      parent_id: undefined,
      slug: 'laptops',
    });

    const serializedPayload = JSON.stringify(payload);
    expect(serializedPayload).not.toContain('verbose offer notes');
    expect(serializedPayload).not.toContain('verbose generated alt payload');
    expect(serializedPayload).not.toContain('legion-extra.avif');
  });

  it('falls back to placeholders and defaults when optional product fields are missing', () => {
    const payload = buildOgabasseyPdpDeferredProductPayload({
      id: 'product-2',
      name: 'Bare Product',
      price: 'Contact for price',
      slug: 'bare-product',
    } as unknown as Product);

    expect(payload.relatedProduct).toMatchObject({
      category: '',
      category_slug: '',
      description: '',
      image: '/placeholder.svg',
      price: 0,
      stock: 0,
    });
    expect(payload.relatedProduct.categories).toBeNull();
    expect(payload.description).toBe('');
    expect(payload.tabProduct).not.toHaveProperty('description');
    expect(payload.tabProduct).toMatchObject({
      image: '/placeholder.svg',
      images: ['/placeholder.svg'],
      platforms: [],
      rating: 0,
      reviewCount: 0,
      storage: [],
    });
  });
});
