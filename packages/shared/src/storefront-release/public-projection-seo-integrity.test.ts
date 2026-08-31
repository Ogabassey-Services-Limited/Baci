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
  it('does not admit optional policy routes without projected policy content', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [
          { indexable: true, path: '/privacy', title: 'Privacy' },
          { indexable: true, path: '/terms', title: 'Terms' },
        ],
      }).success
    ).toBe(false);
  });

  it('uses the routed pages/rewards path instead of the obsolete root path', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [
          { indexable: true, path: '/pages/rewards', title: 'Rewards' },
        ],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [
          { indexable: false, path: '/pages/rewards', title: 'Rewards' },
        ],
      }).success
    ).toBe(true);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [{ indexable: true, path: '/rewards', title: 'Rewards' }],
      }).success
    ).toBe(false);
  });

  it('admits inventory-qualified commercial-support routes', () => {
    const categoryId = '123e4567-e89b-42d3-a456-426614174180';
    const products = Array.from({ length: 5 }, (_, index) => ({
      available: true,
      brand: 'Samsung',
      categoryIds: [categoryId],
      currency: 'NGN',
      displayQuantityLimit: null,
      id: `123e4567-e89b-42d3-a456-42661417418${index}`,
      name: `Samsung Galaxy S${index + 20}`,
      priceMinor: 100_000 + index,
      productKeySpecs: {
        camera_mp: 12 + index,
        display_inches: 6 + index / 10,
        storage_gb: 128 + index * 128,
      },
      slug: `galaxy-s${index + 20}`,
      status: 'active' as const,
    }));

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: categoryId,
            name: 'Smartphones',
            slug: 'smartphones',
            status: 'active',
          },
        ],
        products,
        maintainedComparePaths: [
          '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
        ],
        seoEntries: [
          {
            indexable: true,
            path: '/smartphones/brands/samsung',
            title: 'Samsung',
          },
          {
            indexable: true,
            path: '/smartphones/brands/samsung/families/galaxy-s',
            title: 'Galaxy S',
          },
          {
            indexable: true,
            path: '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
            title: 'Compare phones',
          },
        ],
      }).success
    ).toBe(true);
  });

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

  it('does not release suppressed blog-post SEO paths', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        featureFlags: [{ enabled: true, key: 'blog_enabled' }],
        blogPosts: [
          {
            authorName: 'Author',
            content: 'Internal test post',
            id: '123e4567-e89b-42d3-a456-426614174171',
            publishedAt: '2026-08-30T00:00:00+00:00',
            slug: 'agent-integration-working-notes',
            status: 'published',
            title: 'Useful internal notes',
          },
        ],
        seoEntries: [
          {
            indexable: true,
            path: '/blog/agent-integration-working-notes',
            title: 'Internal notes',
          },
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

  it('does not admit warranty SEO without a publishable warranty policy', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [{ indexable: true, path: '/warranty', title: 'Warranty' }],
      }).success
    ).toBe(false);

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        policies: {
          warrantyPolicy: {
            localRoute: '/warranty',
            summary: 'Manufacturer warranty applies.',
          },
        },
        seoEntries: [{ indexable: true, path: '/warranty', title: 'Warranty' }],
      }).success
    ).toBe(true);
  });

  it('rejects indexable cart SEO entries', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [{ indexable: true, path: '/cart', title: 'Cart' }],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [{ indexable: false, path: '/cart', title: 'Cart' }],
      }).success
    ).toBe(true);
  });

  it('requires the blog feature for an indexable blog landing page', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [{ indexable: true, path: '/blog', title: 'Blog' }],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        featureFlags: [{ enabled: true, key: 'blog_enabled' }],
        seoEntries: [{ indexable: true, path: '/blog', title: 'Blog' }],
      }).success
    ).toBe(true);
  });
});
