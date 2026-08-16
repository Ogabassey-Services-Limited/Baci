import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSyncExternalStore } from 'react';
import type { QuizV2StoreActions } from '@/stores/quiz-recovery-envelope';
import { loadQuizRecoveryEnvelopes } from '@/stores/quiz-recovery-envelope';
import { useQuizPersistedRecovery } from './useQuizPersistedRecovery';

type RecoverEvent = QuizV2StoreActions['recoverEvent'];

jest.mock('@/lib/get-quiz-device-fingerprint', () => ({
  getQuizDeviceFingerprint: jest.fn(async () => 'a'.repeat(64)),
}));
jest.mock('@/services/quiz-attempt-recovery', () => ({
  recoverActiveQuizAttempt: jest.fn(),
}));
jest.mock('@/services/quiz-attempts', () => ({
  submitQuizAnswerV2: jest.fn(),
}));
jest.mock('@/stores/quiz-recovery-envelope', () => ({
  loadQuizRecoveryEnvelopes: jest.fn(),
}));

function createRecoveryStatusStore() {
  let status: 'ready' | 'starting' = 'ready';
  const listeners = new Set<() => void>();
  return {
    getStatus: () => status,
    setStatus: (next: 'ready' | 'starting') => {
      status = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('useQuizPersistedRecovery recovery lifecycle', () => {
  afterEach(() => jest.clearAllMocks());

  it('discards stale envelopes until a later retained attempt is recovered', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([
      {
        attemptId: null,
        currentQuestionId: null,
        eventId: 'stale-event',
        generation: 5,
        pendingLockedOptionId: null,
        startRequestId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        version: 1,
      },
      {
        attemptId: 'attempt-2',
        currentQuestionId: null,
        eventId: 'retained-event',
        generation: 4,
        pendingLockedOptionId: null,
        startRequestId: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        version: 1,
      },
    ]);
    const recoverEvent = jest.fn<RecoverEvent>();
    recoverEvent.mockImplementation(async (_userId, eventId) =>
      eventId === 'stale-event' ? 'not_found' : 'recovered'
    );

    renderHook(() =>
      useQuizPersistedRecovery({
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(2));
    expect(recoverEvent).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'retained-event',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('allows one automatic retry after a transient recovery failure', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([
      {
        attemptId: 'attempt-1',
        currentQuestionId: null,
        eventId: 'event-1',
        generation: 1,
        pendingLockedOptionId: null,
        startRequestId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        version: 1,
      },
    ]);
    const recoverEvent = jest
      .fn<RecoverEvent>()
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('recovered');

    renderHook(() =>
      useQuizPersistedRecovery({
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(2));
  });

  it('allows a manual retry after the bounded automatic retry fails', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([
      {
        attemptId: 'attempt-1',
        currentQuestionId: null,
        eventId: 'event-1',
        generation: 1,
        pendingLockedOptionId: null,
        startRequestId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        version: 1,
      },
    ]);
    const recoverEvent = jest
      .fn<RecoverEvent>()
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('recovered');
    const { result } = renderHook(() =>
      useQuizPersistedRecovery({
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(recoverEvent).toHaveBeenCalledTimes(2);
    act(() => result.current.retryRecovery());
    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(3));
  });

  it('does not restart recovery repeatedly while its status leaves ready', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([
      {
        attemptId: 'attempt-1',
        currentQuestionId: null,
        eventId: 'event-1',
        generation: 1,
        pendingLockedOptionId: null,
        startRequestId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        version: 1,
      },
    ]);
    const statusStore = createRecoveryStatusStore();
    const recoverEvent = jest
      .fn<RecoverEvent>()
      .mockImplementation(async () => {
        act(() => statusStore.setStatus('starting'));
        await Promise.resolve();
        act(() => statusStore.setStatus('ready'));
        return 'retry';
      });
    renderHook(() => {
      const status = useSyncExternalStore(
        statusStore.subscribe,
        statusStore.getStatus
      );
      useQuizPersistedRecovery({
        enabled: status === 'ready',
        recoverEvent,
        userId: 'user-1',
      });
    });

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(recoverEvent).toHaveBeenCalledTimes(2);
  });

  it('does not recover the previous account after a user switch during storage load', async () => {
    let resolveFirstLoad!: (value: []) => void;
    jest
      .mocked(loadQuizRecoveryEnvelopes)
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirstLoad = resolve))
      )
      .mockResolvedValueOnce([]);
    const recoverEvent = jest.fn<RecoverEvent>().mockResolvedValue('recovered');
    const { rerender } = renderHook(
      ({ userId }: { userId: string }) =>
        useQuizPersistedRecovery({
          enabled: true,
          recoverEvent,
          userId,
        }),
      { initialProps: { userId: 'user-1' } }
    );

    rerender({ userId: 'user-2' });
    await act(async () => {
      resolveFirstLoad([]);
      await Promise.resolve();
    });

    expect(recoverEvent).not.toHaveBeenCalled();
  });

  it('dismisses a retained attempt until the player explicitly starts it again', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([
      {
        attemptId: 'attempt-1',
        currentQuestionId: null,
        eventId: 'event-1',
        generation: 1,
        pendingLockedOptionId: null,
        startRequestId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        version: 1,
      },
    ]);
    const recoverEvent = jest.fn<RecoverEvent>().mockResolvedValue('recovered');
    const { result } = renderHook(() =>
      useQuizPersistedRecovery({
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(1));
    act(() => result.current.dismissRecovery('event-1'));
    act(() => result.current.retryRecovery());
    await waitFor(() =>
      expect(loadQuizRecoveryEnvelopes).toHaveBeenCalledTimes(2)
    );
    expect(recoverEvent).toHaveBeenCalledTimes(1);
  });
});
