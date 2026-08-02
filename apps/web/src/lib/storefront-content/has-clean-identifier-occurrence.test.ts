import { describe, expect, it } from 'vitest';
import { hasCleanIdentifierOccurrence } from './has-clean-identifier-occurrence';

describe('hasCleanIdentifierOccurrence', () => {
  it('returns false for an empty identifier token list', () => {
    const post = {
      slug: 'generic-guide',
      title: 'Generic buyer guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(hasCleanIdentifierOccurrence(post, [])).toBe(false);
  });

  it('matches a clean model mention while excluding variant suffixes', () => {
    const post = {
      slug: 'iphone-15-variants',
      title: 'iPhone 15 and iPhone 15 storage guide',
      excerpt: null,
      category: 'Smartphones',
      tags: ['iPhone 15 Pro'],
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(hasCleanIdentifierOccurrence(post, ['15'])).toBe(true);
  });

  it('rejects an occurrence followed by a variant marker', () => {
    const post = {
      slug: 'iphone-15-pro-only',
      title: 'iPhone 15 Pro storage guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(hasCleanIdentifierOccurrence(post, ['15'])).toBe(false);
  });

  it('requires the requested brand to qualify a colliding model occurrence', () => {
    const post = {
      slug: 'watch-ultra-compare',
      title: 'Apple and Samsung Watch Ultra Buyer Guide',
      excerpt: null,
      category: 'Smartwatches',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(
      hasCleanIdentifierOccurrence(post, ['watch', 'ultra'], {
        brand: 'apple',
        knownBrands: ['apple', 'samsung'],
      })
    ).toBe(false);
    expect(
      hasCleanIdentifierOccurrence(post, ['watch', 'ultra'], {
        brand: 'samsung',
        knownBrands: ['apple', 'samsung'],
      })
    ).toBe(true);
  });

  it('requires the complete ordered variant discriminator', () => {
    const hybridPost = {
      slug: 'iphone-15-hybrid-storage-guide',
      title: 'iPhone 15 8GB 128GB storage guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: 6,
    };
    const completePost = {
      ...hybridPost,
      slug: 'iphone-15-esim-storage-guide',
      title: 'Apple iPhone 15 128GB eSIM storage guide',
    };

    expect(
      hasCleanIdentifierOccurrence(hybridPost, ['15'], {
        brand: 'apple',
        knownBrands: ['apple'],
        discriminatorTokens: ['128gb', 'esim'],
      })
    ).toBe(false);
    expect(
      hasCleanIdentifierOccurrence(completePost, ['15'], {
        brand: 'apple',
        knownBrands: ['apple'],
        discriminatorTokens: ['128gb', 'esim'],
      })
    ).toBe(true);
  });
});
