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

  it('rejects a numeric identifier used as a list count without model context', () => {
    const post = {
      slug: 'apple-phones-reasons',
      title: 'Apple Phones: 15 Reasons to Upgrade',
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

  it('accepts a numeric identifier adjacent to a model family', () => {
    const post = {
      slug: 'iphone-15-guide',
      title: 'Apple iPhone 15 Buyer Guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(hasCleanIdentifierOccurrence(post, ['15'])).toBe(true);
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

  it('keeps an exact laptop model before a split display-size suffix', () => {
    const post = {
      slug: 'dell-latitude-5410-14-inch-guide',
      title: 'Dell Latitude 5410 14-inch Buyer Guide',
      excerpt: null,
      category: 'Laptops',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: 6,
    };

    expect(hasCleanIdentifierOccurrence(post, ['latitude', '5410'])).toBe(true);
  });

  it('keeps an exact model before a split decimal display-size suffix', () => {
    const post = {
      slug: 'iphone-15-6-1-inch-guide',
      title: 'Apple iPhone 15 6.1-inch Buyer Guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: 6,
    };

    expect(hasCleanIdentifierOccurrence(post, ['15'])).toBe(true);
  });

  it('keeps an exact model before a split storage suffix', () => {
    const post = {
      slug: 'iphone-15-64-gb-guide',
      title: 'Apple iPhone 15 64 GB Buyer Guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: 6,
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

  it('accepts a brand that finishes before the identifier', () => {
    const post = {
      slug: 'apple-iphone-14-pro-guide',
      title: 'Apple iPhone 14 Pro buyer guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    const result = hasCleanIdentifierOccurrence(post, ['14', 'pro'], {
      brand: 'apple',
      requireBrandBeforeIdentifier: true,
    });

    expect(result).toBe(true);
  });

  it('accepts an unambiguous model after descriptive words from its brand', () => {
    const post = {
      slug: 'tecno-spark-40-buyer-guide',
      title: "Tecno's Latest Affordable Smartphone: The Spark 40 Buyer Guide",
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(
      hasCleanIdentifierOccurrence(post, ['spark', '40'], {
        brand: 'tecno',
        requireBrandBeforeIdentifier: true,
      })
    ).toBe(true);
  });

  it('rejects a brand at or after the identifier when ordering is required', () => {
    const post = {
      slug: 'iphone-14-pro-apple-guide',
      title: '14 Pro Apple buyer guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    const result = hasCleanIdentifierOccurrence(post, ['14', 'pro'], {
      brand: 'apple',
      requireBrandBeforeIdentifier: true,
    });

    expect(result).toBe(false);
  });

  it('rejects a multi-token brand that overlaps the identifier', () => {
    const post = {
      slug: 'north-star-x-guide',
      title: 'North Star X buyer guide',
      excerpt: null,
      category: 'Accessories',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    const result = hasCleanIdentifierOccurrence(post, ['star', 'x'], {
      brand: 'north star',
      requireBrandBeforeIdentifier: true,
    });

    expect(result).toBe(false);
  });

  it('accepts a configured alias that starts the product identifier', () => {
    const post = {
      slug: 'thinkpad-t14-gen-4-buyer-guide',
      title: 'ThinkPad T14 Gen 4 buyer guide',
      excerpt: null,
      category: 'Laptops',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    expect(
      hasCleanIdentifierOccurrence(post, ['thinkpad', 't14', 'gen', '4'], {
        brand: 'lenovo',
        knownBrands: ['lenovo'],
        brandAliases: { lenovo: ['lenovo', 'thinkpad'] },
        requireBrandBeforeIdentifier: true,
        allowBrandAliasOverlap: true,
      })
    ).toBe(true);
  });

  it('preserves after-identifier matching when ordering is disabled', () => {
    const post = {
      slug: 'iphone-14-pro-apple-guide',
      title: '14 Pro Apple buyer guide',
      excerpt: null,
      category: 'Smartphones',
      tags: null,
      keywords: null,
      featured_image_url: null,
      published_at: null,
      reading_time_minutes: null,
    };

    const result = hasCleanIdentifierOccurrence(post, ['14', 'pro'], {
      brand: 'apple',
      requireBrandBeforeIdentifier: false,
    });

    expect(result).toBe(true);
  });
});
