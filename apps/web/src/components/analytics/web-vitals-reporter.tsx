'use client';

import { useEffect } from 'react';

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
 * Pull the most useful per-metric attribution fields (the element selector +
 * the timing sub-parts) so real-user reports show WHICH node is the LCP / what
 * shifts (CLS) / what blocks interaction (INP) — not just the score.
 */
export function extractAttribution(
  metric: WebVitalMetric
): Record<string, string | number> {
  const a = metric.attribution;
  if (!a || typeof a !== 'object') return {};
  const out: Record<string, string | number> = {};
  const pick = (key: string, label?: string) => {
    const v = (a as Record<string, unknown>)[key];
    if (typeof v === 'string' || typeof v === 'number') out[label ?? key] = v;
  };
  if (metric.name === 'LCP') {
    pick('element', 'debugTarget');
    pick('url', 'lcpUrl');
    pick('timeToFirstByte', 'ttfb');
    pick('resourceLoadDelay', 'loadDelay');
    pick('resourceLoadDuration', 'loadDuration');
    pick('elementRenderDelay', 'renderDelay');
  } else if (metric.name === 'CLS') {
    pick('largestShiftTarget', 'debugTarget');
    pick('largestShiftValue', 'shiftValue');
    pick('loadState');
  } else if (metric.name === 'INP') {
    pick('interactionTarget', 'debugTarget');
    pick('interactionType');
    pick('inputDelay');
    pick('processingDuration');
    pick('presentationDelay');
  }
  return out;
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
    gtag('event', metric.name, {
      value: Math.round(
        metric.name === 'CLS' ? metric.value * 1000 : metric.value
      ),
      event_label: metric.id,
      metric_rating: metric.rating,
      navigation_type: metric.navigationType,
      non_interaction: true,
      ...extractAttribution(metric),
    });
  }

  // Send to custom endpoint if provided
  if (endpoint) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
      attribution: extractAttribution(metric),
      timestamp: Date.now(),
    });

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
