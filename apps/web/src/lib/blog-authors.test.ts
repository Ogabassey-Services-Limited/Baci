import { describe, expect, it } from 'vitest';
import {
  getBlogAuthorBySlug,
  getBlogAuthorSameAs,
  getBlogAuthorSlugs,
  hasBlogAuthorPage,
} from './blog-authors';

describe('getBlogAuthorSameAs', () => {
  it('returns the personal profile links for a known author (slug-matched)', () => {
    expect(getBlogAuthorSameAs('Bassey John', 'ogabassey')).toEqual([
      'https://www.instagram.com/bassey__j',
      'https://www.linkedin.com/in/bassey-john-6a277885',
      'https://x.com/digitalogaa',
    ]);
    expect(getBlogAuthorSameAs('Bolakale', 'ogabassey')).toEqual([
      'https://www.instagram.com/earthmover007',
      'https://www.linkedin.com/in/michael-bolakale',
      'https://x.com/earthmover007',
    ]);
  });

  it('does not leak OgaBassey author profiles into other merchant schemas', () => {
    expect(getBlogAuthorSameAs('Bassey John', 'another-store')).toEqual([]);
    expect(getBlogAuthorSameAs('Bolakale', 'example.com')).toEqual([]);
  });

  it('does not mix the company social media into an author (distinct entities)', () => {
    const sameAs = getBlogAuthorSameAs('Bassey John', 'ogabassey.com');
    expect(
      sameAs.every(
        (url) => url.includes('bassey') || url.includes('digitalogaa')
      )
    ).toBe(true);
  });

  it('returns an empty array for unknown or unnamed authors', () => {
    expect(getBlogAuthorSameAs('Ogabassey AI', 'ogabassey')).toEqual([]);
    expect(getBlogAuthorSameAs('', 'ogabassey')).toEqual([]);
    expect(getBlogAuthorSameAs(null, 'ogabassey')).toEqual([]);
    expect(getBlogAuthorSameAs(undefined, 'ogabassey')).toEqual([]);
  });
});

describe('OgaBassey blog author profile helpers', () => {
  it('resolves author pages only for OgaBassey tenant identifiers', () => {
    expect(getBlogAuthorBySlug('bassey-john', 'ogabassey')).toMatchObject({
      name: 'Bassey John',
    });
    expect(getBlogAuthorBySlug('Bassey-John', 'OgaBassey.COM')).toMatchObject({
      name: 'Bassey John',
    });
    expect(getBlogAuthorBySlug('bassey-john', 'another-store')).toBeNull();
  });

  it('reports author page availability only for OgaBassey tenants', () => {
    expect(hasBlogAuthorPage('Bolakale', 'ogabassey.com')).toBe(true);
    expect(hasBlogAuthorPage('Bolakale', 'another-store')).toBe(false);
  });

  it('only links bylines that exactly match the canonical author name', () => {
    // The hub fetches with `.eq('author_name', <canonical>)`, so a case/
    // whitespace variant must NOT link (it would be excluded from the hub).
    expect(hasBlogAuthorPage('Bassey John', 'ogabassey.com')).toBe(true);
    expect(hasBlogAuthorPage('bassey john', 'ogabassey.com')).toBe(false);
    expect(hasBlogAuthorPage('Bassey John ', 'ogabassey.com')).toBe(false);
  });

  it('does not resolve inherited Object keys as author profiles', () => {
    expect(getBlogAuthorBySlug('constructor', 'ogabassey')).toBeNull();
    expect(hasBlogAuthorPage('constructor', 'ogabassey')).toBe(false);
    expect(getBlogAuthorSameAs('constructor', 'ogabassey')).toEqual([]);
  });

  it('lists the known author slugs for OgaBassey static author routes', () => {
    expect(getBlogAuthorSlugs()).toEqual(['bassey-john', 'bolakale']);
  });
});
