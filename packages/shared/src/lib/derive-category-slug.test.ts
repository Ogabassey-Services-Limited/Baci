import { describe, expect, it } from 'vitest';
import {
  deriveCategorySlug,
  MAX_CATEGORY_SLUG_LENGTH,
} from './derive-category-slug';

describe('deriveCategorySlug', () => {
  it.each([
    ['Phones', 'phones'],
    ['Mobile Phones', 'mobile-phones'],
    ['  Padded  Name  ', 'padded-name'],
    ['Phones & Tablets', 'phones-tablets'],
    ['Phones---Tablets', 'phones-tablets'],
    ['UPPER CASE', 'upper-case'],
    ['Cameras (DSLR)', 'cameras-dslr'],
    ['2-in-1 Laptops', '2-in-1-laptops'],
  ])('turns %s into %s', (name, expected) => {
    expect(deriveCategorySlug(name)).toBe(expected);
  });

  it('transliterates accented Latin instead of shredding it', () => {
    // "t-l-phones" would be a valid slug but a useless URL.
    expect(deriveCategorySlug('Téléphones')).toBe('telephones');
  });

  describe('bugfix: names the mobile generator could not slug', () => {
    it.each([
      ['a non-Latin script', '手机'],
      ['punctuation only', '!!!'],
      ['whitespace only', '   '],
      ['an empty string', ''],
    ])('returns null for %s rather than an empty slug', (_label, name) => {
      // The mobile admin used to POST the empty result, which the route
      // rejected with a 400 the merchant could not act on.
      expect(deriveCategorySlug(name)).toBeNull();
    });
  });

  describe('length bound', () => {
    it('never exceeds the schema maximum', () => {
      const slug = deriveCategorySlug(`${'word '.repeat(60)}end`);

      expect(slug).not.toBeNull();
      expect((slug as string).length).toBeLessThanOrEqual(
        MAX_CATEGORY_SLUG_LENGTH
      );
    });

    it('truncates on a word boundary, never mid-word or on a dash', () => {
      const slug = deriveCategorySlug(`${'alpha '.repeat(40)}omega`);

      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(slug?.endsWith('-')).toBe(false);
    });

    it('keeps a single over-long word rather than returning null', () => {
      const slug = deriveCategorySlug('a'.repeat(200));

      expect(slug).toBe('a'.repeat(MAX_CATEGORY_SLUG_LENGTH));
    });

    it('matches the byte bound the storefront read RPCs enforce', () => {
      // octet_length(p_category_slug) > 64 is rejected by the public read
      // path, so a longer slug would create an unreadable category.
      expect(MAX_CATEGORY_SLUG_LENGTH).toBe(64);

      const slug = deriveCategorySlug('word '.repeat(40));
      expect(
        new TextEncoder().encode(slug as string).length
      ).toBeLessThanOrEqual(64);
    });
  });

  it('produces slugs the storefront route contract accepts', () => {
    for (const name of ['Phones', 'Phones & Tablets', 'Téléphones', '2-in-1']) {
      const slug = deriveCategorySlug(name);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
