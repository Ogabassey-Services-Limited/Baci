import { describe, expect, it } from 'vitest';
import { storefrontProductsRouteParamsSchema } from '@/schemas/storefront-products-route-params';

describe('storefrontProductsRouteParamsSchema', () => {
  it('accepts a non-empty storefront slug', () => {
    expect(
      storefrontProductsRouteParamsSchema.parse({ slug: 'my-product' })
    ).toEqual({
      slug: 'my-product',
    });
  });

  it.each([
    ['single character', 'a'],
    ['numeric', '123'],
    ['hyphenated multi-segment', 'my-product-store'],
    ['maximum length', 'a'.repeat(100)],
  ])('accepts %s storefront slug', (_label, slug) => {
    expect(storefrontProductsRouteParamsSchema.parse({ slug })).toEqual({
      slug,
    });
  });

  it('rejects an empty storefront slug', () => {
    const result = storefrontProductsRouteParamsSchema.safeParse({ slug: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Store slug is required');
  });

  it.each([
    ['missing', {}],
    ['undefined', { slug: undefined }],
    ['null', { slug: null }],
    ['number', { slug: 123 }],
    ['whitespace', { slug: '   ' }],
    ['special characters', { slug: 'bad/slug!' }],
    ['leading hyphen', { slug: '-bad-slug' }],
    ['trailing hyphen', { slug: 'bad-slug-' }],
    ['consecutive hyphens', { slug: 'bad--slug' }],
    ['uppercase letters', { slug: 'BadSlug' }],
    ['underscore', { slug: 'bad_slug' }],
  ])('rejects %s slug values', (_label, value) => {
    const result = storefrontProductsRouteParamsSchema.safeParse(value);

    expect(result.success).toBe(false);
  });

  it('rejects storefront slugs longer than 100 characters', () => {
    const result = storefrontProductsRouteParamsSchema.safeParse({
      slug: 'a'.repeat(101),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Store slug must be 100 characters or fewer'
    );
  });

  it('uses the slug format error for malformed slug strings', () => {
    const result = storefrontProductsRouteParamsSchema.safeParse({
      slug: 'abc--def',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Store slug must contain lowercase letters, numbers, and single hyphens'
    );
  });
});
