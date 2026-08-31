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

describe('public projection SEO integrity', () => {
  it('rejects SEO entries that do not resolve to released identities', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [
          { indexable: true, path: '/phones/retired-phone', title: 'Stale' },
        ],
      }).success
    ).toBe(false);
  });

  it('requires product canonical paths to reference a projected category', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: '123e4567-e89b-42d3-a456-426614174170',
            name: 'Phones',
            slug: 'phones',
            status: 'active',
          },
        ],
        products: [{ ...product, canonicalPath: '/laptops/phone' }],
      }).success
    ).toBe(false);
  });
});
