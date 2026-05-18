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

function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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

function getQuizEventsPath(): string {
  const extra = getExpoExtraConfig(Constants.expoConfig?.extra);
  const params = new URLSearchParams();
  const merchantId = extra?.merchantId ?? getOptionalString(CONFIG.MERCHANT_ID);
  const merchantSlug =
    extra?.merchantSlug ?? getOptionalString(CONFIG.MERCHANT_SLUG);

  if (merchantId) {
    params.set('merchantId', merchantId);
  } else if (merchantSlug) {
    params.set('merchantSlug', merchantSlug);
  }

  const query = params.toString();
  return query ? `/api/quiz/events?${query}` : '/api/quiz/events';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    console.warn('Unable to parse quiz API JSON response', {
      errorName: error instanceof Error ? error.name : typeof error,
      status: response.status,
    });
    return null;
  }
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

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

function getErrorMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Quiz request failed';
}

function getErrorCode(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    typeof payload.code === 'string'
  ) {
    return payload.code;
  }

  return 'QUIZ_REQUEST_FAILED';
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
  const payload = await readJson(response);

  if (!response.ok) {
    throw new QuizServiceError(
      getErrorMessage(payload),
      getErrorCode(payload),
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
  const payload = await requestQuiz(
    getQuizEventsPath(),
    { method: 'GET' },
    quizEventsResponseSchema,
    options.baseUrl
  );
  return payload.events;
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
