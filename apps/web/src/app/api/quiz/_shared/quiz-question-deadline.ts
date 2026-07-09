import { logger } from '@/lib/logger';
import type { ServerSupabaseClient } from './route-helpers-guards';

type QuizResponseQuestion = {
  deadlineAt?: unknown;
  id?: unknown;
  timeLimitSeconds?: unknown;
};

type QuizResponseWithQuestion = {
  attemptId?: unknown;
  question?: QuizResponseQuestion | null;
};

type QuizAttemptQuestionDeadlineRow = {
  issued_at?: string | null;
  time_limit_ms?: number | string | null;
};

const FALLBACK_QUIZ_QUESTION_TIME_LIMIT_MS = 30_000;

function getQuizQuestionDeadlineAt(
  row: QuizAttemptQuestionDeadlineRow
): string | null {
  if (typeof row.issued_at !== 'string') return null;
  const issuedAtMs = Date.parse(row.issued_at);
  const timeLimitMs = Number(row.time_limit_ms ?? 30_000);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(timeLimitMs)) {
    return null;
  }
  return new Date(issuedAtMs + timeLimitMs).toISOString();
}

function getFallbackQuizQuestionDeadlineAt(
  question: QuizResponseQuestion
): string {
  if (
    typeof question.deadlineAt === 'string' &&
    Number.isFinite(Date.parse(question.deadlineAt))
  ) {
    return question.deadlineAt;
  }

  const questionTimeLimitSeconds = Number(question.timeLimitSeconds);
  const fallbackTimeLimitMs =
    Number.isFinite(questionTimeLimitSeconds) && questionTimeLimitSeconds > 0
      ? questionTimeLimitSeconds * 1000
      : FALLBACK_QUIZ_QUESTION_TIME_LIMIT_MS;

  return new Date(Date.now() + fallbackTimeLimitMs).toISOString();
}

function attachDeadlineToPayload<T>(payload: T, deadlineAt: string): T {
  const responsePayload = payload as QuizResponseWithQuestion;

  return {
    ...(payload as Record<string, unknown>),
    question: {
      ...responsePayload.question,
      deadlineAt,
    },
  } as T;
}

export async function attachQuizQuestionDeadline<T>(
  supabase: ServerSupabaseClient,
  payload: T
): Promise<{ data: T; response: null }> {
  if (!payload || typeof payload !== 'object') {
    return { data: payload, response: null };
  }

  const responsePayload = payload as QuizResponseWithQuestion;
  if (
    typeof responsePayload.attemptId !== 'string' ||
    !responsePayload.question ||
    typeof responsePayload.question !== 'object' ||
    typeof responsePayload.question.id !== 'string'
  ) {
    return { data: payload, response: null };
  }

  const { data, error } = await supabase
    .from('quiz_attempt_questions')
    .select('issued_at, time_limit_ms')
    .eq('attempt_id', responsePayload.attemptId)
    .eq('slot_id', responsePayload.question.id)
    .maybeSingle();

  if (error || !data) {
    logger.error({
      attemptId: responsePayload.attemptId,
      error,
      message: 'Quiz question deadline lookup failed',
      questionId: responsePayload.question.id,
    });
    return {
      data: attachDeadlineToPayload(
        payload,
        getFallbackQuizQuestionDeadlineAt(responsePayload.question)
      ),
      response: null,
    };
  }

  const deadlineAt = getQuizQuestionDeadlineAt(
    data as QuizAttemptQuestionDeadlineRow
  );
  if (!deadlineAt) {
    logger.error({
      attemptId: responsePayload.attemptId,
      message: 'Quiz question deadline row was invalid',
      questionId: responsePayload.question.id,
    });
    return {
      data: attachDeadlineToPayload(
        payload,
        getFallbackQuizQuestionDeadlineAt(responsePayload.question)
      ),
      response: null,
    };
  }

  return {
    data: attachDeadlineToPayload(payload, deadlineAt),
    response: null,
  };
}
