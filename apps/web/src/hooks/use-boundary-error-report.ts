'use client';

import { useEffect, useRef } from 'react';
import { useChunkLoadRecoveryBoundary } from '@/hooks/use-chunk-load-recovery-boundary';
import { captureClientException } from '@/lib/posthog/client-exceptions';

interface BoundaryErrorReportOptions {
  routeSurface: string;
  logLabel: string;
  properties?: Record<string, unknown>;
}

/**
 * Shared error-boundary pipeline: hands the caught error to chunk-load
 * recovery, then reports it to PostHog exactly once per error instance with
 * the recovery outcome attached. Errors are never suppressed — a recovered
 * chunk failure still produces a captured exception, tagged
 * `recovery_action: 'reload-scheduled'` so residual events in PostHog are
 * distinguishable from recovery misses. Returns true while a recovery reload
 * is pending so the boundary can render a refresh notice instead of the
 * failure card.
 */
export function useBoundaryErrorReport(
  error: Error & { digest?: string },
  options: BoundaryErrorReportOptions
): boolean {
  const recovering = useChunkLoadRecoveryBoundary(error);
  const reportedErrorRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (reportedErrorRef.current === error) {
      return;
    }
    reportedErrorRef.current = error;

    captureClientException(error, {
      digest: error.digest,
      recovery_action: recovering ? 'reload-scheduled' : 'none',
      route_surface: options.routeSurface,
      ...options.properties,
    });
    console.error(`${options.logLabel}:`, error);
  }, [error, recovering, options]);

  return recovering;
}
