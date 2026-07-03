'use client';

import { useEffect } from 'react';
import { hasPostHogBrowserInitialized } from '@/lib/posthog/browser-state';
import { extractWebVitalAttribution } from './web-vital-attribution';
import { buildWebVitalEndpointPayload } from './web-vital-endpoint-payload';

/**
 * Web Vitals Reporter Component
 *
 * Reports Core Web Vitals to Google Analytics 4 and console (in development).
 * These metrics are crucial for SEO and Google Search ranking.
 *
 * Uses dynamic imports for web-vitals to ensure proper bundling with Turbopack.
 *
 * Metrics tracked:
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - INP (Interaction to Next Paint) - Responsiveness (replaced FID in 2024)
 * - LCP (Largest Contentful Paint) - Loading performance
 * - FCP (First Contentful Paint) - Initial render time
 * - TTFB (Time to First Byte) - Server response time
 *
 * @see https://web.dev/vitals/
 */

interface WebVitalsReporterProps {
  /**
   * Enable debug logging to console
   * @default process.env.NODE_ENV === 'development'
   */
  debug?: boolean;
  /**
   * Custom endpoint to send metrics to (optional)
   * If not provided, metrics are sent to GA4 via gtag
   */
  endpoint?: string;
}

// Thresholds for metric quality (good/needs improvement/poor)
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

function getMetricRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'needs-improvement';

  if (value <= threshold.good) return 'good';
  if (value >= threshold.poor) return 'poor';
  return 'needs-improvement';
}

interface WebVitalMetric {
  name: string;
  value: number;
  id: string;
  rating: string;
  navigationType: string;
  attribution?: unknown;
}

/**
 * Emits a single flat `web_vitals` event to PostHog for a metric report. Guards
 * on `hasPostHogBrowserInitialized()` first so it never triggers the posthog-js
 * chunk load — when PostHog has not booted yet the metric is dropped (acceptable;
 * WebVitalsReporter must not eagerly boot PostHog). When PostHog is initialized
 * its browser module is already loaded, so this dynamic import resolves from cache.
 */
function reportWebVitalToPostHog(metric: WebVitalMetric): void {
  if (typeof window === 'undefined' || !hasPostHogBrowserInitialized()) {
    return;
  }

  void import('@/lib/posthog/browser')
    .then(({ capturePostHogWebVitals }) => {
      capturePostHogWebVitals({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
        pathname: globalThis.location?.pathname ?? '',
        ...extractWebVitalAttribution(metric),
      });
    })
    .catch(() => {
      // PostHog capture is best-effort; ignore load/capture failures.
    });
}

function handleWebVitalMetric(
  metric: WebVitalMetric,
  debug: boolean,
  endpoint: string | undefined
): void {
  // Debug logging
  if (debug) {
    const rating = getMetricRating(metric.name, metric.value);
    const color =
      rating === 'good'
        ? 'color: green'
        : rating === 'poor'
          ? 'color: red'
          : 'color: orange';

    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(metric.name === 'CLS' ? 3 : 0)}ms (${rating})`,
      color
    );
  }

  // Send to GA4 if available
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { gtag?: unknown }).gtag
  ) {
    const gtag = (window as unknown as { gtag: (...args: unknown[]) => void })
      .gtag;
    // GA4 collects custom event parameters immediately. To use them in GA4 UI
    // reporting, register the relevant event-scoped custom dimensions/metrics
    // in the GA property; otherwise keep high-cardinality selectors/URLs for
    // DebugView or BigQuery export analysis.
    gtag('event', metric.name, {
      value: Math.round(
        metric.name === 'CLS' ? metric.value * 1000 : metric.value
      ),
      event_label: metric.id,
      metric_rating: metric.rating,
      navigation_type: metric.navigationType,
      non_interaction: true,
      ...extractWebVitalAttribution(metric),
    });
  }

  // Send to PostHog if the browser client has already booted (never boots it).
  reportWebVitalToPostHog(metric);

  // Send to custom endpoint if provided
  if (endpoint) {
    const body = JSON.stringify(buildWebVitalEndpointPayload(metric));

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body);
    } else {
      fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Ignore errors during beacon send
      });
    }
  }
}

async function registerWebVitals(
  debug: boolean,
  endpoint: string | undefined
): Promise<void> {
  try {
    // Dynamic import to avoid Turbopack bundling issues
    // Attribution build: emits metric.attribution (LCP element, CLS shift
    // target, INP target) so the FIELD reveals WHICH node is slow/shifting.
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import(
      'web-vitals/attribution'
    );
    const handleMetric = (metric: WebVitalMetric) =>
      handleWebVitalMetric(metric, debug, endpoint);

    // Register all web vitals observers
    onCLS(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);
  } catch (err) {
    if (debug) {
      console.warn('[Web Vitals] Failed to load:', err);
    }
  }
}

const DEFAULT_DEBUG = process.env.NODE_ENV === 'development';

export function WebVitalsReporter({
  debug = DEFAULT_DEBUG,
  endpoint,
}: WebVitalsReporterProps = {}) {
  useEffect(() => {
    void registerWebVitals(debug, endpoint);
  }, [debug, endpoint]);

  // This component doesn't render anything
  return null;
}
