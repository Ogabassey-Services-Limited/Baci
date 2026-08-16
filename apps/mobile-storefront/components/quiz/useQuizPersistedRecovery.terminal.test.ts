import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { QuizV2StoreActions } from '@/stores/quiz-recovery-envelope';
import { loadQuizRecoveryEnvelopes } from '@/stores/quiz-recovery-envelope';
import { useQuizPersistedRecovery } from './useQuizPersistedRecovery';

type RecoverEvent = QuizV2StoreActions['recoverEvent'];

jest.mock('@/lib/get-quiz-device-fingerprint', () => ({
  getQuizDeviceFingerprint: jest
    .fn<() => Promise<string | null>>()
    .mockResolvedValue(null),
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

describe('useQuizPersistedRecovery terminal envelopes', () => {
  afterEach(() => jest.clearAllMocks());

  it('recovers every retained terminal attempt instead of stopping at the first', async () => {
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
      {
        attemptId: 'attempt-2',
        currentQuestionId: null,
        eventId: 'event-2',
        generation: 2,
        pendingLockedOptionId: null,
        startRequestId: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        version: 1,
      },
    ]);
    let canRecover = true;
    const recoverEvent = jest
      .fn<RecoverEvent>()
      .mockImplementation(async () => {
        canRecover = false;
        return 'recovered';
      });

    renderHook(() =>
      useQuizPersistedRecovery({
        canRecover: () => canRecover,
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(recoverEvent).toHaveBeenCalledTimes(2));
    expect(recoverEvent).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'event-1',
      expect.any(Function),
      expect.any(Function)
    );
    expect(recoverEvent).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'event-2',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('does not recover an envelope after a manual start takes ownership', async () => {
    let resolveLoad!: (value: []) => void;
    let canRecover = true;
    jest
      .mocked(loadQuizRecoveryEnvelopes)
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveLoad = resolve))
      );
    const recoverEvent = jest.fn<RecoverEvent>().mockResolvedValue('recovered');

    renderHook(() =>
      useQuizPersistedRecovery({
        canRecover: () => canRecover,
        enabled: true,
        recoverEvent,
        userId: 'user-1',
      })
    );

    canRecover = false;
    await act(async () => {
      resolveLoad([]);
      await Promise.resolve();
    });

    expect(recoverEvent).not.toHaveBeenCalled();
  });
});
