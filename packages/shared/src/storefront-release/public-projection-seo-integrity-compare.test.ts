import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const validPayload = {
  merchant: {
    country: 'NG',
    currency: 'NGN',
    hostname: 'pilot-store.usebaci.com',
    id: '123e4567-e89b-42d3-a456-426614174000',
    locale: 'en-NG',
    name: 'Pilot Store',
    publishedStatus: 'published',
    slug: 'pilot-store',
    template: { contractVersion: 'v1', id: 'ogabassey' },
  },
  publishedConfig: { content: [], root: { props: { title: 'Home' } } },
  products: [],
} as const;

const product = {
  available: true,
  currency: 'NGN',
  displayQuantityLimit: null,
  id: '123e4567-e89b-42d3-a456-426614174100',
  name: 'Phone',
  priceMinor: 100_000,
  slug: 'phone',
  status: 'active',
} as const;

describe('public projection compare SEO integrity', () => {
  it('requires an eligible product pair for an indexable compare landing page', () => {
    const categoryId = '123e4567-e89b-42d3-a456-426614174190';
    const compareProducts = [
      {
        ...product,
        categoryIds: [categoryId],
        id: '123e4567-e89b-42d3-a456-426614174191',
        name: 'Phone One',
        productKeySpecs: {
          camera_mp: 12,
          display_inches: 6,
          storage_gb: 128,
        },
        slug: 'phone-one',
      },
      {
        ...product,
        categoryIds: [categoryId],
        id: '123e4567-e89b-42d3-a456-426614174192',
        name: 'Phone Two',
        productKeySpecs: {
          camera_mp: 50,
          display_inches: 6.7,
          storage_gb: 256,
        },
        slug: 'phone-two',
      },
    ];

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [{ indexable: true, path: '/compare', title: 'Compare' }],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: categoryId,
            name: 'Phones',
            slug: 'phones',
            status: 'active',
          },
        ],
        products: compareProducts,
        seoEntries: [{ indexable: true, path: '/compare', title: 'Compare' }],
      }).success
    ).toBe(true);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: categoryId,
            name: 'Phones',
            slug: 'phones',
            status: 'active',
          },
        ],
        products: compareProducts.map((compareProduct) => ({
          ...compareProduct,
          available: false,
        })),
        seoEntries: [{ indexable: true, path: '/compare', title: 'Compare' }],
      }).success
    ).toBe(true);
  });
});
