import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPublicBlogPathname } from './public-blog-path';
import {
  BLOG_FIRST_SEGMENT_PATTERN,
  BLOG_TENANT_SEGMENT_PATTERN,
  RESERVED_FIRST_SEGMENT_PATTERN,
  runWebVitalsHealthCheck,
  WEB_VITALS_HEALTH_QUERY,
} from './web-vitals-health';

/**
 * Applies the EXACT regex patterns embedded in the HogQL `non_blog_pageviews`
 * predicate (no second logic copy) so these tests validate the same
 * classification the query executes server-side.
 */
function hogqlClassifiesPathnameAsBlog(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    new RegExp(BLOG_FIRST_SEGMENT_PATTERN).test(normalized) ||
    (new RegExp(BLOG_TENANT_SEGMENT_PATTERN).test(normalized) &&
      !new RegExp(RESERVED_FIRST_SEGMENT_PATTERN).test(normalized))
  );
}

const CONFIGURED_ENV = {
  POSTHOG_API_KEY: 'phx_api_key',
  POSTHOG_PROJECT_ID: '202711',
};

/**
 * Aggregate row in the SELECT order the query declares:
 * [total, lcp, fcp, ttfb, cls, inp, vitals_pageviews, non_blog_pageviews]
 */
function buildRow(
  overrides: Partial<{
    total: number;
    lcp: number;
    fcp: number;
    ttfb: number;
    cls: number;
    inp: number;
    vitalsPageviews: number;
    nonBlogPageviews: number;
  }> = {}
): Array<number | string | null> {
  const row = {
    total: 500,
    lcp: 100,
    fcp: 95,
    ttfb: 98,
    cls: 100,
    inp: 90,
    vitalsPageviews: 90,
    nonBlogPageviews: 100,
    ...overrides,
  };
  return [
    row.total,
    row.lcp,
    row.fcp,
    row.ttfb,
    row.cls,
    row.inp,
    row.vitalsPageviews,
    row.nonBlogPageviews,
  ];
}

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
) {
  return Promise.resolve({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchJson(row: Array<number | string | null>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => jsonResponse({ results: [row] }))
  );
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_UI_HOST', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('runWebVitalsHealthCheck', () => {
  it('skips fail-open when PostHog server credentials are missing', async () => {
    // Arrange
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // Act
    const result = await runWebVitalsHealthCheck({});

    // Assert
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('posthog_not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('queries the project-scoped HogQL endpoint with the api key', async () => {
    // Arrange
    mockFetchJson(buildRow());

    // Act
    await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://eu.posthog.com/api/projects/202711/query/');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer phx_api_key'
    );
  });

  it('reports ok when the capture ratio is healthy and metrics are balanced', async () => {
    // Arrange
    mockFetchJson(buildRow());

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('ok');
    expect(result.captureRatio).toBeCloseTo(0.9);
    expect(result.warnings).toEqual([]);
  });

  it('flags a low capture ratio below 50%', async () => {
    // Arrange
    mockFetchJson(buildRow({ vitalsPageviews: 30, nonBlogPageviews: 100 }));

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('degraded');
    expect(result.warnings).toContain('low_capture_ratio');
  });

  it('flags the TTFB/FCP inversion signature relative to LCP', async () => {
    // Arrange
    mockFetchJson(buildRow({ lcp: 100, ttfb: 10, fcp: 10 }));

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('degraded');
    expect(result.warnings).toEqual(
      expect.arrayContaining(['ttfb_inversion', 'fcp_inversion'])
    );
  });

  it('coerces null cells from an empty window to a null capture ratio', async () => {
    // Arrange
    mockFetchJson([null, null, null, null, null, null, null, null]);

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('ok');
    expect(result.captureRatio).toBeNull();
    expect(result.counts?.webVitalsTotal).toBe(0);
  });

  it('fails open with an error status on a non-2xx PostHog response', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({}, { ok: false, status: 403 }))
    );

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('error');
    expect(result.reason).toBe('posthog_http_403');
  });

  it('fails open when the fetch itself throws', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down')))
    );

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('error');
    expect(result.reason).toBe('posthog_request_failed');
  });

  it('fails open when the response body does not match the schema', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({ unexpected: true }))
    );

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('error');
    expect(result.reason).toBe('posthog_response_invalid');
  });

  it('fails open with an empty results matrix', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({ results: [] }))
    );

    // Act
    const result = await runWebVitalsHealthCheck(CONFIGURED_ENV);

    // Assert
    expect(result.status).toBe('error');
    expect(result.reason).toBe('posthog_empty_results');
  });
});

