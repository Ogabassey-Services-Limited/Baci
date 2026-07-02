import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getChunkLoadRecoveryOutcome,
  useChunkLoadRecoveryBoundary,
} from './use-chunk-load-recovery-boundary';

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
    mockAttemptChunkLoadRecoveryFromBoundary.mockReturnValue(true);
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
    expect(getChunkLoadRecoveryOutcome(error)).toBe(true);

    rerender({ currentError: error });

    expect(result.current).toBe(true);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledTimes(1);
  });

  it('attempts recovery exactly once for the same error instance even when StrictMode double-invokes the effect', () => {
    mockIsChunkLoadRecoveryPending.mockReturnValue(true);
    mockAttemptChunkLoadRecoveryFromBoundary.mockReturnValue(true);
    const error = new Error('Loading chunk 3 failed');

    const { result } = renderHook(
      ({ currentError }) => useChunkLoadRecoveryBoundary(currentError),
      {
        initialProps: { currentError: error },
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
      }
    );

    expect(result.current).toBe(true);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledTimes(1);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledWith(
      error
    );
  });

  it('falls back to the error UI when the recovery attempt is declined', () => {
    mockIsChunkLoadRecoveryPending.mockReturnValue(true);
    mockAttemptChunkLoadRecoveryFromBoundary.mockReturnValue(false);
    const error = new Error('Loading chunk 4 failed');

    const { result } = renderHook(
      ({ currentError }) => useChunkLoadRecoveryBoundary(currentError),
      { initialProps: { currentError: error } }
    );

    expect(result.current).toBe(false);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).toHaveBeenCalledTimes(1);
    expect(getChunkLoadRecoveryOutcome(error)).toBe(false);
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
    expect(getChunkLoadRecoveryOutcome(error)).toBe(false);

    rerender({ currentError: error });

    expect(result.current).toBe(false);
    expect(mockAttemptChunkLoadRecoveryFromBoundary).not.toHaveBeenCalled();
  });
});
