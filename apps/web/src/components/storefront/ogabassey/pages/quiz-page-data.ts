import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import { apiGet, apiPost } from '@/lib/api-client';
import {
  type QuizEventResponse,
  quizAttemptResponseSchema,
  quizEventsResponseSchema,
  quizResultResponseSchema,
} from '@/schemas/quiz';
import { getQuizErrorMessage } from './get-quiz-error-message';

export type QuizStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'starting'
  | 'question'
  | 'submitting'
  | 'result';

const QUIZ_INTEGRITY_TIER = 'basic';

// Non-empty sentinel so an auto-submitted forfeit still satisfies the answer
// schema (min length 1). The server treats any non-matching answer as incorrect
// and advances the attempt, so a timed-out player is scored wrong rather than
// left stalled. It is intentionally longer than the 20-char option id cap
// (generatedQuizOptionSchema) so it can never equal a real option id and be
// scored correct by accident.
export const QUIZ_FORFEIT_ANSWER = '__baci_quiz_timeout_forfeit_no_answer__';

export async function fetchQuizEvents(merchantSlug: string) {
  const query = new URLSearchParams({ limit: '50', merchantSlug, offset: '0' });
  const parsed = quizEventsResponseSchema.safeParse(
    await apiGet<unknown>(`/api/quiz/events?${query}`)
  );
  if (!parsed.success) throw new Error('Invalid quiz response');
  return parsed.data.events;
}

export async function startQuizAttempt(eventId: string, expectedUserId?: string) {
  const parsed = quizAttemptResponseSchema.safeParse(
    await apiPost<unknown>('/api/quiz/attempts/start', {
      entryMode: QUIZ_FREE_ENTRY_MODE,
      eventId,
      integrityTier: QUIZ_INTEGRITY_TIER,
      // Pins the start to the initiating shopper; the route rejects (409) if the
      // cookie session switched while the POST was deferred (CSRF init/retry).
      ...(expectedUserId ? { expectedUserId } : {}),
    })
  );
  if (!parsed.success) throw new Error('Invalid quiz response');
  return parsed.data;
}

export async function submitQuizAnswer(
  attemptId: string,
  questionId: string,
  answer: string
) {
  const parsed = quizResultResponseSchema.safeParse(
    await apiPost<unknown>(
      `/api/quiz/attempts/${encodeURIComponent(attemptId)}/answers`,
      {
        answer,
        clientAnsweredAt: new Date().toISOString(),
        integrityTier: QUIZ_INTEGRITY_TIER,
        questionId,
      }
    )
  );
  if (!parsed.success) throw new Error('Invalid quiz response');
  return parsed.data;
}

interface QuizListSetters {
  setError: (error: string | null) => void;
  setEvents: (events: QuizEventResponse[]) => void;
  setStatus: (status: QuizStatus) => void;
}

// Module-scope helper so the status/error bookkeeping is not a synchronous
// setState inside the component's effect body.
export async function loadQuizEvents(
  merchantSlug: string,
  { setError, setEvents, setStatus }: QuizListSetters
) {
  setError(null);
  setStatus('loading');
  try {
    setEvents(await fetchQuizEvents(merchantSlug));
    setStatus('ready');
  } catch (error) {
    setError(getQuizErrorMessage(error));
    setStatus('error');
  }
}
