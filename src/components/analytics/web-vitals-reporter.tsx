'use client';

import { useEffect } from 'react';
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

/**
 * Web Vitals Reporter Component
 *
 * Reports Core Web Vitals to Google Analytics 4 and console (in development).
 * These metrics are crucial for SEO and Google Search ranking.
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
  /**
   * Callback for custom metric handling
   */
  onMetric?: (metric: Metric) => void;
}

// Thresholds for metric quality (good/needs improvement/poor)
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

function getMetricRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'needs-improvement';

  if (value <= threshold.good) return 'good';
  if (value >= threshold.poor) return 'poor';
  return 'needs-improvement';
}

function sendToGoogleAnalytics(metric: Metric) {
  // Check if gtag is available
  if (typeof window === 'undefined' || !(window as unknown as { gtag?: unknown }).gtag) {
    return;
  }

  const gtag = (window as unknown as { gtag: (...args: unknown[]) => void }).gtag;

  // Send to GA4 using the recommended event structure
  gtag('event', metric.name, {
    // Value must be an integer for event_value
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    // Use the metric ID as the event label
    event_label: metric.id,
    // Use metric rating for segmentation
    metric_rating: metric.rating,
    // Navigation type (reload, navigate, back_forward, etc.)
    navigation_type: metric.navigationType,
    // Don't affect bounce rate
    non_interaction: true,
  });
}

function sendToEndpoint(metric: Metric, endpoint: string) {
  // Use sendBeacon for reliable delivery even on page unload
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body);
  } else {
    // Fallback to fetch
    fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently fail - metrics are non-critical
    });
  }
}

function logToConsole(metric: Metric) {
  const rating = getMetricRating(metric.name, metric.value);
  const color =
    rating === 'good' ? 'color: green' : rating === 'poor' ? 'color: red' : 'color: orange';

  console.log(
    `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(metric.name === 'CLS' ? 3 : 0)}ms (${rating})`,
    color
  );
}

export function WebVitalsReporter({
  debug = process.env.NODE_ENV === 'development',
  endpoint,
  onMetric,
}: WebVitalsReporterProps = {}) {
  useEffect(() => {
    const handleMetric = (metric: Metric) => {
      // Debug logging
      if (debug) {
        logToConsole(metric);
      }

      // Send to GA4
      sendToGoogleAnalytics(metric);

      // Send to custom endpoint if provided
      if (endpoint) {
        sendToEndpoint(metric, endpoint);
      }

      // Call custom handler if provided
      if (onMetric) {
        onMetric(metric);
      }
    };

    // Register all web vitals observers
    // These return cleanup functions but we keep them active for the page lifetime
    onCLS(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);

    // No cleanup needed - metrics should be reported even after component unmount
  }, [debug, endpoint, onMetric]);

  // This component doesn't render anything
  return null;
}

export default WebVitalsReporter;
