import { describe, expect, it } from 'vitest';
import { categorySlugSchema, RESERVED_CATEGORY_SLUGS } from './category-slug';

describe('categorySlugSchema', () => {
  it.each([
    'phones',
    'mobile-phones',
    'a',
    'x1-y2-z3',
  ])('accepts %s', (slug) => {
    expect(categorySlugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['uppercase', 'Phones'],
    ['spaces', 'mobile phones'],
    ['a leading dash', '-phones'],
    ['a trailing dash', 'phones-'],
    ['a double dash', 'mobile--phones'],
    ['a slash (path traversal)', 'a/b'],
    ['a dot segment', '..'],
    ['unicode', 'phönes'],
  ])('rejects %s', (_label, slug) => {
    expect(categorySlugSchema.safeParse(slug).success).toBe(false);
  });

  it('rejects a slug the storefront read RPCs would refuse (>64 bytes)', () => {
    expect(categorySlugSchema.safeParse('a'.repeat(65)).success).toBe(false);
    expect(categorySlugSchema.safeParse('a'.repeat(64)).success).toBe(true);
  });

  describe('reserved storefront segments', () => {
    it.each([
      'new-arrivals',
      'best-sellers',
      'on-sale',
      'featured',
    ])('rejects the virtual collection slug %s', (slug) => {
      expect(categorySlugSchema.safeParse(slug).success).toBe(false);
    });

    it('rejects every reserved slug', () => {
      // A category slugged `cart` is unreachable at its own URL: the STATIC
      // route wins over the dynamic category route.
      for (const reserved of RESERVED_CATEGORY_SLUGS) {
        expect(categorySlugSchema.safeParse(reserved).success).toBe(false);
      }
    });

    it('names the reason so the merchant can act on it', () => {
      const result = categorySlugSchema.safeParse('checkout');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/reserved/i);
      }
    });

    it('still accepts a slug that merely CONTAINS a reserved word', () => {
      // Only exact first-segment collisions shadow a route.
      expect(categorySlugSchema.safeParse('cart-accessories').success).toBe(
        true
      );
    });
  });
});
