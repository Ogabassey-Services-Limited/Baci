import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QUIZ_AUTO_SUBMIT_LEAD_MS,
  useQuizCountdown,
} from './use-quiz-countdown';

describe('useQuizCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down whole seconds from the time limit', () => {
    const { result } = renderHook(() =>
      useQuizCountdown({
        active: true,
        onExpire: vi.fn(),
        questionId: 'q1',
        timeLimitSeconds: 30,
      })
    );

    expect(result.current).toBe(30);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBe(25);
  });

  it('fires onExpire exactly once at the auto-submit lead before the deadline', () => {
    const onExpire = vi.fn();
    renderHook(() =>
      useQuizCountdown({
        active: true,
        onExpire,
        questionId: 'q1',
        timeLimitSeconds: 10,
      })
    );

    // Just before the lead window: not yet fired.
    act(() => {
      vi.advanceTimersByTime(10_000 - QUIZ_AUTO_SUBMIT_LEAD_MS - 100);
    });
    expect(onExpire).not.toHaveBeenCalled();

    // Cross into the lead window.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Keep ticking past the deadline — still only fired once.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does not run while inactive', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useQuizCountdown({
        active: false,
        onExpire,
        questionId: 'q1',
        timeLimitSeconds: 10,
      })
    );

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(onExpire).not.toHaveBeenCalled();
    expect(result.current).toBe(10);
  });

  it('does NOT reset the deadline when the timer pauses/resumes on the same question', () => {
    // A failed same-question retry flips `active` false→true. The server's
    // issued_at is unchanged, so the countdown must resume from the original
    // deadline, not restart a fresh full window.
    const onExpire = vi.fn();
    const { result, rerender } = renderHook(
      ({ active }) =>
        useQuizCountdown({
          active,
          onExpire,
          questionId: 'q1',
          timeLimitSeconds: 30,
        }),
      { initialProps: { active: true } }
    );

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current).toBe(10);

    // Pause (submitting) then resume (submit failed, same question).
    rerender({ active: false });
    rerender({ active: true });

    // Still ~10s left — NOT reset to 30.
    expect(result.current).toBe(10);

    // The original deadline still governs expiry.
    act(() => {
      vi.advanceTimersByTime(10_000 - QUIZ_AUTO_SUBMIT_LEAD_MS + 100);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('restarts the countdown when the question id changes', () => {
    const { result, rerender } = renderHook(
      ({ questionId }) =>
        useQuizCountdown({
          active: true,
          onExpire: vi.fn(),
          questionId,
          timeLimitSeconds: 30,
        }),
      { initialProps: { questionId: 'q1' } }
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(20);

    rerender({ questionId: 'q2' });
    expect(result.current).toBe(30);
  });
});
