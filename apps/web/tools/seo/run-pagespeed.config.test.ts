import { describe, expect, it } from 'vitest';
import { AUDIT_THRESHOLDS, CATEGORY_THRESHOLDS } from './run-pagespeed.config';

describe('run-pagespeed config', () => {
  it('enforces the current storefront Core Web Vitals targets', () => {
    expect(CATEGORY_THRESHOLDS).toMatchObject({
      performance: 0.9,
      accessibility: 0.9,
      seo: 0.9,
      'best-practices': 0.9,
    });
    expect(AUDIT_THRESHOLDS).toMatchObject({
      lcp: 2500,
      cls: 0.1,
      tbt: 200,
      inp: 200,
    });
  });
});
