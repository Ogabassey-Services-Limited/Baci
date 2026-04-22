import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageSpeedTools } from './run-pagespeed';

describe('run-pagespeed', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('builds platform targets and appends extra absolute urls', () => {
    expect(
      pageSpeedTools.buildPageSpeedTargets({
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
      pageSpeedTools.buildPageSpeedTargets({
        baseUrl: 'https://usebaci.com',
        extraUrls: ['notaurl'],
      })
    ).toThrow('Invalid PageSpeed target URL "notaurl"');
  });

  it('parses strategies and falls back to mobile when input is empty', () => {
    expect(pageSpeedTools.parseStrategies('mobile,desktop')).toEqual([
      'mobile',
      'desktop',
    ]);
    expect(pageSpeedTools.parseStrategies()).toEqual(['mobile']);
    expect(pageSpeedTools.parseStrategies(' , ')).toEqual(['mobile']);
  });

  it('throws for invalid PageSpeed strategies', () => {
    expect(() => pageSpeedTools.parseStrategies('tablet,mobile')).toThrow(
      'Invalid PageSpeed strategies: tablet. Allowed values: mobile, desktop'
    );
  });

  it('builds the PSI API url with repeated categories', () => {
    const url = new URL(
      pageSpeedTools.buildPsiUrl({
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
    const result = pageSpeedTools.evaluatePageSpeedResult({
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
      'inp',
    ]);
    expect(result.vitals.inp).toBe(260);
  });

  it('prefers field INP from CrUX data and enforces the 200ms threshold', () => {
    const result = pageSpeedTools.evaluatePageSpeedResult({
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

  it('falls back to lab INP when CrUX data is unavailable', () => {
    const result = pageSpeedTools.evaluatePageSpeedResult({
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
          'interaction-to-next-paint': { numericValue: 240 },
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

  it('fails when both field and lab INP are missing', () => {
    const result = pageSpeedTools.evaluatePageSpeedResult({
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
        },
      },
    });

    expect(result.failures).toContainEqual({
      metric: 'inp',
      actual: null,
      threshold: 200,
    });
    expect(result.vitals.inp).toBeNull();
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

    const results = await pageSpeedTools.runPageSpeedAudit({
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
});
