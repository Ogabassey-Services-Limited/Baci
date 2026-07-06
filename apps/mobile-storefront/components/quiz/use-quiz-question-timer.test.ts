import { act, renderHook } from '@testing-library/react-native';
import {
  QUIZ_AUTO_SUBMIT_LEAD_MS,
  useQuizQuestionTimer,
} from './use-quiz-question-timer';

describe('useQuizQuestionTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at the full time limit', () => {
    const { result } = renderHook(() =>
      useQuizQuestionTimer({
        questionId: 'q1',
        timeLimitSeconds: 30,
        isActive: true,
        onExpire: jest.fn(),
      })
    );

    expect(result.current.remainingSeconds).toBe(30);
    expect(result.current.isExpiring).toBe(false);
  });

  it('counts down as time elapses', () => {
    const { result } = renderHook(() =>
      useQuizQuestionTimer({
        questionId: 'q1',
        timeLimitSeconds: 30,
        isActive: true,
        onExpire: jest.fn(),
      })
    );

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current.remainingSeconds).toBe(20);
  });

  it('auto-submits exactly once when the window is about to close', () => {
    const onExpire = jest.fn();
    renderHook(() =>
      useQuizQuestionTimer({
        questionId: 'q1',
        timeLimitSeconds: 5,
        isActive: true,
        onExpire,
      })
    );

    // Advance past (limit - lead) so the auto-submit threshold is crossed.
    act(() => {
      jest.advanceTimersByTime(5_000 - QUIZ_AUTO_SUBMIT_LEAD_MS + 500);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Further ticks must not fire it again for the same question.
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does not run while inactive', () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() =>
      useQuizQuestionTimer({
        questionId: 'q1',
        timeLimitSeconds: 5,
        isActive: false,
        onExpire,
      })
    );

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onExpire).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(5);
  });

  it('resets the countdown when a new question arrives', () => {
    const onExpire = jest.fn();
    const { result, rerender } = renderHook(
      ({ questionId }: { questionId: string }) =>
        useQuizQuestionTimer({
          questionId,
          timeLimitSeconds: 30,
          isActive: true,
          onExpire,
        }),
      { initialProps: { questionId: 'q1' } }
    );

    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(result.current.remainingSeconds).toBe(10);

    rerender({ questionId: 'q2' });
    expect(result.current.remainingSeconds).toBe(30);
  });
});
