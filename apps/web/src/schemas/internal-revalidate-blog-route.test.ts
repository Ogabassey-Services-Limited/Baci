import { describe, expect, it } from 'vitest';
import { internalRevalidateBlogBodySchema } from '@/schemas/internal-revalidate-blog-route';

describe('internalRevalidateBlogBodySchema', () => {
  it('accepts and trims explicit blog revalidation inputs', () => {
    const result = internalRevalidateBlogBodySchema.safeParse({
      identifiers: [' ogabassey.com ', ' ogabassey '],
      merchantId: ' 6b5cb8a4-5575-456c-b936-8cdfae30db74 ',
      canonicalMerchantSlug: ' ogabassey ',
      listingCategories: [' Smartphones '],
      listingPages: [1, 2],
      postSlugs: [' old-post ', ' canonical-post '],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      identifiers: ['ogabassey.com', 'ogabassey'],
      merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      canonicalMerchantSlug: 'ogabassey',
      listingCategories: ['Smartphones'],
      listingPages: [1, 2],
      postSlugs: ['old-post', 'canonical-post'],
    });
  });

  it('rejects missing identifiers', () => {
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        postSlugs: ['post'],
      }).success
    ).toBe(false);
  });

  it('rejects missing post slugs', () => {
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['ogabassey.com'],
      }).success
    ).toBe(false);
  });

  it('rejects blank strings and invalid listing pages', () => {
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['ogabassey.com', '   '],
        listingPages: [0],
        postSlugs: ['post'],
      }).success
    ).toBe(false);
  });

  it('rejects an invalid merchant ID while keeping it optional for legacy senders', () => {
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['ogabassey.com'],
        merchantId: 'not-a-uuid',
        postSlugs: ['post'],
      }).success
    ).toBe(false);
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['ogabassey.com'],
        postSlugs: ['post'],
      }).success
    ).toBe(true);
  });

  it('rejects unknown payload fields', () => {
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['ogabassey.com'],
        postSlugs: ['post'],
        listingPage: 1,
      }).success
    ).toBe(false);
  });

  it('rejects values above configured boundary limits', () => {
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: Array.from({ length: 21 }, (_, index) => `store-${index}`),
        postSlugs: ['post'],
      }).success
    ).toBe(false);
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['ogabassey.com'],
        postSlugs: Array.from({ length: 251 }, (_, index) => `post-${index}`),
      }).success
    ).toBe(false);
    expect(
      internalRevalidateBlogBodySchema.safeParse({
        identifiers: ['x'.repeat(256)],
        postSlugs: ['post'],
      }).success
    ).toBe(false);
  });
});
