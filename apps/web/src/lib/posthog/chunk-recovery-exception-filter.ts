import type { CaptureResult } from 'posthog-js';
import { isChunkRecoveryReloadPending } from '@/lib/chunk-load-recovery';
import { detectChunkFailureFromValue } from '@/lib/chunk-load-recovery/chunk-failure-detection';

interface ExceptionListEntry {
  type?: unknown;
  value?: unknown;
}

function getExceptionEntries(capture: CaptureResult): ExceptionListEntry[] {
  const list: unknown = capture.properties?.$exception_list;

  if (Array.isArray(list)) {
    return list.filter(
      (entry): entry is ExceptionListEntry =>
        typeof entry === 'object' && entry !== null
    );
  }

  return [];
}

function isChunkLoadException(capture: CaptureResult): boolean {
  return getExceptionEntries(capture).some((entry) =>
    detectChunkFailureFromValue({
      name: typeof entry.type === 'string' ? entry.type : undefined,
      message: typeof entry.value === 'string' ? entry.value : undefined,
    })
  );
}

/**
 * PostHog `before_send` filter: drops chunk-load `$exception` captures ONLY
 * while a chunk-recovery reload is scheduled and still navigating. That
 * reload is independently reported via the `chunk_load_recovery` telemetry
 * event, so nothing becomes invisible — the exception is replaced by a
 * structured signal instead of duplicating it. Every other capture (other
 * events, non-chunk exceptions, chunk exceptions with no reload pending —
 * i.e. recovery declined or exhausted) passes through untouched, so real
 * failures always stay visible in error tracking.
 */
export function dropRecoveredChunkExceptionCapture(
  capture: CaptureResult | null
): CaptureResult | null {
  if (capture?.event !== '$exception') {
    return capture;
  }

  if (isChunkRecoveryReloadPending() && isChunkLoadException(capture)) {
    return null;
  }

  return capture;
}
