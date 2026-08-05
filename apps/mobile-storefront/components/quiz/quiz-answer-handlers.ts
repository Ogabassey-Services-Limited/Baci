import type { submitQuizAnswer } from '@/services/quiz';
import type { submitQuizAnswerV2 } from '@/services/quiz-attempts';
import type {
  QuizAttempt,
  QuizIntegrityTier,
  QuizResult,
  QuizV2Attempt,
} from '@/services/quiz-types';

const QUIZ_FORFEIT_ANSWER = '__timeout_no_answer__';
const ACTION_FAILED_COPY = 'Quiz action failed';

type QuizAnswerHandlersOptions = {
  attempt: QuizAttempt | null;
  attemptIntegrityTier: QuizIntegrityTier | null;
  forfeitAnswer: (
    submitter: () => Promise<QuizResult>,
    retryOptionId?: string
  ) => Promise<void>;
  getErrorMessage: (error: unknown, fallback: string) => string;
  getUserId: () => string | undefined;
  lockAndSubmitAnswer: (
    optionId: string,
    submitter: (optionId: string) => Promise<QuizV2Attempt>
  ) => Promise<void>;
  logSubmitFailure: (error: unknown) => void;
  selectedOptionId: string | null;
  setError: (message: string) => void;
  status: string;
  submitLegacyAnswer: typeof submitQuizAnswer;
  submitSelectedAnswer: (submitter: () => Promise<QuizResult>) => Promise<void>;
  submitV2Answer: typeof submitQuizAnswerV2;
  v2Attempt: QuizV2Attempt | null;
};

export function createQuizAnswerHandlers({
  attempt,
  attemptIntegrityTier,
  forfeitAnswer,
  getErrorMessage,
  getUserId,
  lockAndSubmitAnswer,
  logSubmitFailure,
  selectedOptionId,
  setError,
  status,
  submitLegacyAnswer,
  submitSelectedAnswer,
  submitV2Answer,
  v2Attempt,
}: QuizAnswerHandlersOptions) {
  const submitAnswerValue = async (answer: string, viaForfeit: boolean) => {
    if (!attempt) return;

    const submitter = () =>
      submitLegacyAnswer({
        answer,
        integrityTier: attemptIntegrityTier ?? 'basic',
        attemptId: attempt.attemptId,
        questionId: attempt.question.id,
        clientAnsweredAt: new Date().toISOString(),
      });

    try {
      await (viaForfeit
        ? forfeitAnswer(submitter, answer)
        : submitSelectedAnswer(submitter));
    } catch (error) {
      logSubmitFailure(error);
      setError(getErrorMessage(error, ACTION_FAILED_COPY));
    }
  };

  return {
    handleSubmit: async () => {
      // Defensive guard: the submit button is disabled until these values exist.
      if (!attempt || !selectedOptionId) return;
      await submitAnswerValue(selectedOptionId, false);
    },
    handleTimeExpired: () => {
      // The store's in-flight guard makes this safe against a simultaneous
      // manual submit.
      if (!attempt || status !== 'question') return;
      void submitAnswerValue(selectedOptionId ?? QUIZ_FORFEIT_ANSWER, true);
    },
    handleV2Answer: (optionId: string) => {
      const userId = getUserId();
      const question = v2Attempt?.question;
      if (!userId) {
        setError('Your session changed. Please try again.');
        return;
      }
      if (!v2Attempt || !question) {
        setError('No active quiz question is available. Please try again.');
        return;
      }
      void lockAndSubmitAnswer(optionId, (answer) =>
        submitV2Answer({
          answer,
          attemptId: v2Attempt.attemptId,
          clientAnsweredAt: new Date().toISOString(),
          expectedUserId: userId,
          questionId: question.id,
        })
      );
    },
  };
}
