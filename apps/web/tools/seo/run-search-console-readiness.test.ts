import { describe, expect, it, vi } from 'vitest';
import { searchConsoleReadiness } from './run-search-console-readiness';

describe('run-search-console-readiness', () => {
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
          <url><loc>https://ogabassey.com</loc></url>
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

    const result = await searchConsoleReadiness.runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: ['https://ogabassey.com'],
      platformOrigin: 'https://usebaci.com',
    });

    expect(result.passed).toBe(true);
    expect(result.surfaces).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(9);
    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        'https://usebaci.com/robots.txt',
        'https://usebaci.com/sitemap.xml',
        'https://usebaci.com/',
        'https://ogabassey.com/robots.txt',
        'https://ogabassey.com/sitemap/static.xml',
        'https://ogabassey.com/',
        'https://ogabassey.com/sitemap/products.xml',
        'https://ogabassey.com/sitemap/categories.xml',
        'https://ogabassey.com/blog/sitemap.xml',
      ])
    );
  });

  it('flags missing robots, sitemap, canonical, and excluded-path issues on the platform surface', async () => {
    const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url === 'https://usebaci.com/robots.txt') {
        return Promise.resolve(
          new Response('User-agent: *\nAllow: /', { status: 200 })
        );
      }
      if (url === 'https://usebaci.com/sitemap.xml') {
        return Promise.resolve(
          new Response(
            `<?xml version="1.0"?><urlset>
              <url><loc>https://usebaci.com/login</loc></url>
            </urlset>`,
            { status: 200 }
          )
        );
      }
      if (url === 'https://usebaci.com/') {
        return Promise.resolve(
          new Response(
            '<html><head><link rel="canonical" href="https://usebaci.com/pricing" /></head></html>',
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });

    const result = await searchConsoleReadiness.runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: [],
      platformOrigin: 'https://usebaci.com',
    });

    expect(result.passed).toBe(false);
    expect(result.surfaces[0]?.issues).toEqual(
      expect.arrayContaining([
        'robots.txt is missing https://usebaci.com/sitemap.xml',
        'root sitemap is missing https://usebaci.com/',
        'root sitemap is missing https://usebaci.com/pricing',
        'root sitemap is missing https://usebaci.com/features',
        'root sitemap is missing https://usebaci.com/blog',
        'root sitemap should not expose https://usebaci.com/login',
        'homepage canonical mismatch: expected https://usebaci.com/',
      ])
    );
  });

  it('treats equivalent platform sitemap urls as matches when trailing slashes differ', async () => {
    const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url === 'https://usebaci.com/robots.txt') {
        return Promise.resolve(
          new Response(
            'User-agent: *\nAllow: /\nSitemap: https://usebaci.com/sitemap.xml',
            { status: 200 }
          )
        );
      }
      if (url === 'https://usebaci.com/sitemap.xml') {
        return Promise.resolve(
          new Response(
            `<?xml version="1.0"?><urlset>
              <url><loc>https://usebaci.com/</loc></url>
              <url><loc>https://usebaci.com/pricing/</loc></url>
              <url><loc>https://usebaci.com/features/</loc></url>
              <url><loc>https://usebaci.com/blog/</loc></url>
              <url><loc>https://usebaci.com/login/</loc></url>
            </urlset>`,
            { status: 200 }
          )
        );
      }
      if (url === 'https://usebaci.com/') {
        return Promise.resolve(
          new Response(
            '<html><head><link rel="canonical" href="https://usebaci.com/" /></head></html>',
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });

    const result = await searchConsoleReadiness.runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: [],
      platformOrigin: 'https://usebaci.com',
    });

    expect(result.passed).toBe(false);
    expect(result.surfaces[0]?.issues).toContain(
      'root sitemap should not expose https://usebaci.com/login'
    );
    expect(result.surfaces[0]?.issues).not.toEqual(
      expect.arrayContaining([
        'root sitemap is missing https://usebaci.com/pricing',
        'root sitemap is missing https://usebaci.com/features',
        'root sitemap is missing https://usebaci.com/blog',
      ])
    );
  });
});
