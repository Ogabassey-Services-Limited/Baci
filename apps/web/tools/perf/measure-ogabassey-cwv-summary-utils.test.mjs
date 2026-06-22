import { describe, expect, it } from 'vitest';
import {
  getFieldMetric,
  summarizeDebugBearResult,
  summarizePsiResult,
} from './measure-ogabassey-cwv-summary-utils.mjs';

describe('getFieldMetric', () => {
  it('uses URL-level field data when PageSpeed returns the requested URL', () => {
    expect(
      getFieldMetric(
        {
          loadingExperience: {
            id: 'https://ogabassey.com/',
            metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3200 } },
          },
        },
        'https://ogabassey.com/',
        'LARGEST_CONTENTFUL_PAINT_MS'
      )
    ).toEqual({ category: undefined, p75: 3200, scope: 'url' });
  });

  it('labels origin fallback field data explicitly', () => {
    expect(
      getFieldMetric(
        {
          loadingExperience: {
            id: 'https://ogabassey.com',
            metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4400 } },
          },
          originLoadingExperience: {
            id: 'https://ogabassey.com',
            metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4500 } },
          },
        },
        'https://ogabassey.com/blog/post',
        'LARGEST_CONTENTFUL_PAINT_MS'
      )
    ).toEqual({ category: undefined, p75: 4400, scope: 'origin' });
  });

  it('normalizes PageSpeed CLS percentiles from hundredths', () => {
    expect(
      getFieldMetric(
        {
          loadingExperience: {
            id: 'https://ogabassey.com/',
            metrics: {
              CUMULATIVE_LAYOUT_SHIFT_SCORE: {
                category: 'FAST',
                percentile: 10,
              },
            },
          },
        },
        'https://ogabassey.com/',
        'CUMULATIVE_LAYOUT_SHIFT_SCORE'
      )
    ).toEqual({ category: 'FAST', p75: 0.1, scope: 'url' });
  });
});

describe('summarizePsiResult', () => {
  it('summarizes lab, scores, and field metrics', () => {
    expect(
      summarizePsiResult({
        label: 'home',
        requestedUrl: 'https://ogabassey.com/',
        strategy: 'mobile',
        payload: {
          lighthouseResult: {
            finalUrl: 'https://ogabassey.com/',
            categories: {
              performance: { score: 0.91 },
              seo: { score: 1 },
              accessibility: { score: 0.96 },
              'best-practices': { score: 1 },
            },
            audits: {
              'first-contentful-paint': { numericValue: 1000 },
              'largest-contentful-paint': { numericValue: 3000 },
              'total-blocking-time': { numericValue: 50 },
              'cumulative-layout-shift': { numericValue: 0.01 },
              'speed-index': { numericValue: 3500 },
            },
          },
          loadingExperience: {
            id: 'https://ogabassey.com/',
            metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4800 } },
          },
        },
      })
    ).toMatchObject({
      a11y: 96,
      bp: 100,
      fieldLcp: { p75: 4800, scope: 'url' },
      fcpMs: 1000,
      label: 'home',
      lcpMs: 3000,
      performance: 91,
      seo: 100,
      source: 'psi',
      speedIndexMs: 3500,
      strategy: 'mobile',
      tbtMs: 50,
    });
  });
});

describe('summarizeDebugBearResult', () => {
  it('normalizes DebugBear metrics-backed scores and vitals', () => {
    expect(
      summarizeDebugBearResult({
        label: 'pdp',
        url: 'https://ogabassey.com/pdp',
        device: 'Mobile',
        projectId: '102065',
        quickTestId: '1431',
        region: 'uk',
        body: {
          resultUrl:
            'https://www.debugbear.com/project/102065/quickTest/x/overview',
          metrics: {
            'performance.score': 0.88,
            'seo.score': 1,
            'accessibility.score': 0.97,
            'bestPractices.score': 1,
            'performance.firstContentfulPaint': 1385,
            'performance.largestContentfulPaint': 2587,
            'performance.totalBlockingTime': 382,
            'performance.cumulativeLayoutShift': 0,
            'performance.speedIndex': 2354,
            'console.totalErrors': 0,
            'pageWeight.total': 768615,
          },
        },
      })
    ).toMatchObject({
      a11y: 97,
      bp: 100,
      cls: 0,
      consoleErrors: 0,
      device: 'Mobile',
      fcpMs: 1385,
      label: 'pdp',
      lcpMs: 2587,
      pageWeightKb: 750.6,
      performance: 88,
      projectId: '102065',
      quickTestId: '1431',
      region: 'uk',
      seo: 100,
      source: 'debugbear',
      speedIndexMs: 2354,
      tbtMs: 382,
    });
  });
});
