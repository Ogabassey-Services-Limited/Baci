import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import * as Crypto from 'expo-crypto';
import { quizV2AttemptResponseSchema } from '@/schemas/quiz-schemas';
import {
  getQuizAppMetadata,
  requestQuizV2,
  startQuizAttempt,
  submitQuizAnswer,
} from './quiz';
import type {
  QuizV2Attempt,
  StartQuizAttemptV2Input,
  SubmitQuizAnswerV2Input,
} from './quiz-types';
import { QuizServiceError } from './quiz-types';

export type {
  QuizAttempt,
  QuizResult,
  StartQuizAttemptInput,
  SubmitQuizAnswerInput,
} from './quiz-types';
export { startQuizAttempt, submitQuizAnswer };

export function createQuizStartRequestId(): string {
  return Crypto.randomUUID();
}

export async function startQuizAttemptV2({
  acceptedRulesVersion,
  baseUrl,
  deviceFingerprint,
  eventId,
  expectedUserId,
  integrityTier,
  mode,
  startRequestId,
  termsAccepted,
}: StartQuizAttemptV2Input): Promise<QuizV2Attempt> {
  if (mode === 'live' && !deviceFingerprint) {
    throw new QuizServiceError(
      'This app needs a device identity before a live quiz can start.',
      'QUIZ_DEVICE_REQUIRED',
      409
    );
  }
  const { appVersion, platform } = getQuizAppMetadata();
  return await requestQuizV2(
    '/api/quiz/attempts/start',
    {
      body: JSON.stringify({
        acceptedRulesVersion,
        appVersion,
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId,
        expectedUserId,
        integrityTier,
        platform,
        startRequestId,
        termsAccepted,
      }),
      method: 'POST',
    },
    quizV2AttemptResponseSchema,
    { baseUrl, deviceFingerprint, expectedUserId }
  );
}

export function submitQuizAnswerV2({
  answer,
  attemptId,
  baseUrl,
  clientAnsweredAt,
  expectedUserId,
  questionId,
}: SubmitQuizAnswerV2Input): Promise<QuizV2Attempt> {
  return requestQuizV2(
    `/api/quiz/attempts/${encodeURIComponent(attemptId)}/answers`,
    {
      body: JSON.stringify({
        answer,
        ...(clientAnsweredAt ? { clientAnsweredAt } : {}),
        questionId,
      }),
      method: 'POST',
    },
    quizV2AttemptResponseSchema,
    { baseUrl, expectedUserId }
  );
}
