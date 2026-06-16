import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('storefront /news-sitemap.xml route', () => {
  it('permanently redirects to the canonical blog News sitemap on the same host', () => {
    const response = GET(new Request('https://ogabassey.com/news-sitemap.xml'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://ogabassey.com/blog/news-sitemap.xml'
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400'
    );
  });
});
