import { describe, expect, it } from 'vitest';
import { countCleanIdentifierOccurrences } from './count-clean-identifier-occurrences';

describe('countCleanIdentifierOccurrences', () => {
  it('counts distinct clean model mentions while excluding variant suffixes', () => {
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

    expect(countCleanIdentifierOccurrences(post, ['15'])).toBe(2);
  });
});
