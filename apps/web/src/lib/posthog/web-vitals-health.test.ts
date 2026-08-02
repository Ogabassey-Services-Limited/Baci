import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWebVitalsHealthCheck } from './web-vitals-health';

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
