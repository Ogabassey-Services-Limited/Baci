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
        hasSelectedAnswer: true,
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

  it('anchors the countdown to the server-issued deadline when present', () => {
    vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'));

    const { result } = renderHook(() =>
      useQuizCountdown({
        active: true,
        deadlineAt: '2026-07-08T12:00:08.000Z',
        hasSelectedAnswer: true,
        onExpire: vi.fn(),
        questionId: 'q1',
        timeLimitSeconds: 30,
      })
    );

    expect(result.current).toBe(8);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(5);
  });

  it('fires onExpire exactly once at the auto-submit lead before the deadline when an answer is selected', () => {
    const onExpire = vi.fn();
    renderHook(() =>
      useQuizCountdown({
        active: true,
        hasSelectedAnswer: true,
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
        hasSelectedAnswer: true,
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
          hasSelectedAnswer: true,
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

  it('fires the latest onExpire captured on the most recent render (last-second answer)', () => {
    // A player selects an option in the final ~1.5s: the parent re-renders with
    // a new onExpire closing over that selection. Expiry must call the NEWEST
    // callback (submit the answer), never the stale mount-time one (which would
    // submit the forfeit sentinel). The ref is refreshed in a layout effect so
    // the pending interval tick sees the fresh closure.
    const firstOnExpire = vi.fn();
    const latestOnExpire = vi.fn();
    const { rerender } = renderHook(
      ({ onExpire }) =>
        useQuizCountdown({
          active: true,
          hasSelectedAnswer: true,
          onExpire,
          questionId: 'q1',
          timeLimitSeconds: 10,
        }),
      { initialProps: { onExpire: firstOnExpire } }
    );

    // Tick up to just before the auto-submit lead window.
    act(() => {
      vi.advanceTimersByTime(10_000 - QUIZ_AUTO_SUBMIT_LEAD_MS - 100);
    });
    expect(firstOnExpire).not.toHaveBeenCalled();

    // Last-second selection swaps in a new callback for the SAME question.
    rerender({ onExpire: latestOnExpire });

    // Cross into the lead window: only the latest callback fires.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(latestOnExpire).toHaveBeenCalledTimes(1);
    expect(firstOnExpire).not.toHaveBeenCalled();
  });

  it('fires the auto-submit at most once per question, even across submit retries', () => {
    // The auto-submit fires, its submit fails past the deadline, and the page
    // toggles active false->true for the SAME question. The timer must NOT
    // re-fire onExpire (an auto-resubmit loop); the fired flag is keyed to the
    // question, not to the active toggle.
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ active }) =>
        useQuizCountdown({
          active,
          hasSelectedAnswer: true,
          onExpire,
          questionId: 'q1',
          timeLimitSeconds: 10,
        }),
      { initialProps: { active: true } }
    );

    // Reach the lead window: fires once.
    act(() => {
      vi.advanceTimersByTime(10_000 - QUIZ_AUTO_SUBMIT_LEAD_MS + 100);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Submit begins (pause) then fails (resume) for the same question, now past
    // the deadline.
    rerender({ active: false });
    rerender({ active: true });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Still fired exactly once — no re-fire on the retry.
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('forfeits at the real deadline, not the lead, when no answer is selected', () => {
    // Regression: the auto-submit lead (1.5s) exists to beat network latency
    // for a SELECTED answer. With nothing selected there is no answer to race,
    // so forfeiting early only robs a still-deciding player of time. The
    // forfeit must wait for the actual deadline (the server tolerates a
    // deadline-time forfeit and scores it incorrect + advances).
    const onExpire = vi.fn();
    renderHook(() =>
      useQuizCountdown({
        active: true,
        hasSelectedAnswer: false,
        onExpire,
        questionId: 'q1',
        timeLimitSeconds: 10,
      })
    );

    // Cross the SELECTED lead window: an unanswered question must NOT forfeit
    // early — the player can still pick an option.
    act(() => {
      vi.advanceTimersByTime(10_000 - QUIZ_AUTO_SUBMIT_LEAD_MS + 100);
    });
    expect(onExpire).not.toHaveBeenCalled();

    // At the real deadline the forfeit fires exactly once.
    act(() => {
      vi.advanceTimersByTime(QUIZ_AUTO_SUBMIT_LEAD_MS);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('applies the auto-submit lead as soon as an answer is selected late', () => {
    // A player who selects with time still on the clock should get the full
    // latency lead: the pending selection now submits at the lead window, not
    // held back to the deadline.
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ hasSelectedAnswer }) =>
        useQuizCountdown({
          active: true,
          hasSelectedAnswer,
          onExpire,
          questionId: 'q1',
          timeLimitSeconds: 10,
        }),
      { initialProps: { hasSelectedAnswer: false } }
    );

    // No selection yet: crossing the lead window does not forfeit.
    act(() => {
      vi.advanceTimersByTime(10_000 - QUIZ_AUTO_SUBMIT_LEAD_MS - 100);
    });
    expect(onExpire).not.toHaveBeenCalled();

    // Player selects an option; the very next tick is already inside the lead
    // window, so the selected answer submits.
    rerender({ hasSelectedAnswer: true });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('restarts the countdown when the question id changes', () => {
    const { result, rerender } = renderHook(
      ({ questionId }) =>
        useQuizCountdown({
          active: true,
          hasSelectedAnswer: true,
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
