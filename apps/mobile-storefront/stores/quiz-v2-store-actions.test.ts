import { jest } from '@jest/globals';
import type {
  QuizActiveAttemptResponse,
  QuizV2Attempt,
} from '@/services/quiz-types';
import {
  initialQuizV2State,
  type QuizRecoveryEnvelope,
  type QuizV2StoreState,
  type V2StartContext,
} from './quiz-recovery-envelope';
import { createQuizV2StoreActions } from './quiz-v2-store-actions';

const mockPersist =
  jest.fn<
    (attempt: QuizV2Attempt, lockedOptionId: string | null) => Promise<void>
  >();
const mockLoadRecoveryEnvelope =
  jest.fn<
    (userId: string, eventId: string) => Promise<QuizRecoveryEnvelope | null>
  >();
const mockSaveQuizStartRequest =
  jest.fn<
    (
      context: V2StartContext,
      generation: number,
      startRequestId: string
    ) => Promise<void>
  >();
jest.mock('./quiz-recovery-envelope', () => {
  const actual = jest.requireActual<typeof import('./quiz-recovery-envelope')>(
    './quiz-recovery-envelope'
  );
  return {
    ...actual,
    loadQuizRecoveryEnvelope: (
      ...args: Parameters<typeof actual.loadQuizRecoveryEnvelope>
    ) => mockLoadRecoveryEnvelope(...args),
  };
});
jest.mock('./quiz-v2-recovery-storage', () => ({
  clearRecoveredQuizAttempt: jest.fn(async () => undefined),
  clearTerminalRecovery: jest.fn(async () => undefined),
  createQuizAttemptPersistence: jest.fn(() => mockPersist),
  saveQuizStartRequest: (
    context: V2StartContext,
    generation: number,
    startRequestId: string
  ) => mockSaveQuizStartRequest(context, generation, startRequestId),
}));

const activeAttempt: QuizV2Attempt = {
  attemptId: 'attempt-1',
  eventEndsAt: '2026-08-04T12:05:00.000Z',
  eventId: 'event-1',
  question: {
    deadlineAt: '2026-08-04T12:00:10.000Z',
    id: 'question-1',
    index: 1,
    issuedAt: '2026-08-04T12:00:00.000Z',
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    prompt: 'Pick one',
    timeLimitSeconds: 10,
    total: 2,
  },
  resultsAvailableAt: null,
  serverNow: '2026-08-04T12:00:00.000Z',
  status: 'in_progress',
};
const activeQuestion = activeAttempt.question;
if (!activeQuestion)
  throw new Error('The active-attempt fixture needs a question');

function createHarness() {
  let generation = 0;
  let state = {
    ...initialQuizV2State,
    attemptIntegrityTier: 'strong' as const,
    error: null,
    recoveryUserId: 'user-1',
    selectedEventId: activeAttempt.eventId,
    startRequestId: '11111111-1111-4111-8111-111111111111',
    status: 'question' as const,
    v2Attempt: activeAttempt,
  } as QuizV2StoreState;
  const set = (patch: Partial<QuizV2StoreState>) => {
    state = { ...state, ...patch };
  };
  const actions = createQuizV2StoreActions({
    get: () => state,
    getGeneration: () => generation,
    getMessage: (error) =>
      error instanceof Error ? error.message : String(error),
    set,
  });
  return {
    actions,
    getState: () => state,
    set,
    setGeneration: (nextGeneration: number) => {
      generation = nextGeneration;
    },
  };
}

function response(
  overrides: Partial<QuizActiveAttemptResponse>
): QuizActiveAttemptResponse {
  return {
    availability: 'active',
    attempt: activeAttempt,
    eventEndsAt: activeAttempt.eventEndsAt,
    serverNow: activeAttempt.serverNow,
    ...overrides,
  };
}

