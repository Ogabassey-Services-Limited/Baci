import { describe, expect, it } from 'vitest';
import { getBlogAuthorSameAs } from './blog-authors';

describe('getBlogAuthorSameAs', () => {
  it('returns the personal profile links for a known author (slug-matched)', () => {
    expect(getBlogAuthorSameAs('Bassey John')).toEqual([
      'https://www.instagram.com/bassey__j',
      'https://www.linkedin.com/in/bassey-john-6a277885',
      'https://x.com/digitalogaa',
    ]);
    expect(getBlogAuthorSameAs('Bolakale')).toEqual([
      'https://www.instagram.com/earthmover007',
      'https://www.linkedin.com/in/michael-bolakale',
      'https://x.com/earthmover007',
    ]);
  });

  it('does not mix the company social media into an author (distinct entities)', () => {
    const sameAs = getBlogAuthorSameAs('Bassey John');
    expect(
      sameAs.every(
        (url) => url.includes('bassey') || url.includes('digitalogaa')
      )
    ).toBe(true);
  });

  it('returns an empty array for unknown or unnamed authors', () => {
    expect(getBlogAuthorSameAs('Ogabassey AI')).toEqual([]);
    expect(getBlogAuthorSameAs('')).toEqual([]);
    expect(getBlogAuthorSameAs(null)).toEqual([]);
    expect(getBlogAuthorSameAs(undefined)).toEqual([]);
  });
});
