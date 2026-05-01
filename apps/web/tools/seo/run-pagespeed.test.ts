import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageSpeedTools } from './run-pagespeed';

describe('run-pagespeed', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
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
      'best-practices',
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
