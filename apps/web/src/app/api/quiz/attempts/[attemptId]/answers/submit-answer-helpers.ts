import { NextResponse } from 'next/server';
import type { requireQuizUser } from '@/app/api/quiz/_shared/route-helpers';
import { rpcErrorResponse } from '@/app/api/quiz/_shared/route-helpers';
import { QuizVoucherTokenConfigError } from '@/lib/quiz-voucher-token';
import type { RawPrizeClaim } from './submit-answer-voucher';
import {
  addSignedPrizeClaim,
  normalizePrizeCondition,
  QUIZ_VOUCHER_TTL_MS,
  voucherTokenConfigResponse,
} from './submit-answer-voucher';

type QuizSupabase = Awaited<ReturnType<typeof requireQuizUser>>['supabase'];

export type SubmittedAttemptScore = {
  correctAnswers: number;
  totalQuestions: number;
};

function getRpcErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function isReplayStateError(error: unknown) {
  const code = getRpcErrorCode(error);
  return code === 'QZ004' || code === 'QZ026';
}

function getQuestionRows(row: unknown): unknown[] {
  if (!row || typeof row !== 'object' || !('quiz_attempt_questions' in row)) {
    return [];
  }

  const questions = (row as { quiz_attempt_questions?: unknown })
    .quiz_attempt_questions;
  return Array.isArray(questions) ? questions : [];
}

function getQuestionScore(question: unknown): number {
  if (
    !question ||
    typeof question !== 'object' ||
    !('quiz_attempt_answers' in question)
  ) {
    return 0;
  }

  const answers = (question as { quiz_attempt_answers?: unknown })
    .quiz_attempt_answers;
  const answerRows = Array.isArray(answers)
    ? answers
    : answers
      ? [answers]
      : [];
  return answerRows.reduce<number>((score, answer) => {
    if (!answer || typeof answer !== 'object' || !('score_delta' in answer)) {
      return score;
    }

    const delta = (answer as { score_delta?: unknown }).score_delta;
    return score + (typeof delta === 'number' ? delta : 0);
  }, 0);
}

export function mapSubmittedAttemptScore(
  row: unknown
): SubmittedAttemptScore | null {
  if (!row || typeof row !== 'object' || !('status' in row)) return null;
  if ((row as { status?: unknown }).status !== 'submitted') return null;

  const questions = getQuestionRows(row);
  if (questions.length === 0) return null;

  return {
    correctAnswers: questions.reduce<number>(
      (score, question) => score + getQuestionScore(question),
      0
    ),
    totalQuestions: questions.length,
  };
}

async function getSubmittedAttemptScore(
  supabase: QuizSupabase,
  attemptId: string,
  userId: string
): Promise<{ error: unknown; score: SubmittedAttemptScore | null }> {
  if (!supabase) return { error: null, score: null };

  const { data, error } = await supabase
    .from('quiz_attempts')
    .select(
      'id, status, customers!inner(user_id), quiz_attempt_questions(id, quiz_attempt_answers(score_delta))'
    )
    .eq('id', attemptId)
    .eq('customers.user_id', userId)
    .maybeSingle();

  if (error) return { error, score: null };
  return { error: null, score: mapSubmittedAttemptScore(data) };
}

// FIX B: on a replayed final answer the RPC no longer returns the prizeClaim,
// so recover the persisted, user-scoped product award and re-issue the signed
// voucher. Without this a winner whose first response was lost sees "Practice
// result recorded" with no claim button and the prize becomes unclaimable.
export async function getAttemptPrizeAwardClaim(
  supabase: QuizSupabase,
  attemptId: string,
  userId: string
): Promise<{
  claim: RawPrizeClaim | null;
  createdAt: string | null;
  error: unknown;
}> {
  if (!supabase) return { claim: null, createdAt: null, error: null };

  // Product-backed prizes are persisted as a single `store_credit` award per
  // attempt (unique on attempt_id + award_type). A null product_id (a pure
  // store-credit award) yields no claim via the guard below. Only an
  // `approved` (unredeemed, non-void) award should surface a claim button — a
  // replay after redemption/void must NOT re-issue a token.
  const { data, error } = await supabase
    .from('quiz_awards')
    .select(
      'id, product_id, variant_id, condition, created_at, customers!inner(user_id)'
    )
    .eq('attempt_id', attemptId)
    .eq('customers.user_id', userId)
    .eq('award_type', 'store_credit')
    .eq('status', 'approved')
    .maybeSingle();

  if (error) return { claim: null, createdAt: null, error };
  if (!data || typeof data !== 'object') {
    return { claim: null, createdAt: null, error: null };
  }

  const record = data as {
    condition?: unknown;
    created_at?: unknown;
    id?: unknown;
    product_id?: unknown;
    variant_id?: unknown;
  };
  if (typeof record.id !== 'string' || typeof record.product_id !== 'string') {
    return { claim: null, createdAt: null, error: null };
  }

  return {
    claim: {
      awardId: record.id,
      condition: normalizePrizeCondition(record.condition),
      productId: record.product_id,
      variantId:
        typeof record.variant_id === 'string' ? record.variant_id : null,
    },
    createdAt: typeof record.created_at === 'string' ? record.created_at : null,
    error: null,
  };
}

export async function recoverReplayedAttemptResponse(
  supabase: QuizSupabase,
  attemptId: string,
  userId: string
) {
  const recovered = await getSubmittedAttemptScore(supabase, attemptId, userId);
  if (recovered.error) return rpcErrorResponse();
  if (!recovered.score) {
    return NextResponse.json(
      {
        code: 'quiz_attempt_not_answerable',
        error: 'Quiz answer is no longer accepted for this attempt',
      },
      { status: 409 }
    );
  }

  const award = await getAttemptPrizeAwardClaim(supabase, attemptId, userId);
  if (award.error) return rpcErrorResponse();

  const baseResult = {
    attemptId,
    correctAnswers: recovered.score.correctAnswers,
    prizeEligible: award.claim !== null,
    status: 'completed' as const,
    totalQuestions: recovered.score.totalQuestions,
  };

  if (!award.claim) return NextResponse.json(baseResult);

  // Re-issue with the ORIGINAL expiry (award mint time + TTL), not a fresh 7
  // days, so replaying a days-old attempt cannot extend the redemption window.
  // If the original window has already passed, the token mints expired and the
  // orders route rejects it — the intended deadline still holds.
  if (!award.createdAt) return rpcErrorResponse();
  const awardCreatedAtMs = Date.parse(award.createdAt);
  if (!Number.isFinite(awardCreatedAtMs)) return rpcErrorResponse();
  const originalExpiresAtDate = new Date(
    awardCreatedAtMs + QUIZ_VOUCHER_TTL_MS
  );
  if (!Number.isFinite(originalExpiresAtDate.getTime())) {
    return rpcErrorResponse();
  }
  const originalExpiresAt = originalExpiresAtDate.toISOString();

  try {
    return NextResponse.json(
      addSignedPrizeClaim(
        { ...baseResult, prizeClaim: award.claim },
        userId,
        originalExpiresAt
      )
    );
  } catch (tokenError) {
    if (tokenError instanceof QuizVoucherTokenConfigError) {
      return voucherTokenConfigResponse();
    }
    throw tokenError;
  }
}
