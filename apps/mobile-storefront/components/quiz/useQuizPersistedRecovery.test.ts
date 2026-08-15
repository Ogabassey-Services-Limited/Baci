import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getQuizDeviceFingerprint } from '@/lib/get-quiz-device-fingerprint';
import { recoverActiveQuizAttempt } from '@/services/quiz-attempt-recovery';
import { submitQuizAnswerV2 } from '@/services/quiz-attempts';
import {
  loadQuizRecoveryEnvelopes,
  type QuizV2StoreActions,
} from '@/stores/quiz-recovery-envelope';
import { useQuizPersistedRecovery } from './useQuizPersistedRecovery';

type RecoverEvent = QuizV2StoreActions['recoverEvent'];

jest.mock('@/lib/get-quiz-device-fingerprint', () => ({
  getQuizDeviceFingerprint: jest.fn(),
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

describe('useQuizPersistedRecovery', () => {
  afterEach(() => jest.clearAllMocks());

  it('rehydrates a retained terminal attempt after the app restarts', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([
      {
        attemptId: 'attempt-1',
        currentQuestionId: null,
        eventId: 'event-1',
        generation: 4,
        pendingLockedOptionId: null,
        startRequestId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        version: 1,
      },
    ]);
    jest.mocked(getQuizDeviceFingerprint).mockResolvedValue('a'.repeat(64));
    jest.mocked(recoverActiveQuizAttempt).mockResolvedValue({
      availability: 'pending_results',
      eventEndsAt: '2026-08-04T12:05:00.000Z',
      serverNow: '2026-08-04T12:05:00.000Z',
    });
    const recoverEvent = jest.fn<RecoverEvent>();
    recoverEvent.mockImplementation(async (_userId, _eventId, recoverer) => {
      await recoverer();
      return 'recovered';
    });

    renderHook(() =>
      useQuizPersistedRecovery({
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(1));
    expect(recoverActiveQuizAttempt).toHaveBeenCalledWith({
      deviceFingerprint: 'a'.repeat(64),
      eventId: 'event-1',
      expectedUserId: 'user-1',
    });
    expect(submitQuizAnswerV2).not.toHaveBeenCalled();
  });

  it('does not re-run the same persisted recovery while the screen stays ready', async () => {
    jest.mocked(loadQuizRecoveryEnvelopes).mockResolvedValue([]);
    const recoverEvent = jest.fn<RecoverEvent>().mockResolvedValue('recovered');
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuizPersistedRecovery({
          enabled,
          recoverEvent,
          userId: 'user-1',
        }),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      await Promise.resolve();
      rerender({ enabled: true });
    });
    expect(loadQuizRecoveryEnvelopes).toHaveBeenCalledTimes(1);
  });

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
    let rerender!: (props: { enabled: boolean }) => void;
    const recoverEvent = jest
      .fn<RecoverEvent>()
      .mockImplementation(async () => {
        await act(async () => {
          rerender({ enabled: false });
          await Promise.resolve();
          rerender({ enabled: true });
        });
        return 'retry';
      });
    ({ rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuizPersistedRecovery({
          enabled,
          recoverEvent,
          userId: 'user-1',
        }),
      { initialProps: { enabled: true } }
    ));

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
});
