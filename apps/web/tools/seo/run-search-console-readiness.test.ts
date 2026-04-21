import { describe, expect, it, vi } from 'vitest';
import {
  extractCanonicalHref,
  extractLocs,
  extractRobotsSitemaps,
  runSearchConsoleReadinessAudit,
} from './run-search-console-readiness';

describe('run-search-console-readiness', () => {
  it('extracts sitemap urls from robots.txt', () => {
    expect(
      extractRobotsSitemaps(
        'User-agent: *\nAllow: /\nSitemap: https://usebaci.com/sitemap.xml\nSitemap: https://ogabassey.com/sitemap/static.xml'
      )
    ).toEqual([
      'https://usebaci.com/sitemap.xml',
      'https://ogabassey.com/sitemap/static.xml',
    ]);
  });

  it('extracts loc values from sitemap xml', () => {
    expect(
      extractLocs(`<?xml version="1.0"?><urlset>
        <url><loc>https://usebaci.com/</loc></url>
        <url><loc>https://usebaci.com/pricing</loc></url>
      </urlset>`)
    ).toEqual(['https://usebaci.com/', 'https://usebaci.com/pricing']);
  });

  it('extracts canonical hrefs from html', () => {
    expect(
      extractCanonicalHref(
        '<html><head><link rel="canonical" href="https://usebaci.com/" /></head></html>'
      )
    ).toBe('https://usebaci.com/');
  });

  it('validates platform and merchant crawl surfaces with live-like responses', async () => {
    const responses = new Map<string, string>([
      [
        'https://usebaci.com/robots.txt',
        'User-agent: *\nAllow: /\nSitemap: https://usebaci.com/sitemap.xml',
      ],
      [
        'https://usebaci.com/sitemap.xml',
        `<?xml version="1.0"?><urlset>
          <url><loc>https://usebaci.com/</loc></url>
          <url><loc>https://usebaci.com/pricing</loc></url>
          <url><loc>https://usebaci.com/features</loc></url>
          <url><loc>https://usebaci.com/blog</loc></url>
        </urlset>`,
      ],
      [
        'https://usebaci.com/',
        '<html><head><link rel="canonical" href="https://usebaci.com/" /></head></html>',
      ],
      [
        'https://ogabassey.com/robots.txt',
        [
          'User-agent: *',
          'Allow: /',
          'Sitemap: https://ogabassey.com/sitemap/static.xml',
          'Sitemap: https://ogabassey.com/sitemap/products.xml',
          'Sitemap: https://ogabassey.com/sitemap/categories.xml',
          'Sitemap: https://ogabassey.com/blog/sitemap.xml',
        ].join('\n'),
      ],
      [
        'https://ogabassey.com/sitemap/static.xml',
        `<?xml version="1.0"?><urlset>
          <url><loc>https://ogabassey.com/</loc></url>
          <url><loc>https://ogabassey.com/faq</loc></url>
        </urlset>`,
      ],
      [
        'https://ogabassey.com/sitemap/products.xml',
        '<?xml version="1.0"?><urlset />',
      ],
      [
        'https://ogabassey.com/sitemap/categories.xml',
        '<?xml version="1.0"?><urlset />',
      ],
      [
        'https://ogabassey.com/blog/sitemap.xml',
        '<?xml version="1.0"?><urlset />',
      ],
      [
        'https://ogabassey.com/',
        '<html><head><link rel="canonical" href="https://ogabassey.com/" /></head></html>',
      ],
    ]);

    const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
      const url = String(input);
      const body = responses.get(url);

      if (!body) {
        return Promise.resolve(new Response('', { status: 404 }));
      }

      return Promise.resolve(new Response(body, { status: 200 }));
    });

    const result = await runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: ['https://ogabassey.com'],
      platformOrigin: 'https://usebaci.com',
    });

    expect(result.passed).toBe(true);
    expect(result.surfaces).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(9);
    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://usebaci.com/robots.txt',
      'https://usebaci.com/sitemap.xml',
      'https://usebaci.com/',
      'https://ogabassey.com/robots.txt',
      'https://ogabassey.com/sitemap/static.xml',
      'https://ogabassey.com/',
      'https://ogabassey.com/sitemap/products.xml',
      'https://ogabassey.com/sitemap/categories.xml',
      'https://ogabassey.com/blog/sitemap.xml',
    ]);
  });
});
