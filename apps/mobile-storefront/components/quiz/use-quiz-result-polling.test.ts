import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchQuizResult } from '@/services/quiz-results';
import {
  QUIZ_RESULT_POLL_MAX_INTERVAL_MS,
  useQuizResultPolling,
} from './use-quiz-result-polling';

const mockQuizResultsWakeup = { current: null as (() => void) | null };

jest.mock('./use-quiz-result-realtime-wakeup', () => {
  return {
    useQuizResultRealtimeWakeup: ({
      enabled,
      onWakeup,
    }: {
      enabled: boolean;
      onWakeup: () => void;
    }) => {
      mockQuizResultsWakeup.current = enabled ? onWakeup : null;
    },
  };
});

jest.mock('@/services/quiz-results', () => ({
  fetchQuizResult: jest.fn(),
}));

describe('useQuizResultPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockQuizResultsWakeup.current = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses the fallback when no publication wakeup arrives and then stops', async () => {
    const onResult = jest.fn();
    jest
      .mocked(fetchQuizResult)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'pending',
        availableAt: null,
      })
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'final',
        availableAt: '2026-08-09T20:26:20.000Z',
        rank: 1,
        score: 4,
        totalQuestions: 5,
      });

    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        onResult,
      })
    );
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ availability: 'pending' })
      )
    );

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(fetchQuizResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ availability: 'final', rank: 1 })
    );
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(2);
  });

  it('waits until the server availability time before retrying pending results', async () => {
    const availableAt = new Date(Date.now() + 20_000).toISOString();
    jest
      .mocked(fetchQuizResult)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'pending',
        availableAt,
      })
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'final',
        availableAt,
        rank: 1,
        score: 4,
        totalQuestions: 5,
      });

    const onResult = jest.fn();
    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        onResult,
      })
    );
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ availability: 'pending' })
      )
    );

    const remainingUntilAvailability = Date.parse(availableAt) - Date.now();
    await act(async () => {
      jest.advanceTimersByTime(remainingUntilAvailability - 1);
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(2);
  });

  it('caps the fallback when the device clock is behind server time', async () => {
    jest
      .mocked(fetchQuizResult)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'pending',
        availableAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
      })
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'final',
        availableAt: new Date().toISOString(),
        rank: 1,
        score: 4,
        totalQuestions: 5,
      });

    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        onResult: jest.fn(),
      })
    );
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(QUIZ_RESULT_POLL_MAX_INTERVAL_MS);
    });

    expect(fetchQuizResult).toHaveBeenCalledTimes(2);
  });

  it('waits for the private publication wakeup instead of polling every second', async () => {
    const availableAt = new Date(Date.now()).toISOString();
    jest
      .mocked(fetchQuizResult)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'pending',
        availableAt,
      })
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'final',
        availableAt,
        rank: 1,
        score: 4,
        totalQuestions: 5,
      });

    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: 'event-1',
        expectedUserId: 'user-1',
        onResult: jest.fn(),
      })
    );
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockQuizResultsWakeup.current?.();
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(2);
  });

  it('backs off after consecutive result request failures', async () => {
    jest.mocked(fetchQuizResult).mockRejectedValue(new Error('offline'));

    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        onResult: jest.fn(),
      })
    );
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(4_999);
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(9_999);
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(3);
  });

  it('pauses pending-result polling while the app is backgrounded', async () => {
    const listeners: Array<(state: AppStateStatus) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      });
    jest.mocked(fetchQuizResult).mockResolvedValue({
      attemptId: 'attempt-1',
      availability: 'pending',
      availableAt: null,
    });
    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        onResult: jest.fn(),
      })
    );
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(1));
    act(() => listeners[0]?.('background'));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(1);
    act(() => listeners[0]?.('active'));
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(2));
  });

  it('resumes polling when the app returns while a result request is in flight', async () => {
    const listeners: Array<(state: AppStateStatus) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      });
    let resolveFirst!: (result: {
      attemptId: string;
      availability: 'pending';
      availableAt: null;
    }) => void;
    const firstRequest = new Promise<{
      attemptId: string;
      availability: 'pending';
      availableAt: null;
    }>((resolve) => {
      resolveFirst = resolve;
    });
    jest
      .mocked(fetchQuizResult)
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        availability: 'final',
        availableAt: '2026-08-09T20:26:20.000Z',
        rank: 1,
        score: 4,
        totalQuestions: 5,
      });

    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        onResult: jest.fn(),
      })
    );
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(1));
    act(() => {
      listeners[0]?.('background');
      listeners[0]?.('active');
    });
    expect(fetchQuizResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({
        attemptId: 'attempt-1',
        availability: 'pending',
        availableAt: null,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(2));
  });

  it('does not apply a result after the authenticated account changes', async () => {
    let resolveFirst!: (result: {
      attemptId: string;
      availability: 'final';
      availableAt: string;
      rank: number;
      score: number;
      totalQuestions: number;
    }) => void;
    const firstRequest = new Promise<{
      attemptId: string;
      availability: 'final';
      availableAt: string;
      rank: number;
      score: number;
      totalQuestions: number;
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const onResult = jest.fn();
    let currentUserId = 'user-1';
    jest.mocked(fetchQuizResult).mockReturnValueOnce(firstRequest);

    renderHook(() =>
      useQuizResultPolling({
        attemptId: 'attempt-1',
        enabled: true,
        eventId: null,
        expectedUserId: 'user-1',
        getCurrentUserId: () => currentUserId,
        onResult,
      })
    );
    await waitFor(() => expect(fetchQuizResult).toHaveBeenCalledTimes(1));

    currentUserId = 'user-2';
    await act(async () => {
      resolveFirst({
        attemptId: 'attempt-1',
        availability: 'final',
        availableAt: '2026-08-09T20:26:20.000Z',
        rank: 1,
        score: 4,
        totalQuestions: 5,
      });
      await Promise.resolve();
    });

    expect(onResult).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(30_000));
    expect(fetchQuizResult).toHaveBeenCalledTimes(1);
  });
});
