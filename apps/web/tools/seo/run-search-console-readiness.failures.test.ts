import { describe, expect, it, vi } from 'vitest';
import { runSearchConsoleReadinessAudit } from './run-search-console-readiness';

describe('run-search-console-readiness failures', () => {
  it('records platform fetch failures as issues instead of throwing', async () => {
    const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
      const url = String(input);

      if (url === 'https://usebaci.com/robots.txt') {
        return Promise.resolve(new Response('', { status: 503 }));
      }

      if (url === 'https://usebaci.com/sitemap.xml') {
        return Promise.reject(new Error('connection reset'));
      }

      if (url === 'https://usebaci.com/') {
        return Promise.resolve(new Response('', { status: 504 }));
      }

      return Promise.resolve(new Response('', { status: 404 }));
    });

    const result = await runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: [],
      platformOrigin: 'https://usebaci.com',
    });

    expect(result.passed).toBe(false);
    expect(result.surfaces[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'failed to fetch robots.txt: https://usebaci.com/robots.txt'
        ),
        expect.stringContaining(
          'failed to fetch root sitemap: https://usebaci.com/sitemap.xml'
        ),
        expect.stringContaining(
          'failed to fetch homepage: https://usebaci.com/'
        ),
      ])
    );
  });

  it('records rejected merchant sitemap fetches instead of throwing', async () => {
    const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
      const url = String(input);
      const mockResponses = new Map<
        string,
        { body: BodyInit | null; status?: number }
      >([
        [
          'https://usebaci.com/robots.txt',
          {
            body: 'User-agent: *\nAllow: /\nSitemap: https://usebaci.com/sitemap.xml',
          },
        ],
        [
          'https://usebaci.com/sitemap.xml',
          {
            body: `<?xml version="1.0"?><urlset>
              <url><loc>https://usebaci.com/</loc></url>
              <url><loc>https://usebaci.com/pricing</loc></url>
              <url><loc>https://usebaci.com/features</loc></url>
              <url><loc>https://usebaci.com/blog</loc></url>
            </urlset>`,
          },
        ],
        [
          'https://usebaci.com/',
          {
            body: '<html><head><link rel="canonical" href="https://usebaci.com/" /></head></html>',
          },
        ],
        [
          'https://ogabassey.com/robots.txt',
          {
            body: [
              'User-agent: *',
              'Allow: /',
              'Sitemap: https://ogabassey.com/sitemap/static.xml',
              'Sitemap: https://ogabassey.com/sitemap/products.xml',
              'Sitemap: https://ogabassey.com/sitemap/categories.xml',
              'Sitemap: https://ogabassey.com/blog/sitemap.xml',
            ].join('\n'),
          },
        ],
        [
          'https://ogabassey.com/sitemap/static.xml',
          {
            body: `<?xml version="1.0"?><urlset>
              <url><loc>https://ogabassey.com</loc></url>
            </urlset>`,
          },
        ],
        [
          'https://ogabassey.com/',
          {
            body: '<html><head><link rel="canonical" href="https://ogabassey.com/" /></head></html>',
          },
        ],
        [
          'https://ogabassey.com/blog/sitemap.xml',
          { body: '<?xml version="1.0"?><urlset />' },
        ],
        [
          'https://ogabassey.com/sitemap/categories.xml',
          { body: '<?xml version="1.0"?><urlset />' },
        ],
      ]);

      if (url === 'https://ogabassey.com/sitemap/products.xml') {
        return Promise.reject(new Error('socket hang up'));
      }

      const response = mockResponses.get(url) ?? { body: '', status: 404 };
      return Promise.resolve(
        new Response(response.body, { status: response.status ?? 200 })
      );
    });

    const result = await runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: ['https://ogabassey.com'],
      platformOrigin: 'https://usebaci.com',
    });

    const merchantSurface = result.surfaces.find(
      (surface) => surface.kind === 'merchant'
    );

    expect(result.passed).toBe(false);
    expect(merchantSurface?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'merchant sitemap https://ogabassey.com/sitemap/products.xml is unreachable: socket hang up'
        ),
      ])
    );
  });

  it('records 404 merchant sitemap fetches instead of throwing', async () => {
    const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
      const url = String(input);
      const mockResponses = new Map<
        string,
        { body: BodyInit | null; status?: number }
      >([
        [
          'https://usebaci.com/robots.txt',
          {
            body: 'User-agent: *\nAllow: /\nSitemap: https://usebaci.com/sitemap.xml',
          },
        ],
        [
          'https://usebaci.com/sitemap.xml',
          {
            body: `<?xml version="1.0"?><urlset>
              <url><loc>https://usebaci.com/</loc></url>
              <url><loc>https://usebaci.com/pricing</loc></url>
              <url><loc>https://usebaci.com/features</loc></url>
              <url><loc>https://usebaci.com/blog</loc></url>
            </urlset>`,
          },
        ],
        [
          'https://usebaci.com/',
          {
            body: '<html><head><link rel="canonical" href="https://usebaci.com/" /></head></html>',
          },
        ],
        [
          'https://ogabassey.com/robots.txt',
          {
            body: [
              'User-agent: *',
              'Allow: /',
              'Sitemap: https://ogabassey.com/sitemap/static.xml',
              'Sitemap: https://ogabassey.com/sitemap/products.xml',
              'Sitemap: https://ogabassey.com/sitemap/categories.xml',
              'Sitemap: https://ogabassey.com/blog/sitemap.xml',
            ].join('\n'),
          },
        ],
        [
          'https://ogabassey.com/sitemap/static.xml',
          {
            body: `<?xml version="1.0"?><urlset>
              <url><loc>https://ogabassey.com</loc></url>
            </urlset>`,
          },
        ],
        [
          'https://ogabassey.com/',
          {
            body: '<html><head><link rel="canonical" href="https://ogabassey.com/" /></head></html>',
          },
        ],
        [
          'https://ogabassey.com/sitemap/products.xml',
          { body: '<?xml version="1.0"?><urlset />' },
        ],
        [
          'https://ogabassey.com/blog/sitemap.xml',
          { body: '<?xml version="1.0"?><urlset />' },
        ],
        [
          'https://ogabassey.com/sitemap/categories.xml',
          { body: '', status: 404 },
        ],
      ]);

      const response = mockResponses.get(url) ?? { body: '', status: 404 };
      return Promise.resolve(
        new Response(response.body, { status: response.status ?? 200 })
      );
    });

    const result = await runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: ['https://ogabassey.com'],
      platformOrigin: 'https://usebaci.com',
    });

    const merchantSurface = result.surfaces.find(
      (surface) => surface.kind === 'merchant'
    );

    expect(result.passed).toBe(false);
    expect(merchantSurface?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'merchant sitemap https://ogabassey.com/sitemap/categories.xml is unreachable: Request failed for https://ogabassey.com/sitemap/categories.xml with status 404'
        ),
      ])
    );
  });

  it('keeps reporting other merchants when one merchant surface fails outright', async () => {
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
      if (url.startsWith('https://broken.example')) {
        return Promise.reject(new Error('tls failure'));
      }

      return Promise.resolve(
        new Response(responses.get(url) ?? '', {
          status: responses.has(url) ? 200 : 404,
        })
      );
    });

    const result = await runSearchConsoleReadinessAudit({
      fetchImpl,
      merchantOrigins: [
        'notaurl',
        'https://ogabassey.com',
        'https://broken.example',
      ],
      platformOrigin: 'https://usebaci.com',
    });

    expect(result.surfaces).toHaveLength(4);
    expect(result.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origin: 'notaurl',
          kind: 'merchant',
          passed: false,
          issues: [expect.stringContaining('failed to audit merchant surface')],
        }),
        expect.objectContaining({
          origin: 'https://ogabassey.com',
          kind: 'merchant',
          passed: true,
        }),
        expect.objectContaining({
          origin: 'https://broken.example',
          kind: 'merchant',
          passed: false,
          issues: expect.arrayContaining([
            expect.stringContaining('failed to fetch merchant robots.txt'),
          ]),
        }),
      ])
    );
  });
});
