import { describe, expect, it } from 'vitest';
import {
  extractCanonicalHref,
  extractLocs,
  extractRobotsSitemaps,
} from './run-search-console-readiness';

describe('run-search-console-readiness helpers', () => {
  it('extracts sitemap urls from robots.txt and ignores commented lines', () => {
    expect(
      extractRobotsSitemaps(
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
    expect(extractLocs('')).toEqual([]);
    expect(extractLocs('<urlset><url><loc /></url></urlset>')).toEqual([]);
  });

  it('extracts urls from valid loc elements in order', () => {
    expect(
      extractLocs(
        [
          '<urlset>',
          '<url><loc>https://example.com/page</loc></url>',
          '<url><loc>http://foo.bar/</loc></url>',
          '</urlset>',
        ].join('')
      )
    ).toEqual(['https://example.com/page', 'http://foo.bar/']);
  });

  it('extracts canonical hrefs and ignores alternate links', () => {
    expect(
      extractCanonicalHref(
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
    expect(extractCanonicalHref('<html><head></head></html>')).toBeNull();
  });
});
