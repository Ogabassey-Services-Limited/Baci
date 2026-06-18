'use client';

import posthog from 'posthog-js';
import { sanitizePostHogProperties } from '@/lib/posthog/client-config';

export function captureClientException(
  error: unknown,
  properties?: Record<string, unknown>
): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    return false;
  }

  posthog.captureException(
    error,
    sanitizePostHogProperties({
      ...properties,
      app_surface: 'web',
      runtime: 'browser',
    })
  );

  return true;
}
