import { describe, expect, it } from 'vitest';
import { hasDistinctCompareIdentifierOccurrences } from './has-distinct-compare-identifier-occurrences';

describe('hasDistinctCompareIdentifierOccurrences', () => {
  it('rejects one identifier occurrence for two same-model variants', () => {
    const result = hasDistinctCompareIdentifierOccurrences(
      {
        slug: 'ipad-10-wifi-cellular-guide',
        title: 'Apple iPad 10 Wi-Fi Cellular Buyer Guide',
        excerpt: null,
        category: 'Tablets',
        tags: ['tablets'],
        keywords: ['buyer guide'],
        featured_image_url: null,
        published_at: null,
        reading_time_minutes: null,
      },
      ['10', '10']
    );

    expect(result).toBe(false);
  });

  it('accepts two occurrences for two same-model variants', () => {
    const result = hasDistinctCompareIdentifierOccurrences(
      {
        slug: 'ipad-10-wifi-vs-cellular',
        title: 'Apple iPad 10 Wi-Fi vs Apple iPad 10 Cellular',
        excerpt: null,
        category: 'Tablets',
        tags: ['tablets'],
        keywords: ['comparison'],
        featured_image_url: null,
        published_at: null,
        reading_time_minutes: null,
      },
      ['10', '10']
    );

    expect(result).toBe(true);
  });

  it('rejects repeated standalone metadata as separate compared products', () => {
    const result = hasDistinctCompareIdentifierOccurrences(
      {
        slug: 'ipad-10-wifi-cellular-guide',
        title: 'Apple iPad 10 Wi-Fi Cellular Buyer Guide',
        excerpt: 'Apple iPad 10 Wi-Fi Cellular buying advice.',
        category: 'Tablets',
        tags: ['tablets'],
        keywords: ['buyer guide'],
        featured_image_url: null,
        published_at: null,
        reading_time_minutes: null,
      },
      ['10', '10']
    );

    expect(result).toBe(false);
  });

  it('rejects repeated same-model mentions inside one standalone title', () => {
    const result = hasDistinctCompareIdentifierOccurrences(
      {
        slug: 'ipad-10-wifi-cellular-review',
        title:
          'Apple iPad 10 Wi-Fi Cellular Review: Is the iPad 10 Worth Buying?',
        excerpt: null,
        category: 'Tablets',
        tags: ['tablets'],
        keywords: ['buyer guide'],
        featured_image_url: null,
        published_at: null,
        reading_time_minutes: null,
      },
      ['10', '10']
    );

    expect(result).toBe(false);
  });

  it('inherits the model for a shorthand variant-only comparison segment', () => {
    const result = hasDistinctCompareIdentifierOccurrences(
      {
        slug: 'iphone-15-128gb-vs-256gb',
        title: 'Apple iPhone 15 128GB vs 256GB Comparison',
        excerpt: null,
        category: 'Smartphones',
        tags: ['smartphones'],
        keywords: ['comparison'],
        featured_image_url: null,
        published_at: null,
        reading_time_minutes: null,
      },
      ['15', '15']
    );

    expect(result).toBe(true);
  });

  it('does not inherit the model across a different branded product segment', () => {
    const result = hasDistinctCompareIdentifierOccurrences(
      {
        slug: 'iphone-15-vs-galaxy-s25',
        title: 'Apple iPhone 15 128GB vs Samsung Galaxy S25 256GB',
        excerpt: null,
        category: 'Smartphones',
        tags: ['smartphones'],
        keywords: ['comparison'],
        featured_image_url: null,
        published_at: null,
        reading_time_minutes: null,
      },
      ['15', '15']
    );

    expect(result).toBe(false);
  });
});
