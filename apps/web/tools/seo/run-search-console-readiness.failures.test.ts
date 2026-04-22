import { describe, expect, it, vi } from 'vitest';
import { searchConsoleReadiness } from './run-search-console-readiness';

interface MockResponseConfig {
  body: BodyInit | null;
  status?: number;
}

const PLATFORM_SUCCESS_RESPONSES = [
  [
    'https://usebaci.com/robots.txt',
    {
      body: 'User-agent: *\nAllow: /\nSitemap: https://usebaci.com/sitemap.xml',
    },
  ],
  [
    'https://usebaci.com/sitemap.xml',
    {
      body: buildXmlSitemap([
        'https://usebaci.com/',
        'https://usebaci.com/pricing',
        'https://usebaci.com/features',
        'https://usebaci.com/blog',
      ]),
    },
  ],
  [
    'https://usebaci.com/',
    { body: buildCanonicalPage('https://usebaci.com/') },
  ],
] satisfies ReadonlyArray<readonly [string, MockResponseConfig]>;

const MERCHANT_SUCCESS_RESPONSES = [
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
    { body: buildXmlSitemap(['https://ogabassey.com']) },
  ],
  [
    'https://ogabassey.com/sitemap/products.xml',
    { body: '<?xml version="1.0"?><urlset />' },
  ],
  [
    'https://ogabassey.com/sitemap/categories.xml',
    { body: '<?xml version="1.0"?><urlset />' },
  ],
  [
    'https://ogabassey.com/blog/sitemap.xml',
    { body: '<?xml version="1.0"?><urlset />' },
  ],
  [
    'https://ogabassey.com/',
    { body: buildCanonicalPage('https://ogabassey.com/') },
  ],
] satisfies ReadonlyArray<readonly [string, MockResponseConfig]>;

describe('run-search-console-readiness failures', () => {
  it('records platform fetch failures as issues instead of throwing', async () => {
    const fetchImpl = createFetchImpl({
      rejects: {
        'https://usebaci.com/sitemap.xml': new Error('connection reset'),
      },
      responses: buildResponses([
        ['https://usebaci.com/robots.txt', { body: '', status: 503 }],
        ['https://usebaci.com/', { body: '', status: 504 }],
      ]),
    });

    const result = await searchConsoleReadiness.runSearchConsoleReadinessAudit({
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

  it('records rejected and 404 merchant sitemap fetches instead of throwing', async () => {
    const rejectedFetchImpl = createFetchImpl({
      rejects: {
        'https://ogabassey.com/sitemap/products.xml': new Error(
          'socket hang up'
        ),
      },
    });
    const rejectedResult =
      await searchConsoleReadiness.runSearchConsoleReadinessAudit({
        fetchImpl: rejectedFetchImpl,
        merchantOrigins: ['https://ogabassey.com'],
        platformOrigin: 'https://usebaci.com',
      });

    expect(
      rejectedResult.surfaces.find((surface) => surface.kind === 'merchant')
        ?.issues
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'merchant sitemap https://ogabassey.com/sitemap/products.xml is unreachable: socket hang up'
        ),
      ])
    );

    const notFoundFetchImpl = createFetchImpl({
      responses: buildResponses([
        [
          'https://ogabassey.com/sitemap/categories.xml',
          { body: '', status: 404 },
        ],
      ]),
    });
    const notFoundResult =
      await searchConsoleReadiness.runSearchConsoleReadinessAudit({
        fetchImpl: notFoundFetchImpl,
        merchantOrigins: ['https://ogabassey.com'],
        platformOrigin: 'https://usebaci.com',
      });

    expect(
      notFoundResult.surfaces.find((surface) => surface.kind === 'merchant')
        ?.issues
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'merchant sitemap https://ogabassey.com/sitemap/categories.xml is unreachable: Request failed for https://ogabassey.com/sitemap/categories.xml with status 404'
        ),
      ])
    );
  });

  it('keeps reporting other merchants when one merchant surface fails outright', async () => {
    const fetchImpl = createFetchImpl({
      rejects: {
        'https://broken.example/robots.txt': new Error('tls failure'),
      },
    });

    const result = await searchConsoleReadiness.runSearchConsoleReadinessAudit({
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

  it('fails readiness when merchant origin config contains invalid entries', async () => {
    const result =
      await searchConsoleReadiness.runConfiguredSearchConsoleReadinessAudit({
        fetchImpl: createFetchImpl(),
        merchantOriginsEnv: 'https://ogabassey.com, notaurl',
        platformOrigin: 'https://usebaci.com',
      });

    expect(result.passed).toBe(false);
    expect(result.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origin: 'https://ogabassey.com',
          kind: 'merchant',
          passed: true,
        }),
        expect.objectContaining({
          origin: 'notaurl',
          kind: 'merchant',
          passed: false,
          issues: ['invalid merchant origin in SEO_MERCHANT_ORIGINS: notaurl'],
        }),
      ])
    );
  });
});

function buildCanonicalPage(url: string) {
  return `<html><head><link rel="canonical" href="${url}" /></head></html>`;
}

function buildResponses(
  overrides: ReadonlyArray<readonly [string, MockResponseConfig]> = []
) {
  return new Map<string, MockResponseConfig>([
    ...PLATFORM_SUCCESS_RESPONSES,
    ...MERCHANT_SUCCESS_RESPONSES,
    ...overrides,
  ]);
}

function buildXmlSitemap(urls: string[]) {
  return `<?xml version="1.0"?><urlset>${urls
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join('')}</urlset>`;
}

function createFetchImpl({
  rejects = {},
  responses = buildResponses(),
}: {
  rejects?: Record<string, Error>;
  responses?: Map<string, MockResponseConfig>;
} = {}) {
  const fetchImpl: typeof fetch = vi.fn((input: string | URL) => {
    const url = String(input);
    const rejectedError = rejects[url];

    if (rejectedError) {
      return Promise.reject(rejectedError);
    }

    const response = responses.get(url) ?? { body: '', status: 404 };
    return Promise.resolve(
      new Response(response.body, { status: response.status ?? 200 })
    );
  });

  return fetchImpl;
}
