import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import Constants from 'expo-constants';
import type { z } from 'zod';
import { resolveApiBaseUrl } from '@/lib/api-url';
import { CONFIG } from '@/lib/config';
import {
  quizAttemptSchema,
  quizEventsResponseSchema,
  quizResultSchema,
} from '@/schemas/quiz-schemas';
import { getQuizAuthHeaders } from '@/services/quiz-auth-headers';
import {
  getOptionalString,
  getQuizErrorCode,
  getQuizErrorMessage,
  readQuizJson,
} from '@/services/quiz-service-utils';
import type {
  QuizAttempt,
  QuizEvent,
  QuizResult,
  QuizServiceOptions,
  StartQuizAttemptInput,
  SubmitQuizAnswerInput,
} from '@/services/quiz-types';
import { QuizServiceError } from '@/services/quiz-types';

export * from '@/services/quiz-types';

const QUIZ_EVENTS_PAGE_LIMIT = 50;

function getApiBaseUrl(configuredUrl?: string): string {
  const extra = getExpoExtraConfig(Constants.expoConfig?.extra);
  return resolveApiBaseUrl(configuredUrl ?? extra?.apiBaseUrl ?? extra?.apiUrl);
}

function getExpoExtraConfig(value: unknown):
  | {
      apiBaseUrl?: string;
      apiUrl?: string;
      merchantId?: string;
      merchantSlug?: string;
    }
  | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const extra = value as Record<string, unknown>;
  const apiBaseUrl = getOptionalString(extra.apiBaseUrl);
  const apiUrl = getOptionalString(extra.apiUrl);
  const merchantId = getOptionalString(extra.merchantId);
  const merchantSlug = getOptionalString(extra.merchantSlug);
  return { apiBaseUrl, apiUrl, merchantId, merchantSlug };
}

function getQuizEventsPath(
  pagination: { limit?: number; offset?: number } = {}
): string {
  const extra = getExpoExtraConfig(Constants.expoConfig?.extra);
  const params = new URLSearchParams();
  const merchantId = extra?.merchantId ?? getOptionalString(CONFIG.MERCHANT_ID);
  const merchantSlug =
    extra?.merchantSlug ?? getOptionalString(CONFIG.MERCHANT_SLUG);

  if (!merchantId && !merchantSlug) {
    throw new QuizServiceError(
      'Quiz merchant context is not configured',
      'QUIZ_CONFIGURATION_REQUIRED',
      500
    );
  }

  if (merchantId) {
    params.set('merchantId', merchantId);
  } else if (merchantSlug) {
    params.set('merchantSlug', merchantSlug);
  }
  if (pagination.limit !== undefined) {
    params.set('limit', String(pagination.limit));
  }
  if (pagination.offset !== undefined) {
    params.set('offset', String(pagination.offset));
  }

  const query = params.toString();
  return `/api/quiz/events?${query}`;
}

async function requestQuiz<T>(
  path: string,
  init: RequestInit,
  responseSchema: z.ZodType<T>,
  baseUrl?: string,
  expectedUserId?: string
): Promise<T> {
  const { headers: authHeaders, userId } = await getQuizAuthHeaders();
  // Bind the request to the shopper the caller intended: if the account signed
  // out or switched while the auth headers resolved, the token now belongs to a
  // different user, so refuse rather than spend their attempt.
  if (expectedUserId !== undefined && userId !== expectedUserId) {
    throw new QuizServiceError(
      'Your session changed. Please try again.',
      'quiz_session_changed',
      409
    );
  }
  const response = await fetch(`${getApiBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
      ...authHeaders,
    },
  });
  const payload = await readQuizJson(response);

  if (!response.ok) {
    throw new QuizServiceError(
      getQuizErrorMessage(payload),
      getQuizErrorCode(payload),
      response.status
    );
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new QuizServiceError(
      'Invalid quiz response',
      'QUIZ_INVALID_RESPONSE',
      502
    );
  }

  return parsed.data;
}

export async function fetchQuizEvents(
  options: QuizServiceOptions = {}
): Promise<QuizEvent[]> {
  const events: QuizEvent[] = [];
  let offset = 0;

  for (;;) {
    const payload = await requestQuiz(
      getQuizEventsPath({ limit: QUIZ_EVENTS_PAGE_LIMIT, offset }),
      { method: 'GET' },
      quizEventsResponseSchema,
      options.baseUrl
    );
    events.push(...payload.events);

    if (
      !payload.pagination?.hasMore ||
      payload.pagination.nextOffset === null
    ) {
      return events;
    }
    if (payload.pagination.nextOffset <= offset) {
      throw new QuizServiceError(
        'Invalid quiz pagination response',
        'QUIZ_INVALID_RESPONSE',
        502
      );
    }
    offset = payload.pagination.nextOffset;
  }
}

export function startQuizAttempt({
  baseUrl,
  deviceFingerprint,
  eventId,
  expectedUserId,
  integrityTier,
}: StartQuizAttemptInput): Promise<QuizAttempt> {
  return requestQuiz<QuizAttempt>(
    '/api/quiz/attempts/start',
    {
      method: 'POST',
      body: JSON.stringify({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId,
        integrityTier,
        ...(deviceFingerprint ? { deviceFingerprint } : {}),
      }),
    },
    quizAttemptSchema,
    baseUrl,
    expectedUserId
  );
}

export function submitQuizAnswer({
  answer,
  baseUrl,
  clientAnsweredAt,
  integrityTier,
  attemptId,
  questionId,
}: SubmitQuizAnswerInput): Promise<QuizResult> {
  return requestQuiz<QuizResult>(
    `/api/quiz/attempts/${encodeURIComponent(attemptId)}/answers`,
    {
      method: 'POST',
      body: JSON.stringify({
        answer,
        integrityTier,
        questionId,
        // Sent only when captured so non-timed callers keep the minimal payload.
        ...(clientAnsweredAt ? { clientAnsweredAt } : {}),
      }),
    },
    quizResultSchema,
    baseUrl
  );
}
