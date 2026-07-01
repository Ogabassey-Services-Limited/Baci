import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import {
  fetchVerifierResponse,
  fetchVerifierResponseWithNode,
  parseMaxHtmlBytes,
  runVerifier,
  verifyRoute,
  type VerifierResponse,
} from './verify-ogabassey-blog-seo';

const VALID_HTML = `<!doctype html>
<html>
  <head>
    <title>Blog | Ogabassey</title>
    <meta content="Read expert buying guides, product comparisons, and tech updates from Ogabassey." name="description">
    <link href="https://ogabassey.com/blog" rel="canonical">
    <script type="application/ld+json">{"@context":"https://schema.org"}</script>
  </head>
  <body><a href="/blog/best-phones">Best phones</a></body>
</html>`;

function htmlResponse(
  html = VALID_HTML,
  init: { headers?: Record<string, string>; status?: number } = {}
): VerifierResponse {
  const headers = new Headers({
    vary: 'user-agent',
    'x-baci-metadata-cache-bucket': 'blocking',
    ...(init.headers ?? {}),
  });
  return {
    headers,
    status: init.status ?? 200,
    text: async () => html,
  };
}

async function withServer(
  handler: http.RequestListener,
  callback: (origin: string) => Promise<void>
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('verify-ogabassey-blog-seo', () => {
  it('sends custom Host through the Node request adapter', async () => {
    await withServer(
      (request, response) => {
        response.setHeader('content-type', 'text/plain');
        response.end(request.headers.host ?? 'missing-host');
      },
      async (origin) => {
        const response = await fetchVerifierResponse(origin, {
          headers: { Host: 'ogabassey.com', 'user-agent': 'Googlebot/2.1' },
        });

        expect(await response.text()).toBe('ogabassey.com');
      }
    );
  });

  it('verifies one route and returns headers useful for cache partition proof', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse());

    const result = await verifyRoute({
      fetchImpl,
      hostHeader: 'ogabassey.com',
      maxCanonicalHtmlBytes: 450000,
      now: () => 100,
      origin: 'http://127.0.0.1:3000',
      pathPrefix: '',
      route: '/blog',
      uaName: 'googlebot',
      userAgent: 'Googlebot/2.1',
    });

    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3000/blog', {
      headers: {
        Host: 'ogabassey.com',
        'user-agent': 'Googlebot/2.1',
      },
    });
    expect(result).toMatchObject({
      metadataBucket: 'blocking',
      route: '/blog',
      title: 'Blog | Ogabassey',
      uaName: 'googlebot',
      vary: 'user-agent',
    });
  });

  it('fails when a route falls back to the generic Ogabassey title', async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(VALID_HTML.replace('Blog | Ogabassey', 'Ogabassey'))
    );

    await expect(
      verifyRoute({
        fetchImpl,
        hostHeader: '',
        maxCanonicalHtmlBytes: 450000,
        origin: 'https://ogabassey.com',
        pathPrefix: '',
        route: '/blog',
        uaName: 'browser',
        userAgent: 'Mozilla/5.0',
      })
    ).rejects.toThrow('generic or missing title');
  });

  it('fails when author metadata is non-generic but not route-specific', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse());

    await expect(
      verifyRoute({
        fetchImpl,
        hostHeader: '',
        maxCanonicalHtmlBytes: 450000,
        origin: 'https://ogabassey.com',
        pathPrefix: '',
        route: '/blog/author/bassey-john',
        uaName: 'googlebot',
        userAgent: 'Googlebot/2.1',
      })
    ).rejects.toThrow('missing route-specific title text');
  });

  it('runs every configured route for every configured user agent', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const routeHtml = url.includes('/blog/author/bassey-john')
        ? VALID_HTML.replace(
            'Blog | Ogabassey',
            'Bassey John | Ogabassey'
          )
            .replace(
              'Read expert buying guides, product comparisons, and tech updates from Ogabassey.',
              'Bassey John: Read articles by Bassey John from Ogabassey.'
            )
            .replace(
              'href="https://ogabassey.com/blog"',
              'href="https://ogabassey.com/blog/author/bassey-john"'
            )
        : VALID_HTML;

      return htmlResponse(routeHtml);
    });
    const logger = vi.fn();

    const results = await runVerifier(
      {
        hostHeader: '',
        maxCanonicalHtmlBytes: 450000,
        origin: 'https://ogabassey.com',
        pathPrefix: '',
        routes: ['/blog', '/blog/author/bassey-john'],
        userAgents: { browser: 'Mozilla/5.0', googlebot: 'Googlebot/2.1' },
      },
      { fetchImpl, logger, now: () => 100 }
    );

    expect(results).toHaveLength(4);
    expect(logger).toHaveBeenCalledTimes(4);
  });

  it('fails when the canonical points at a query-string URL instead of the clean route', async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(
        VALID_HTML.replace(
          'href="https://ogabassey.com/blog"',
          'href="https://ogabassey.com/blog?page=2"'
        )
      )
    );

    await expect(
      verifyRoute({
        fetchImpl,
        hostHeader: '',
        maxCanonicalHtmlBytes: 450000,
        origin: 'https://ogabassey.com',
        pathPrefix: '',
        route: '/blog',
        uaName: 'browser',
        userAgent: 'Mozilla/5.0',
      })
    ).rejects.toThrow('canonical must point at the clean /blog URL');
  });

  it('fails when the canonical points at the wrong host', async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(
        VALID_HTML.replace(
          'href="https://ogabassey.com/blog"',
          'href="https://evil.example.com/blog"'
        )
      )
    );

    await expect(
      verifyRoute({
        fetchImpl,
        hostHeader: 'ogabassey.com',
        maxCanonicalHtmlBytes: 450000,
        origin: 'http://127.0.0.1:3000',
        pathPrefix: '',
        route: '/blog',
        uaName: 'googlebot',
        userAgent: 'Googlebot/2.1',
      })
    ).rejects.toThrow('canonical must point at the clean /blog URL');
  });

  it('reports the real UTF-8 byte length, not UTF-16 code units', async () => {
    // "€" is 1 UTF-16 code unit but 3 UTF-8 bytes; multibyte content must be
    // measured as bytes for the size budget check.
    const multibyteHtml = VALID_HTML.replace(
      'Best phones',
      `Best phones ${'€'.repeat(500)}`
    );
    const fetchImpl = vi.fn(async () => htmlResponse(multibyteHtml));

    const result = await verifyRoute({
      fetchImpl,
      hostHeader: '',
      maxCanonicalHtmlBytes: 450000,
      now: () => 100,
      origin: 'https://ogabassey.com',
      pathPrefix: '',
      route: '/blog',
      uaName: 'browser',
      userAgent: 'Mozilla/5.0',
    });

    expect(result.bytes).toBe(Buffer.byteLength(multibyteHtml, 'utf8'));
    // UTF-8 byte count exceeds the UTF-16 code-unit length for multibyte HTML.
    expect(result.bytes).toBeGreaterThan(multibyteHtml.length);
  });

  it('rejects when the Node request adapter exceeds the timeout', async () => {
    await withServer(
      () => {
        // Never send a response so the request must time out.
      },
      async (origin) => {
        await expect(
          fetchVerifierResponseWithNode(
            origin,
            { Host: 'ogabassey.com', 'user-agent': 'Googlebot/2.1' },
            50
          )
        ).rejects.toThrow('timed out');
      }
    );
  });

  it('parses OGABASSEY_VERIFY_MAX_HTML_BYTES and rejects invalid values', () => {
    expect(parseMaxHtmlBytes(undefined)).toBe(450_000);
    expect(parseMaxHtmlBytes('')).toBe(450_000);
    expect(parseMaxHtmlBytes('120000')).toBe(120_000);
    expect(() => parseMaxHtmlBytes('not-a-number')).toThrow(
      'must be a positive integer'
    );
    expect(() => parseMaxHtmlBytes('0')).toThrow('must be a positive integer');
    // Strict: partial parses and decimals are rejected.
    expect(() => parseMaxHtmlBytes('120000px')).toThrow(
      'must be a positive integer'
    );
    expect(() => parseMaxHtmlBytes('1.5')).toThrow('must be a positive integer');
  });
});
