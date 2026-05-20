import { type NextRequest, NextResponse } from 'next/server';
import {
  createRouteProof,
  invalidInputResponse,
  parseJsonBody,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-helpers';
import { logger } from '@/lib/logger';
import {
  quizAttemptParamsSchema,
  submitQuizAnswerSchema,
} from '@/schemas/quiz';

type SubmittedAttemptResult = {
  attemptId: string;
  correctAnswers: number;
  prizeEligible: false;
  status: 'completed';
  totalQuestions: number;
};

function getRpcErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function isReplayStateError(error: unknown) {
  return getRpcErrorCode(error) === 'QZ004';
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

function mapSubmittedAttemptResult(
  attemptId: string,
  row: unknown
): SubmittedAttemptResult | null {
  if (!row || typeof row !== 'object' || !('status' in row)) return null;
  if ((row as { status?: unknown }).status !== 'submitted') return null;

  const questions = getQuestionRows(row);
  if (questions.length === 0) return null;

  return {
    attemptId,
    correctAnswers: questions.reduce<number>(
      (score, question) => score + getQuestionScore(question),
      0
    ),
    prizeEligible: false,
    status: 'completed',
    totalQuestions: questions.length,
  };
}

async function getSubmittedAttemptResult(
  supabase: Awaited<ReturnType<typeof requireQuizUser>>['supabase'],
  attemptId: string,
  userId: string
): Promise<{ error: unknown; result: SubmittedAttemptResult | null }> {
  if (!supabase) return { error: null, result: null };

  const { data, error } = await supabase
    .from('quiz_attempts')
    .select(
      'id, status, quiz_attempt_questions(id, quiz_attempt_answers(score_delta))'
    )
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { error, result: null };
  return { error: null, result: mapSubmittedAttemptResult(attemptId, data) };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const auth = await requireQuizUser(request);
  if (auth.response) return auth.response;

  const csrfResponse = await requireQuizCsrf(request);
  if (csrfResponse) return csrfResponse;

  const params = quizAttemptParamsSchema.safeParse(await context.params);
  if (!params.success) {
    return invalidInputResponse(params.error.flatten().fieldErrors);
  }

  const { body, response } = await parseJsonBody(request);
  if (response) return response;

  const parsed = submitQuizAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return invalidInputResponse(parsed.error.flatten().fieldErrors);
  }

  const { proof, response: proofResponse } = createRouteProof({
    action: 'submit_quiz_answer',
    payload: {
      answer: parsed.data.answer,
      attempt_id: params.data.attemptId,
      question_id: parsed.data.questionId,
      user_id: auth.user.id,
    },
    subjectId: `${params.data.attemptId}:${parsed.data.questionId}`,
    userId: auth.user.id,
  });
  if (proofResponse) return proofResponse;

  const { data, error } = await auth.supabase.rpc('submit_quiz_answer', {
    p_answer: parsed.data.answer,
    p_attempt_id: params.data.attemptId,
    p_client_answered_at: parsed.data.clientAnsweredAt,
    p_integrity_tier: parsed.data.integrityTier,
    p_question_id: parsed.data.questionId,
    p_route_proof: proof,
    p_user_id: auth.user.id,
  });

  if (error) {
    if (isReplayStateError(error)) {
      const recovered = await getSubmittedAttemptResult(
        auth.supabase,
        params.data.attemptId,
        auth.user.id
      );
      if (recovered.error) return rpcErrorResponse();
      if (recovered.result) return NextResponse.json(recovered.result);

      return NextResponse.json(
        {
          code: 'quiz_attempt_not_answerable',
          error: 'Quiz answer is no longer accepted for this attempt',
        },
        { status: 409 }
      );
    }

    logger.error({
      attemptId: params.data.attemptId,
      error,
      event: 'submit_quiz_answer',
      message: 'submit_quiz_answer RPC failed',
      questionId: parsed.data.questionId,
      userId: auth.user.id,
    });
    return rpcErrorResponse();
  }

  return NextResponse.json(data);
}