describe('WEB_VITALS_HEALTH_QUERY', () => {
  it('derives vitals_pageviews without $pageview_id so pre-boot metrics are counted', () => {
    // Arrange / Act: the numerator must not depend on $pageview_id. Pre-boot
    // TTFB/FCP (and LCP on fast pages) are captured before the first $pageview,
    // so posthog-js attaches no $pageview_id; a count(DISTINCT $pageview_id)
    // would drop them and fire false low_capture_ratio alarms.

    // The explanatory SQL comment names the broken count(DISTINCT $pageview_id)
    // pattern, so strip comment lines and assert against the executable SQL.
    const executableSql = WEB_VITALS_HEALTH_QUERY.split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    // Assert: the numerator is a $pageview_id-independent greatest() over the
    // per-metric counts, never a count(DISTINCT ...).
    expect(executableSql).not.toMatch(/count\(DISTINCT/i);
    expect(executableSql.includes('$pageview_id')).toBe(false);
    expect(executableSql).toContain('AS vitals_pageviews');
    expect(executableSql).toMatch(/greatest\(/);
  });

  it('restricts the denominator to initial document pageviews so SPA navigations do not inflate it', () => {
    // Core Web Vitals fire once per hard document load; posthog-js also captures
    // a fresh $pageview on every SPA route change. posthog-js stamps
    // $prev_pageview_pathname on every pageview EXCEPT the first since the
    // document loaded, so a client-side (SPA) pageview — which carries that
    // property — is excluded from the denominator, while the initial load —
    // which lacks it — is counted. Assert against the executable SQL so an
    // explanatory comment mentioning the property can never satisfy the check.
    const executableSql = WEB_VITALS_HEALTH_QUERY.split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(executableSql).toContain(
      "event = '$pageview'\n    AND properties.$prev_pageview_pathname IS NULL"
    );
  });

  it('matches blog surfaces by path segment, not a naive substring', () => {
    // The old `%/blog%` substring predicate over-excluded any path merely
    // containing "blog" and must be gone.
    expect(WEB_VITALS_HEALTH_QUERY).not.toContain("LIKE '%/blog%'");
    // Segment-anchored regex mirrors the client matcher instead.
    expect(WEB_VITALS_HEALTH_QUERY).toContain(BLOG_FIRST_SEGMENT_PATTERN);
    expect(WEB_VITALS_HEALTH_QUERY).toContain(BLOG_TENANT_SEGMENT_PATTERN);
    expect(WEB_VITALS_HEALTH_QUERY).toContain(RESERVED_FIRST_SEGMENT_PATTERN);
  });
});

describe('non_blog_pageviews blog-surface parity', () => {
  it('excludes real blog surfaces from the denominator', () => {
    // Arrange
    const blogSurfaces = ['/blog', '/blog/', '/blog/some-post'];

    // Act / Assert: dropped by the client → excluded from the denominator.
    for (const pathname of blogSurfaces) {
      expect(hogqlClassifiesPathnameAsBlog(pathname)).toBe(true);
    }
  });

  it('counts blog-ish non-blog paths that the client never drops', () => {
    // Arrange: the exact counter-examples the old substring filter mis-excluded.
    const eligiblePaths = [
      '/',
      '/dashboard/blog-settings',
      '/products/blogger-bag',
      '/dashboard/blog',
      '/admin/blog',
      '/ogabassey/products',
    ];

    // Act / Assert: still eligible → still in the denominator.
    for (const pathname of eligiblePaths) {
      expect(hogqlClassifiesPathnameAsBlog(pathname)).toBe(false);
    }
  });

  it('agrees with the client matcher on platform-host inputs', () => {
    // Arrange: on a platform-path-mode host the HogQL predicate and the client
    // matcher must classify identically so the denominator tracks real drops.
    const cases: Array<{ pathname: string; blog: boolean }> = [
      { pathname: '/blog/some-post', blog: true },
      { pathname: '/ogabassey/blog', blog: true },
      { pathname: '/ogabassey/blog/post-1', blog: true },
      { pathname: '/dashboard/blog-settings', blog: false },
      { pathname: '/products/blogger-bag', blog: false },
      { pathname: '/dashboard/blog', blog: false },
      { pathname: '/ogabassey/products', blog: false },
    ];

    // Act / Assert
    for (const { pathname, blog } of cases) {
      expect(hogqlClassifiesPathnameAsBlog(pathname)).toBe(blog);
      expect(isPublicBlogPathname(pathname, { hostname: 'usebaci.com' })).toBe(
        blog
      );
    }
  });

  it('documents the intentional host-gating approximation', () => {
    // The client gates the tenant `/<slug>/blog` shape on platform hosts, so on
    // a custom domain it is NOT a blog surface. HogQL cannot resolve host per
    // event and treats it as blog regardless — a divergence that only affects a
    // custom-domain `/<slug>/blog`, which effectively never occurs.
    expect(hogqlClassifiesPathnameAsBlog('/ogabassey/blog')).toBe(true);
    expect(
      isPublicBlogPathname('/ogabassey/blog', { hostname: 'ogabassey.com' })
    ).toBe(false);
  });
});
