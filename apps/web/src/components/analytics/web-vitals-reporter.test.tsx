import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebVitalsReporter } from './web-vitals-reporter';

const mocks = vi.hoisted(() => ({
  hasPostHogBrowserInitialized: vi.fn(() => true),
  capturePostHogWebVitals: vi.fn(),
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

vi.mock('@/lib/posthog/browser-state', () => ({
  hasPostHogBrowserInitialized: mocks.hasPostHogBrowserInitialized,
}));

vi.mock('@/lib/posthog/browser', () => ({
  capturePostHogWebVitals: mocks.capturePostHogWebVitals,
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
  mocks.hasPostHogBrowserInitialized.mockReturnValue(true);
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'gtag');
});

describe('WebVitalsReporter', () => {
  it('captures a flat web_vitals event with attribution when PostHog is initialized', async () => {
    render(<WebVitalsReporter debug={false} />);

    await vi.waitFor(() => {
      expect(mocks.capturePostHogWebVitals).toHaveBeenCalledOnce();
    });
    expect(mocks.capturePostHogWebVitals).toHaveBeenCalledWith(
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

  it('does not capture to PostHog when the browser client has not booted', async () => {
    mocks.hasPostHogBrowserInitialized.mockReturnValue(false);

    render(<WebVitalsReporter debug={false} />);

    await vi.waitFor(() => {
      expect(mocks.hasPostHogBrowserInitialized).toHaveBeenCalled();
    });
    expect(mocks.capturePostHogWebVitals).not.toHaveBeenCalled();
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
  });
});
