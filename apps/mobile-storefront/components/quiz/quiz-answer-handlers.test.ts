import { describe, expect, it, jest } from '@jest/globals';
import type {
  QuizAttempt,
  QuizResult,
  QuizV2Attempt,
} from '@/services/quiz-types';
import { createQuizAnswerHandlers } from './quiz-answer-handlers';

const attempt: QuizAttempt = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 0,
  question: {
    deadlineAt: '2026-08-05T12:00:30.000Z',
    id: 'question-1',
    index: 1,
    options: [{ id: 'option-1', label: 'One' }],
    prompt: 'Pick one',
    timeLimitSeconds: 30,
    total: 1,
  },
  remainingLoyaltyPoints: 5,
};

const result: QuizResult = {
  attemptId: attempt.attemptId,
  correctAnswers: 1,
  prizeEligible: false,
  status: 'completed',
  totalQuestions: 1,
};

function createHandlers(
  overrides: Partial<Parameters<typeof createQuizAnswerHandlers>[0]> = {}
) {
  const submitLegacyAnswer = jest.fn(async () => result);
  const submitSelectedAnswer = jest.fn(
    async (submitter: () => Promise<QuizResult>) => {
      await submitter();
    }
  );
  const forfeitAnswer = jest.fn(
    async (submitter: () => Promise<QuizResult>) => {
      await submitter();
    }
  );
  const lockAndSubmitAnswer = jest.fn(
    async (
      optionId: string,
      submitter: (answer: string) => Promise<QuizV2Attempt>
    ) => {
      await submitter(optionId);
    }
  );
  const submitV2Answer = jest.fn(async () => ({
    attemptId: 'attempt-v2',
    eventEndsAt: '2026-08-05T12:05:00.000Z',
    eventId: 'event-1',
    resultsAvailableAt: null,
    serverNow: '2026-08-05T12:00:00.000Z',
    status: 'in_progress' as const,
  }));
  const setError = jest.fn();

  return {
    forfeitAnswer,
    handlers: createQuizAnswerHandlers({
      attempt,
      attemptIntegrityTier: 'device',
      forfeitAnswer,
      getErrorMessage: (error) => String(error),
      getUserId: () => 'shopper-1',
      lockAndSubmitAnswer,
      logSubmitFailure: jest.fn(),
      selectedOptionId: 'option-1',
      setError,
      status: 'question',
      submitLegacyAnswer,
      submitSelectedAnswer,
      submitV2Answer,
      v2Attempt: null,
      ...overrides,
    }),
    lockAndSubmitAnswer,
    setError,
    submitLegacyAnswer,
    submitSelectedAnswer,
    submitV2Answer,
  };
}

describe('createQuizAnswerHandlers', () => {
  it('submits the selected legacy answer with the active attempt context', async () => {
    const { handlers, submitLegacyAnswer, submitSelectedAnswer } =
      createHandlers();

    await handlers.handleSubmit();

    expect(submitSelectedAnswer).toHaveBeenCalledTimes(1);
    expect(submitLegacyAnswer).toHaveBeenCalledWith({
      answer: 'option-1',
      attemptId: 'attempt-1',
      clientAnsweredAt: expect.any(String),
      integrityTier: 'device',
      questionId: 'question-1',
    });
  });

  it('forfeits with the timeout sentinel when no legacy option is selected', async () => {
    const { forfeitAnswer, handlers, submitLegacyAnswer } = createHandlers({
      selectedOptionId: null,
    });

    handlers.handleTimeExpired();
    await Promise.resolve();

    expect(forfeitAnswer).toHaveBeenCalledWith(
      expect.any(Function),
      '__timeout_no_answer__'
    );
    expect(submitLegacyAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: '__timeout_no_answer__' })
    );
  });

  it('does not submit a v2 answer after the shopper session changes', () => {
    const { handlers, setError, submitV2Answer } = createHandlers({
      getUserId: () => undefined,
    });

    handlers.handleV2Answer('option-1');

    expect(setError).toHaveBeenCalledWith(
      'Your session changed. Please try again.'
    );
    expect(submitV2Answer).not.toHaveBeenCalled();
  });

  it('submits v2 answers through the store lock with the verified shopper id', async () => {
    const v2Attempt: QuizV2Attempt = {
      attemptId: 'attempt-v2',
      eventEndsAt: '2026-08-05T12:05:00.000Z',
      eventId: 'event-1',
      question: attempt.question,
      resultsAvailableAt: null,
      serverNow: '2026-08-05T12:00:00.000Z',
      status: 'in_progress',
    };
    const { handlers, lockAndSubmitAnswer, submitV2Answer } = createHandlers({
      v2Attempt,
    });

    handlers.handleV2Answer('option-1');
    await Promise.resolve();

    expect(lockAndSubmitAnswer).toHaveBeenCalledWith(
      'option-1',
      expect.any(Function)
    );
    expect(submitV2Answer).toHaveBeenCalledWith({
      answer: 'option-1',
      attemptId: 'attempt-v2',
      clientAnsweredAt: expect.any(String),
      expectedUserId: 'shopper-1',
      questionId: 'question-1',
    });
  });
});
