import Constants from 'expo-constants';
import type { z } from 'zod';
import { resolveApiBaseUrl } from '@/lib/api-url';
import { CONFIG } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import {
  quizAttemptSchema,
  quizEventsResponseSchema,
  quizResultSchema,
} from '@/schemas/quiz-schemas';
import {
  getOptionalString,
  getQuizErrorCode,
  getQuizErrorMessage,
  getSafeErrorMessage,
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

export type {
  QuizAttempt,
  QuizEvent,
  QuizEventStatus,
  QuizIntegrityTier,
  QuizOption,
  QuizQuestion,
  QuizResult,
  QuizServiceOptions,
  StartQuizAttemptInput,
  SubmitQuizAnswerInput,
} from '@/services/quiz-types';
export { QuizServiceError };

const QUIZ_AUTH_RETRY_DELAY_MS = 300;
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

function waitForQuizAuthRetry() {
  return new Promise((resolve) => {
    setTimeout(resolve, QUIZ_AUTH_RETRY_DELAY_MS);
  });
}

function isDefinitiveAuthError(error: unknown): boolean {
  const message = getSafeErrorMessage(error).toLowerCase();
  const status =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : null;

  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    message.includes('invalid') ||
    message.includes('expired') ||
    message.includes('jwt') ||
    message.includes('refresh token')
  );
}

async function getQuizAuthHeaders(): Promise<Record<string, string>> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const canRetry = attempt < maxAttempts;

    try {
      const { data, error } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (error) {
        console.warn('Unable to read quiz auth session', {
          attempt,
          message: getSafeErrorMessage(error),
        });
        if (canRetry && !isDefinitiveAuthError(error)) {
          await waitForQuizAuthRetry();
          continue;
        }
        break;
      }

      if (!accessToken) break;

      const { data: userData, error: userError } =
        await supabase.auth.getUser(accessToken);

      if (!userError && userData.user) {
        return { Authorization: `Bearer ${accessToken}` };
      }

      if (userError) {
        console.warn('Unable to validate quiz auth session', {
          attempt,
          message: getSafeErrorMessage(userError),
        });
        if (canRetry && !isDefinitiveAuthError(userError)) {
          await waitForQuizAuthRetry();
          continue;
        }
      }
      break;
    } catch (error) {
      console.warn('Unable to read quiz auth session', {
        attempt,
        message: getSafeErrorMessage(error),
      });
      if (canRetry && !isDefinitiveAuthError(error)) {
        await waitForQuizAuthRetry();
        continue;
      }
      break;
    }
  }

  throw new QuizServiceError(
    'Quiz authentication required',
    'QUIZ_AUTH_REQUIRED',
    401
  );
}

async function requestQuiz<T>(
  path: string,
  init: RequestInit,
  responseSchema: z.ZodType<T>,
  baseUrl?: string
): Promise<T> {
  const authHeaders = await getQuizAuthHeaders();
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

    if (!payload.pagination?.hasMore || payload.pagination.nextOffset === null) {
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
  eventId,
  integrityTier,
}: StartQuizAttemptInput): Promise<QuizAttempt> {
  return requestQuiz<QuizAttempt>(
    '/api/quiz/attempts/start',
    {
      method: 'POST',
      body: JSON.stringify({ eventId, integrityTier }),
    },
    quizAttemptSchema,
    baseUrl
  );
}

export function submitQuizAnswer({
  answer,
  baseUrl,
  integrityTier,
  attemptId,
  questionId,
}: SubmitQuizAnswerInput): Promise<QuizResult> {
  return requestQuiz<QuizResult>(
    `/api/quiz/attempts/${encodeURIComponent(attemptId)}/answers`,
    {
      method: 'POST',
      body: JSON.stringify({ answer, integrityTier, questionId }),
    },
    quizResultSchema,
    baseUrl
  );
}
