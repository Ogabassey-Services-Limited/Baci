'use client';

import { useEffect } from 'react';
import {
  attemptChunkLoadRecoveryFromBoundary,
  isChunkLoadRecoveryPending,
} from '@/lib/chunk-load-recovery';

const attemptedBoundaryErrors = new WeakSet<object>();

function hasAlreadyAttempted(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    attemptedBoundaryErrors.has(error)
  );
}

function markAttempted(error: unknown): void {
  if (typeof error === 'object' && error !== null) {
    attemptedBoundaryErrors.add(error);
  }
}

/**
 * Hands a boundary-caught error to chunk-load recovery. Returns true while a
 * recovery reload is pending so the boundary can render a brief refresh
 * notice instead of the failure card. The render-time check is pure; the
 * reload itself (and its once-per-deployment/path guard) commits in an
 * effect, deduplicated per error instance so strict-mode double effects and
 * boundary re-renders cannot double-count recovery telemetry.
 */
export function useChunkLoadRecoveryBoundary(error: unknown): boolean {
  const recovering =
    hasAlreadyAttempted(error) || isChunkLoadRecoveryPending(error);

  useEffect(() => {
    if (hasAlreadyAttempted(error)) {
      return;
    }

    if (isChunkLoadRecoveryPending(error)) {
      markAttempted(error);
      attemptChunkLoadRecoveryFromBoundary(error);
    }
  }, [error]);

  return recovering;
}
