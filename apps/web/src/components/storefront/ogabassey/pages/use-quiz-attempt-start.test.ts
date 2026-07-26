import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizAttemptResponse, QuizEventResponse } from '@/schemas/quiz';
import { useQuizAttemptStart } from './use-quiz-attempt-start';

const mockStartQuizAttempt = vi.fn();
vi.mock('./quiz-page-data', () => ({
  startQuizAttempt: (...args: unknown[]) => mockStartQuizAttempt(...args),
}));

const event = { id: 'event-1', title: 'Daily Quiz' } as QuizEventResponse;
const attempt = { attemptId: 'attempt-1', eventId: 'event-1' } as QuizAttemptResponse;

function setup(currentUserId: string | null = 'user-a') {
  const setters = {
    setError: vi.fn(),
    setStatus: vi.fn(),
    setAttempt: vi.fn(),
    setPlayedEventId: vi.fn(),
    setResult: vi.fn(),
    setSelectedAnswer: vi.fn(),
  };
  const view = renderHook(
    ({ uid }: { uid: string | null }) =>
      useQuizAttemptStart({ currentUserId: uid, ...setters }),
    { initialProps: { uid: currentUserId } }
  );
  return { view, ...setters };
}

describe('useQuizAttemptStart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('commits the attempt and returns null on success', async () => {
    mockStartQuizAttempt.mockResolvedValue(attempt);
    const { view, setAttempt, setStatus } = setup();

    let outcome: string | null = 'unset';
    await act(async () => {
      outcome = await view.result.current(event);
    });

    expect(outcome).toBeNull();
    // The start is pinned to the initiating shopper (server-side 409 gate).
    expect(mockStartQuizAttempt).toHaveBeenCalledWith(event.id, 'user-a');
    expect(setAttempt).toHaveBeenCalledWith(attempt);
    expect(setStatus).toHaveBeenLastCalledWith('question');
  });

  it('swallows a synchronous double-tap so only one attempt starts', async () => {
    let resolveStart: (v: QuizAttemptResponse) => void = () => {};
    mockStartQuizAttempt.mockReturnValue(
      new Promise<QuizAttemptResponse>((resolve) => {
        resolveStart = resolve;
      })
    );
    const { view } = setup();

    await act(async () => {
      void view.result.current(event);
      void view.result.current(event);
      resolveStart(attempt);
    });

    expect(mockStartQuizAttempt).toHaveBeenCalledTimes(1);
  });

  it('discards the commit when the account switches mid-start', async () => {
    let resolveStart: (v: QuizAttemptResponse) => void = () => {};
    mockStartQuizAttempt.mockReturnValue(
      new Promise<QuizAttemptResponse>((resolve) => {
        resolveStart = resolve;
      })
    );
    const { view, setAttempt, setStatus } = setup('user-a');

    let done: Promise<string | null> = Promise.resolve(null);
    act(() => {
      done = view.result.current(event);
    });
    // Account switches to shopper B while the start is in flight.
    view.rerender({ uid: 'user-b' });
    await act(async () => {
      resolveStart(attempt);
      await done;
    });

    // The previous shopper's attempt must NOT be committed to page state.
    expect(setAttempt).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith('ready');
  });

  it('returns the error message and resets to ready on failure', async () => {
    mockStartQuizAttempt.mockRejectedValue(new Error('Start unavailable'));
    const { view, setAttempt, setStatus } = setup();

    let outcome: string | null = null;
    await act(async () => {
      outcome = await view.result.current(event);
    });

    expect(outcome).toBe('Start unavailable');
    expect(setAttempt).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith('ready');
  });

  it('discards the error when the account switches while a failing start is in flight', async () => {
    // Regression (is6TzRI4): if the account switches and shopper A's start then
    // rejects, the failure (e.g. an age-gate rejection) must NOT be published or
    // returned under shopper B's session — otherwise handleStart would reopen the
    // DOB modal for B.
    let rejectStart: (error: Error) => void = () => {};
    mockStartQuizAttempt.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectStart = reject;
      })
    );
    const { view, setError, setStatus } = setup('user-a');

    let done: Promise<string | null> = Promise.resolve(null);
    act(() => {
      done = view.result.current(event);
    });
    view.rerender({ uid: 'user-b' });

    let outcome: string | null = 'unset';
    await act(async () => {
      rejectStart(new Error('Quiz participation requires an adult profile (18+)'));
      outcome = await done;
    });

    expect(outcome).toBeNull();
    // Only the initial setError(null) may have run — never the rejection message.
    expect(setError.mock.calls.map((call) => call[0])).not.toContain(
      'Quiz participation requires an adult profile (18+)'
    );
    expect(setStatus).toHaveBeenLastCalledWith('ready');
  });
});
