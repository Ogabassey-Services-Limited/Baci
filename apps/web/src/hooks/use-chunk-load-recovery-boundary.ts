'use client';

import { useEffect, useState } from 'react';
import {
  attemptChunkLoadRecoveryFromBoundary,
  isChunkLoadRecoveryPending,
} from '@/lib/chunk-load-recovery';

// Keyed by error instance so strict-mode double effects and boundary
// re-renders neither re-attempt recovery nor double-count telemetry.
const boundaryRecoveryOutcomes = new WeakMap<object, boolean>();

function readRecordedOutcome(error: unknown): boolean | undefined {
  return typeof error === 'object' && error !== null
    ? boundaryRecoveryOutcomes.get(error)
    : undefined;
}

/**
 * Actual recovery outcome for a boundary-caught error: true when a reload
 * was scheduled, false when recovery was attempted and declined, undefined
 * before the attempt has committed. Lets reporting record what really
 * happened instead of the render-time peek.
 */
export function getChunkLoadRecoveryOutcome(
  error: unknown
): boolean | undefined {
  return readRecordedOutcome(error);
}

/**
 * Hands a boundary-caught error to chunk-load recovery. Returns true while a
 * recovery reload is pending so the boundary can render a brief refresh
 * notice instead of the failure card. The render-time check is a pure peek;
 * the reload itself (and its once-per-deployment/path guard) commits in an
 * effect. The committed outcome is recorded per error instance and replaces
 * the peek on the next render, so a declined attempt (e.g. the window
 * handler consumed the guard first, or the session cap was hit) falls back
 * to the normal error UI instead of showing a refresh notice forever.
 */
export function useChunkLoadRecoveryBoundary(error: unknown): boolean {
  const [, bumpOutcomeRender] = useState(0);
  const recorded = readRecordedOutcome(error);
  const recovering = recorded ?? isChunkLoadRecoveryPending(error);

  useEffect(() => {
    if (typeof error !== 'object' || error === null) {
      // Non-object throws cannot be tracked per instance; still attempt once
      // per effect run — the guard inside recovery keeps it loop-safe.
      if (isChunkLoadRecoveryPending(error)) {
        attemptChunkLoadRecoveryFromBoundary(error);
      }
      return;
    }

    if (boundaryRecoveryOutcomes.has(error)) {
      return;
    }

    const scheduled =
      isChunkLoadRecoveryPending(error) &&
      attemptChunkLoadRecoveryFromBoundary(error) === true;
    boundaryRecoveryOutcomes.set(error, scheduled);
    bumpOutcomeRender((count) => count + 1);
  }, [error]);

  return recovering;
}
