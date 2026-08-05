import { quizV2ResultResponseSchema } from '@/schemas/quiz-schemas';
import { requestQuizV2 } from './quiz';
import type { QuizServiceOptions, QuizV2Result } from './quiz-types';

export interface FetchQuizResultInput extends QuizServiceOptions {
  attemptId: string;
  expectedUserId: string;
}

export function fetchQuizResult({
  attemptId,
  baseUrl,
  expectedUserId,
}: FetchQuizResultInput): Promise<QuizV2Result> {
  return requestQuizV2(
    `/api/quiz/attempts/${encodeURIComponent(attemptId)}/result`,
    { method: 'GET' },
    quizV2ResultResponseSchema,
    { baseUrl, expectedUserId }
  );
}
