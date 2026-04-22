import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPageSpeedTargets,
  buildPsiUrl,
  evaluatePageSpeedResult,
  parseStrategies,
  runPageSpeedAudit,
} from './run-pagespeed';

describe('run-pagespeed', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('builds platform targets and appends extra absolute urls', () => {
    expect(
      buildPageSpeedTargets({
        baseUrl: 'https://usebaci.com',
        extraUrls: ['https://ogabassey.com'],
      })
    ).toEqual([
      { label: 'home', url: 'https://usebaci.com/' },
      { label: 'pricing', url: 'https://usebaci.com/pricing' },
      { label: 'features', url: 'https://usebaci.com/features' },
      { label: 'blog', url: 'https://usebaci.com/blog' },
      { label: 'contact', url: 'https://usebaci.com/contact' },
      { label: 'extra-1', url: 'https://ogabassey.com/' },
    ]);
  });

  it('throws for invalid extra target urls instead of silently skipping them', () => {
    expect(() =>
      buildPageSpeedTargets({
        baseUrl: 'https://usebaci.com',
        extraUrls: ['notaurl'],
      })
    ).toThrow('Invalid PageSpeed target URL "notaurl"');
  });

  it('parses strategies and falls back to mobile when input is empty', () => {
    expect(parseStrategies('mobile,desktop')).toEqual(['mobile', 'desktop']);
    expect(parseStrategies()).toEqual(['mobile']);
    expect(parseStrategies(' , ')).toEqual(['mobile']);
  });

  it('throws for invalid PageSpeed strategies', () => {
    expect(() => parseStrategies('tablet,mobile')).toThrow(
      'Invalid PageSpeed strategies: tablet. Allowed values: mobile, desktop'
    );
  });

  it('builds the PSI API url with repeated categories', () => {
    const url = new URL(
      buildPsiUrl({
        apiKey: 'secret',
        strategy: 'mobile',
        targetUrl: 'https://usebaci.com/pricing',
      })
    );

    expect(url.origin).toBe('https://www.googleapis.com');
    expect(url.searchParams.get('url')).toBe('https://usebaci.com/pricing');
    expect(url.searchParams.get('strategy')).toBe('mobile');
    expect(url.searchParams.get('key')).toBe('secret');
    expect(url.searchParams.getAll('category')).toEqual([
      'performance',
      'accessibility',
      'best-practices',
      'seo',
    ]);
  });

  it('flags threshold breaches in the parsed report', () => {
    const result = evaluatePageSpeedResult({
      lighthouseResult: {
        categories: {
          performance: { score: 0.72 },
          accessibility: { score: 0.95 },
          seo: { score: 0.81 },
          'best-practices': { score: 0.86 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 3200 },
          'cumulative-layout-shift': { numericValue: 0.12 },
          'total-blocking-time': { numericValue: 180 },
          'interaction-to-next-paint': { numericValue: 260 },
        },
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.metric)).toEqual([
      'performance',
      'seo',
      'lcp',
      'cls',
    ]);
  });

  it('prefers field INP from CrUX data and enforces the 200ms threshold', () => {
    const result = evaluatePageSpeedResult({
      loadingExperience: {
        metrics: {
          INTERACTION_TO_NEXT_PAINT: { percentile: 240 },
        },
      },
      lighthouseResult: {
        categories: {
          performance: { score: 0.92 },
          accessibility: { score: 0.99 },
          seo: { score: 0.98 },
          'best-practices': { score: 0.95 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 1800 },
          'cumulative-layout-shift': { numericValue: 0.04 },
          'total-blocking-time': { numericValue: 90 },
          'interaction-to-next-paint': { numericValue: 400 },
        },
      },
    });

    expect(result.failures).toContainEqual({
      metric: 'inp',
      actual: 240,
      threshold: 200,
    });
    expect(result.vitals.inp).toBe(240);
  });

  it('runs the audit across targets and strategies using the provided fetch', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            lighthouseResult: {
              categories: {
                performance: { score: 0.92 },
                accessibility: { score: 0.99 },
                seo: { score: 0.98 },
                'best-practices': { score: 0.95 },
              },
              audits: {
                'largest-contentful-paint': { numericValue: 1800 },
                'cumulative-layout-shift': { numericValue: 0.04 },
                'total-blocking-time': { numericValue: 90 },
                'interaction-to-next-paint': { numericValue: 180 },
              },
            },
          })
        )
    );

    const results = await runPageSpeedAudit({
      apiKey: undefined,
      baseUrl: 'https://usebaci.com',
      extraUrls: [],
      fetchImpl,
      strategies: ['mobile'],
    });

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.passed)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('throws when the PSI request returns a non-ok response', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
          status: 429,
        })
    );

    await expect(
      runPageSpeedAudit({
        apiKey: undefined,
        baseUrl: 'https://usebaci.com',
        extraUrls: [],
        fetchImpl,
        strategies: ['mobile'],
      })
    ).rejects.toThrow(
      'PageSpeed Insights request failed for https://usebaci.com/ (mobile) with status 429'
    );
  });

  it('aborts stuck PSI requests with a target-specific timeout error', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PAGE_SPEED_TIMEOUT_MS', '100');
    const fetchImpl: typeof fetch = vi.fn(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    );
    const pendingAudit = runPageSpeedAudit({
      apiKey: undefined,
      baseUrl: 'https://usebaci.com',
      extraUrls: [],
      fetchImpl,
      strategies: ['mobile'],
    });
    const timeoutExpectation = expect(pendingAudit).rejects.toThrow(
      'PageSpeed Insights request timed out for https://usebaci.com/ (mobile)'
    );

    await vi.advanceTimersByTimeAsync(100);

    await timeoutExpectation;
  });
});
