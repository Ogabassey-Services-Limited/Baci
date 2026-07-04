import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebVitalsReporter } from './web-vitals-reporter';

const mocks = vi.hoisted(() => ({
  reportPostHogWebVital: vi.fn(),
  lcpMetric: {
    name: 'LCP',
    value: 2400,
    id: 'v1-lcp',
    rating: 'good',
    navigationType: 'navigate',
    attribution: {
      target: 'main > img',
      url: 'https://cdn.example/hero.png',
      timeToFirstByte: 100,
      resourceLoadDelay: 20,
      resourceLoadDuration: 200,
      elementRenderDelay: 80,
    },
  },
}));

vi.mock('@/lib/posthog/report-web-vital', () => ({
  reportPostHogWebVital: mocks.reportPostHogWebVital,
}));

vi.mock('web-vitals/attribution', () => ({
  onLCP: (callback: (metric: unknown) => void) => callback(mocks.lcpMetric),
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onTTFB: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'gtag');
});

describe('WebVitalsReporter', () => {
  it('forwards a flat web_vitals payload with attribution to the queue-aware reporter', async () => {
    render(<WebVitalsReporter debug={false} />);

    await vi.waitFor(() => {
      expect(mocks.reportPostHogWebVital).toHaveBeenCalledOnce();
    });
    expect(mocks.reportPostHogWebVital).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'LCP',
        value: 2400,
        rating: 'good',
        navigationType: 'navigate',
        pathname: '/',
        debugTarget: 'main > img',
        lcpUrl: 'https://cdn.example/hero.png',
        ttfb: 100,
        renderDelay: 80,
      })
    );
  });

  it('still reports the metric to GA4 when gtag is present', async () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;

    render(<WebVitalsReporter debug={false} />);

    await vi.waitFor(() => {
      expect(gtag).toHaveBeenCalledWith(
        'event',
        'LCP',
        expect.objectContaining({
          value: 2400,
          metric_rating: 'good',
          navigation_type: 'navigate',
          non_interaction: true,
        })
      );
    });
    // GA4 delivery is independent of the PostHog leg but both fire per metric.
    expect(mocks.reportPostHogWebVital).toHaveBeenCalledOnce();
  });
});
