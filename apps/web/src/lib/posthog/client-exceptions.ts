'use client';

import posthog from 'posthog-js';
import { sanitizePostHogProperties } from '@/lib/posthog/client-config';
import { sanitizePostHogException } from '@/lib/posthog/exception-sanitizer';

export function captureClientException(
  error: unknown,
  properties?: Record<string, unknown>
): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    return false;
  }

  posthog.captureException(
    sanitizePostHogException(error),
    sanitizePostHogProperties({
      ...properties,
      app_surface: 'web',
      runtime: 'browser',
    })
  );

  return true;
}