describe('createQuizV2StoreActions terminal expiry', () => {
  beforeEach(() => {
    mockPersist.mockResolvedValue(undefined);
    mockLoadRecoveryEnvelope.mockResolvedValue(null);
    mockSaveQuizStartRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockPersist.mockReset();
    mockLoadRecoveryEnvelope.mockReset();
    mockSaveQuizStartRequest.mockReset();
  });

  it('still starts when recovery storage rejects the start envelope', async () => {
    mockSaveQuizStartRequest.mockRejectedValueOnce(new Error('storage full'));
    const harness = createHarness();
    const starter = jest.fn(async () => activeAttempt);

    await harness.actions.startEventV2(
      {
        eventId: 'event-1',
        integrityTier: 'strong',
        startRequestId: '44444444-4444-4444-8444-444444444444',
        userId: 'user-1',
      },
      starter
    );

    expect(mockSaveQuizStartRequest).toHaveBeenCalledTimes(1);
    expect(starter).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444'
    );
    expect(harness.getState()).toMatchObject({
      status: 'question',
      v2Attempt: activeAttempt,
    });
  });

  it('does not write a stale starting state after recovery storage resolves', async () => {
    const harness = createHarness();
    let resolveLoad!: (value: null) => void;
    const load = new Promise<null>((resolve) => {
      resolveLoad = resolve;
    });
    const starter = jest.fn(async () => activeAttempt);
    mockLoadRecoveryEnvelope.mockReturnValueOnce(load);

    const start = harness.actions.startEventV2(
      {
        eventId: 'event-1',
        integrityTier: 'strong',
        startRequestId: '33333333-3333-4333-8333-333333333333',
        userId: 'user-1',
      },
      starter
    );
    harness.setGeneration(1);
    resolveLoad(null);
    await start;

    expect(starter).not.toHaveBeenCalled();
    expect(harness.getState().status).toBe('question');
  });

  it('still submits when recovery storage rejects', async () => {
    mockPersist.mockRejectedValueOnce(new Error('storage full'));
    const harness = createHarness();
    const submitter = jest.fn(async () => activeAttempt);

    await harness.actions.lockAndSubmitAnswer('a', submitter);

    expect(submitter).toHaveBeenCalledWith('a');
    expect(harness.getState()).toMatchObject({
      lockedOptionId: null,
      status: 'question',
    });
  });

  it('keeps the terminal attempt id returned after a lost start response', async () => {
    mockLoadRecoveryEnvelope.mockResolvedValueOnce(null);
    const harness = createHarness();

    await harness.actions.recoverEvent(
      'user-1',
      'event-1',
      async () =>
        response({
          attempt: undefined,
          attemptId: 'attempt-recovered',
          availability: 'pending_results',
        }),
      jest.fn<
        (optionId: string, questionId: string) => Promise<QuizV2Attempt>
      >()
    );

    expect(harness.getState()).toMatchObject({
      status: 'result',
      terminalContext: {
        attemptId: 'attempt-recovered',
        eventId: 'event-1',
      },
      v2LifecycleStatus: 'pending_results',
    });
  });

  it('does not apply a resend response after the account generation changes', async () => {
    const harness = createHarness();
    mockLoadRecoveryEnvelope.mockResolvedValueOnce({
      attemptId: activeAttempt.attemptId,
      currentQuestionId: activeQuestion.id,
      eventId: activeAttempt.eventId,
      generation: 0,
      pendingLockedOptionId: 'a',
      startRequestId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      version: 1,
    });
    let resolveResend!: (attempt: QuizV2Attempt) => void;
    const resend = jest.fn(
      () =>
        new Promise<QuizV2Attempt>((resolve) => {
          resolveResend = resolve;
        })
    );
    const recovery = harness.actions.recoverEvent(
      'user-1',
      'event-1',
      async () => response({}),
      resend
    );

    for (let attempts = 0; attempts < 10 && !resolveResend; attempts += 1) {
      await Promise.resolve();
    }
    if (!resolveResend) throw new Error('resender did not start');
    harness.setGeneration(1);
    harness.set({ ...initialQuizV2State, status: 'ready' });
    resolveResend(activeAttempt);

    await expect(recovery).resolves.toBe('retry');
    expect(harness.getState()).toMatchObject({
      error: null,
      status: 'ready',
      v2Attempt: null,
    });
  });

  it('clears a transient recovery error when terminal recovery succeeds', async () => {
    const harness = createHarness();
    await expect(
      harness.actions.recoverEvent(
        'user-1',
        'event-1',
        async () => {
          throw new Error('temporary recovery failure');
        },
        jest.fn<
          (optionId: string, questionId: string) => Promise<QuizV2Attempt>
        >(async () => activeAttempt)
      )
    ).resolves.toBe('retry');
    expect(harness.getState().error).toBe('temporary recovery failure');

    await expect(
      harness.actions.recoverEvent(
        'user-1',
        'event-1',
        async () =>
          response({
            attempt: undefined,
            attemptId: activeAttempt.attemptId,
            availability: 'pending_results',
          }),
        jest.fn<
          (optionId: string, questionId: string) => Promise<QuizV2Attempt>
        >(async () => activeAttempt)
      )
    ).resolves.toBe('recovered');

    expect(harness.getState()).toMatchObject({
      error: null,
      status: 'result',
      v2LifecycleStatus: 'pending_results',
    });
  });

  it('expiry_applies_active_response', async () => {
    const harness = createHarness();
    const nextAttempt = {
      ...activeAttempt,
      question: {
        ...activeQuestion,
        id: 'question-2',
        index: 2,
      },
    };

    await harness.actions.expireActiveEvent(async () =>
      response({ attempt: nextAttempt })
    );

    expect(harness.getState()).toMatchObject({
      status: 'question',
      v2Attempt: nextAttempt,
      v2LifecycleStatus: 'in_progress',
      terminalContext: null,
    });
  });

  it('expiry_enters_pending_results', async () => {
    const harness = createHarness();

    await harness.actions.expireActiveEvent(async () =>
      response({ availability: 'pending_results', attempt: undefined })
    );

    expect(harness.getState()).toMatchObject({
      status: 'result',
      v2LifecycleStatus: 'pending_results',
      terminalContext: {
        attemptId: activeAttempt.attemptId,
        eventId: activeAttempt.eventId,
        contractVersion: 2,
      },
    });
  });

  it('expiry_enters_cancelled', async () => {
    const harness = createHarness();

    await harness.actions.expireActiveEvent(async () =>
      response({ availability: 'cancelled', attempt: undefined })
    );

    expect(harness.getState()).toMatchObject({
      status: 'result',
      v2LifecycleStatus: 'event_cancelled',
      terminalContext: {
        attemptId: activeAttempt.attemptId,
        eventId: activeAttempt.eventId,
        contractVersion: 2,
      },
    });
  });

  it('expiry_rejects_expired_active_response', async () => {
    const harness = createHarness();

    await harness.actions.expireActiveEvent(async () =>
      response({
        serverNow: activeAttempt.eventEndsAt,
        attempt: { ...activeAttempt, question: { ...activeQuestion } },
      })
    );

    expect(harness.getState()).toMatchObject({
      status: 'result',
      v2Attempt: null,
      v2LifecycleStatus: 'pending_results',
    });
  });

  it.each([
    'none',
    'unavailable',
  ] as const)('expiry_keeps_the_question_retryable when reconciliation returns %s', async (availability) => {
    const harness = createHarness();

    await harness.actions.expireActiveEvent(async () =>
      response({ availability, attempt: undefined })
    );

    expect(harness.getState()).toMatchObject({
      error: null,
      expiryRetryable: true,
      status: 'question',
      v2Attempt: activeAttempt,
    });
  });

  it('expiry_deduplicates_concurrent_calls', async () => {
    const harness = createHarness();
    let resolveReconciliation!: (value: QuizActiveAttemptResponse) => void;
    const reconciler = jest.fn(
      () =>
        new Promise<QuizActiveAttemptResponse>((resolve) => {
          resolveReconciliation = resolve;
        })
    );

    const first = harness.actions.expireActiveEvent(reconciler);
    const second = harness.actions.expireActiveEvent(reconciler);
    resolveReconciliation(response({}));
    await Promise.all([first, second]);

    expect(reconciler).toHaveBeenCalledTimes(1);
  });

  it('expiry_preserves_locked_answer_on_network_error', async () => {
    const harness = createHarness();
    harness.set({ lockedOptionId: 'a', status: 'submitting' });

    await harness.actions.expireActiveEvent(async () => {
      throw new Error('network down');
    });

    expect(harness.getState()).toMatchObject({
      lockedOptionId: 'a',
      status: 'question',
      error: 'network down',
      expiryRetryable: true,
    });
  });

  it('retry_locked_answer_resubmits_once', async () => {
    const harness = createHarness();
    harness.set({ lockedOptionId: 'a' });
    const submitter = jest.fn(async () => activeAttempt);

    await Promise.all([
      harness.actions.retryLockedAnswer(submitter),
      harness.actions.retryLockedAnswer(submitter),
    ]);

    expect(submitter).toHaveBeenCalledTimes(1);
    expect(harness.getState()).toMatchObject({
      status: 'question',
      lockedOptionId: null,
    });
  });

  it('retry_locked_answer_ignores_failure_after_expiry', async () => {
    const harness = createHarness();
    harness.set({ lockedOptionId: 'a', status: 'submitting' });
    let rejectRetry!: (error: Error) => void;
    const retry = harness.actions.retryLockedAnswer(
      () =>
        new Promise<QuizV2Attempt>((_, reject) => {
          rejectRetry = reject;
        })
    );

    await harness.actions.expireActiveEvent(async () =>
      response({ availability: 'pending_results', attempt: undefined })
    );
    rejectRetry(new Error('late network failure'));
    await retry;

    expect(harness.getState()).toMatchObject({
      status: 'result',
      v2LifecycleStatus: 'pending_results',
    });
  });
});
