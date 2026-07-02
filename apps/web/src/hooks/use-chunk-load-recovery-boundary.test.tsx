import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChunkLoadRecoveryBoundary } from './use-chunk-load-recovery-boundary';

const mockIsChunkLoadRecoveryPending = vi.fn();
const mockAttemptChunkLoadRecoveryFromBoundary = vi.fn();

vi.mock('@/lib/chunk-load-recovery', () => ({
  attemptChunkLoadRecoveryFromBoundary: (...args: unknown[]) =>
    mockAttemptChunkLoadRecoveryFromBoundary(...args),
  isChunkLoadRecoveryPending: (...args: unknown[]) =>
    mockIsChunkLoadRecoveryPending(...args),
}));

describe('useChunkLoadRecoveryBoundary', () => {
  beforeEach(() => {
    mockIsChunkLoadRecoveryPending.mockReset();
    mockAttemptChunkLoadRecoveryFromBoundary.mockReset();
  });

  it('returns true and commits the recovery attempt exactly once when the error is a pending chunk failure, even across re-renders', () => {
    mockIsChunkLoadRecoveryPending.mockReturnValue(true);
    const error = new Error('Loading chunk 2 failed');

    const { result, rerender } = renderHook(
      ({ currentError }) => useChunkLoadRecoveryBoundary(currentError),
      { initialProps: { currentError: error } }
    );

    expect(result.current).toBe(true);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledTimes(1);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledWith(
      error
    );

    rerender({ currentError: error });

    expect(result.current).toBe(true);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledTimes(1);
  });

  it('returns false and never attempts recovery when the error is not a pending chunk failure', () => {
    mockIsChunkLoadRecoveryPending.mockReturnValue(false);
    const error = new Error('Unrelated failure');

    const { result, rerender } = renderHook(
      ({ currentError }) => useChunkLoadRecoveryBoundary(currentError),
      { initialProps: { currentError: error } }
    );

    expect(result.current).toBe(false);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).not.toHaveBeenCalled();

    rerender({ currentError: error });

    expect(result.current).toBe(false);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).not.toHaveBeenCalled();
  });
});
