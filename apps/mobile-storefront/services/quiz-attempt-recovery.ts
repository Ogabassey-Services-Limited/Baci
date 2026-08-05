import { quizV2ActiveAttemptResponseSchema } from '@/schemas/quiz-schemas';
import { requestQuizV2 } from './quiz';
import type {
  QuizActiveAttemptResponse,
  QuizServiceOptions,
} from './quiz-types';

export interface RecoverQuizAttemptInput extends QuizServiceOptions {
  deviceFingerprint?: string | null;
  eventId: string;
  expectedUserId: string;
}

export function recoverActiveQuizAttempt({
  baseUrl,
  deviceFingerprint,
  eventId,
  expectedUserId,
}: RecoverQuizAttemptInput): Promise<QuizActiveAttemptResponse> {
  const query = new URLSearchParams({ eventId }).toString();
  return requestQuizV2(
    `/api/quiz/attempts/active?${query}`,
    { method: 'GET' },
    quizV2ActiveAttemptResponseSchema,
    { baseUrl, deviceFingerprint, expectedUserId }
  );
}
