import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const validPayload = {
  merchant: {
    name: 'Pilot Store',
    publishedStatus: 'published',
    slug: 'pilot-store',
  },
  publishedConfig: { content: [], root: { props: { title: 'Home' } } },
  products: [],
} as const;

const product = {
  available: true,
  currency: 'NGN',
  id: '123e4567-e89b-42d3-a456-426614174100',
  name: 'Phone',
  priceMinor: 100_000,
  slug: 'phone',
  status: 'active',
  variants: [
    {
      available: true,
      displayQuantityLimit: null,
      id: '123e4567-e89b-42d3-a456-426614174101',
      name: 'Black',
      priceMinor: 100_000,
    },
  ],
} as const;

describe('StorefrontPublicProjectionPayloadSchema review regressions', () => {
  it.each([
    'checkout',
    'products',
  ])('rejects the reserved category slug %s', (slug) => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: '123e4567-e89b-42d3-a456-426614174110',
            name: 'Reserved',
            slug,
            status: 'active',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('requires content pages to have explicit published status', () => {
    const contentPage = {
      body: 'About us',
      format: 'plain_text',
      id: '123e4567-e89b-42d3-a456-426614174120',
      slug: 'about',
      title: 'About',
    } as const;

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        contentPages: [contentPage],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        contentPages: [{ ...contentPage, status: 'published' }],
      }).success
    ).toBe(true);
  });

  it.each([
    ['product ID', { ...product, slug: 'other-phone' }],
    [
      'product slug',
      {
        ...product,
        id: '123e4567-e89b-42d3-a456-426614174102',
      },
    ],
    [
      'variant ID',
      {
        ...product,
        id: '123e4567-e89b-42d3-a456-426614174102',
        slug: 'other-phone',
      },
    ],
  ])('rejects a duplicate %s', (_label, duplicateProduct) => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        products: [product, duplicateProduct],
      }).success
    ).toBe(false);
  });

  it.each([
    ['ID', { id: '123e4567-e89b-42d3-a456-426614174130', slug: 'phones' }],
    ['slug', { id: '123e4567-e89b-42d3-a456-426614174131', slug: 'phones' }],
  ])('rejects a duplicate category %s', (_label, duplicateCategory) => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: '123e4567-e89b-42d3-a456-426614174130',
            name: 'Phones',
            slug: 'phones',
            status: 'active',
          },
          { ...duplicateCategory, name: 'Other phones', status: 'active' },
        ],
      }).success
    ).toBe(false);
  });

  it('requires active products and preserves compare-at pricing', () => {
    const releasedProduct = {
      ...product,
      compareAtPriceMinor: 125_000,
    } as const;

    expect(
      StorefrontPublicProjectionPayloadSchema.parse({
        ...validPayload,
        products: [releasedProduct],
      }).products[0]
    ).toEqual(releasedProduct);
    const { status: _status, ...unverifiedProduct } = releasedProduct;
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        products: [unverifiedProduct],
      }).success
    ).toBe(false);
  });

  it('requires categories to be explicitly active', () => {
    const category = {
      id: '123e4567-e89b-42d3-a456-426614174140',
      name: 'Phones',
      slug: 'phones',
    } as const;

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [category],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [{ ...category, status: 'active' }],
      }).success
    ).toBe(true);
  });

  it('rejects duplicate blog post IDs and route slugs', () => {
    const post = {
      authorName: 'Editor',
      content: 'Published guide',
      featuredImageUrl: null,
      id: '123e4567-e89b-42d3-a456-426614174150',
      publishedAt: '2026-08-25T14:00:00+01:00',
      slug: 'buying-guide',
      status: 'published',
      title: 'Buying guide',
    } as const;

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        blogPosts: [post, { ...post, title: 'Duplicate' }],
      }).success
    ).toBe(false);
  });

  it('rejects duplicate content-page routes and feature-flag keys', () => {
    const page = {
      body: 'About us',
      format: 'plain_text',
      id: '123e4567-e89b-42d3-a456-426614174160',
      slug: 'about',
      status: 'published',
      title: 'About',
    } as const;

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        contentPages: [page, { ...page, title: 'Duplicate' }],
        featureFlags: [
          { enabled: true, key: 'reviews' },
          { enabled: false, key: 'reviews' },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects duplicate SEO paths', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        seoEntries: [
          { indexable: true, path: '/about', title: 'About' },
          { indexable: false, path: '/about', title: 'Hidden About' },
        ],
      }).success
    ).toBe(false);
  });
});
