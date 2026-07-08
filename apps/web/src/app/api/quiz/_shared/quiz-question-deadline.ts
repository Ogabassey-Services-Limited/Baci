import {
  NextResponse as NextJsonResponse,
  type NextResponse,
} from 'next/server';
import { logger } from '@/lib/logger';
import type { ServerSupabaseClient } from './route-helpers-guards';

type QuizResponseQuestion = {
  id?: unknown;
};

type QuizResponseWithQuestion = {
  attemptId?: unknown;
  question?: QuizResponseQuestion | null;
};

type QuizAttemptQuestionDeadlineRow = {
  issued_at?: string | null;
  time_limit_ms?: number | string | null;
};

function quizDeadlineLookupErrorResponse() {
  return NextJsonResponse.json(
    { error: 'Quiz request failed' },
    { status: 500 }
  );
}

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

export async function attachQuizQuestionDeadline<T>(
  supabase: ServerSupabaseClient,
  payload: T
): Promise<
  { data: T; response: null } | { data: null; response: NextResponse }
> {
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
    return { data: null, response: quizDeadlineLookupErrorResponse() };
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
    return { data: null, response: quizDeadlineLookupErrorResponse() };
  }

  return {
    data: {
      ...(payload as Record<string, unknown>),
      question: {
        ...responsePayload.question,
        deadlineAt,
      },
    } as T,
    response: null,
  };
}
