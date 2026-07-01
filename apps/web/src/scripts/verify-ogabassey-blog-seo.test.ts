import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import {
  expectedRouteTextForRoute,
  extractMetaContent,
  fetchVerifierResponse,
  hasDescription,
  routePath,
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
  it('prefixes paths for local path-mode storefront verification', () => {
    expect(routePath('/blog', '/ogabassey.com')).toBe('/ogabassey.com/blog');
    expect(routePath('/blog', '/ogabassey.com/')).toBe('/ogabassey.com/blog');
  });

  it('reads description meta content regardless of attribute order', () => {
    expect(extractMetaContent(VALID_HTML, 'description')).toContain('Ogabassey');
    expect(hasDescription(VALID_HTML)).toBe(true);
  });

  it('derives route-specific text expectations for author and category pages', () => {
    expect(expectedRouteTextForRoute('/blog/category/smartphones')).toEqual({
      description: ['Smartphones'],
      title: ['Smartphones'],
    });
    expect(expectedRouteTextForRoute('/blog/author/bassey-john')).toEqual({
      description: ['Bassey John'],
      title: ['Bassey John'],
    });
  });

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
          ).replace(
            'Read expert buying guides, product comparisons, and tech updates from Ogabassey.',
            'Bassey John: Read articles by Bassey John from Ogabassey.'
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
});
