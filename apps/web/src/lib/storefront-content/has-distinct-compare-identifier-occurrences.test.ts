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
});
