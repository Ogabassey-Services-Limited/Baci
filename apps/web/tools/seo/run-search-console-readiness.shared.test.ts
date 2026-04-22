import { describe, expect, it } from 'vitest';
import { searchConsoleReadinessShared } from './run-search-console-readiness.shared';

describe('run-search-console-readiness shared helpers', () => {
  it('extracts sitemap urls from robots.txt and ignores commented lines', () => {
    expect(
      searchConsoleReadinessShared.extractRobotsSitemaps(
        [
          'User-agent: *',
          '# Sitemap: https://ignored.example/sitemap.xml',
          'Sitemap: https://usebaci.com/sitemap.xml',
          'Sitemap: https://ogabassey.com/sitemap/static.xml',
        ].join('\n')
      )
    ).toEqual([
      'https://usebaci.com/sitemap.xml',
      'https://ogabassey.com/sitemap/static.xml',
    ]);
  });

  it('returns an empty list for missing or self-closing loc values', () => {
    expect(searchConsoleReadinessShared.extractLocs('')).toEqual([]);
    expect(
      searchConsoleReadinessShared.extractLocs(
        '<urlset><url><loc /></url></urlset>'
      )
    ).toEqual([]);
  });

  it('extracts urls from valid loc elements in order', () => {
    expect(
      searchConsoleReadinessShared.extractLocs(
        [
          '<urlset>',
          '<url><loc>https://example.com/page</loc></url>',
          '<url><loc>http://foo.bar/</loc></url>',
          '</urlset>',
        ].join('')
      )
    ).toEqual(['https://example.com/page', 'http://foo.bar/']);
  });

  it('decodes xml and html entities in loc and canonical values', () => {
    expect(
      searchConsoleReadinessShared.extractLocs(
        '<urlset><url><loc>https://example.com/search?q=phones&amp;sort=asc&#47;popular</loc></url></urlset>'
      )
    ).toEqual(['https://example.com/search?q=phones&sort=asc/popular']);

    expect(
      searchConsoleReadinessShared.extractCanonicalHref(
        '<html><head><link rel="canonical" href="https://usebaci.com/pricing?plan=growth&amp;currency=NGN" /></head></html>'
      )
    ).toBe('https://usebaci.com/pricing?plan=growth&currency=NGN');
  });

  it('preserves invalid numeric entities instead of throwing', () => {
    expect(
      searchConsoleReadinessShared.extractLocs(
        '<urlset><url><loc>https://example.com/search?q=test&#x110000;</loc></url></urlset>'
      )
    ).toEqual(['https://example.com/search?q=test&#x110000;']);
  });

  it('extracts canonical hrefs and ignores alternate links', () => {
    expect(
      searchConsoleReadinessShared.extractCanonicalHref(
        [
          '<html><head>',
          '<link rel="alternate" href="https://usebaci.com/fr" />',
          '<link rel="canonical" href="https://usebaci.com/" />',
          '</head></html>',
        ].join('')
      )
    ).toBe('https://usebaci.com/');
  });

  it('returns null when canonical markup is missing', () => {
    expect(
      searchConsoleReadinessShared.extractCanonicalHref(
        '<html><head></head></html>'
      )
    ).toBeNull();
  });

  it('matches equivalent urls when query parameter ordering differs', () => {
    expect(
      searchConsoleReadinessShared.urlsMatch(
        'https://usebaci.com/pricing?currency=NGN&plan=growth&tag=b&tag=a',
        'https://usebaci.com/pricing?tag=a&plan=growth&tag=b&currency=NGN'
      )
    ).toBe(true);
  });
});
