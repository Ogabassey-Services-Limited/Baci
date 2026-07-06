import { type NextRequest, NextResponse } from 'next/server';
import {
  createRouteProof,
  invalidInputResponse,
  parseJsonBody,
  quizRpcClientErrorResponse,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-helpers';
import { logger } from '@/lib/logger';
import { QuizVoucherTokenConfigError } from '@/lib/quiz-voucher-token';
import {
  quizAttemptParamsSchema,
  submitQuizAnswerSchema,
} from '@/schemas/quiz';
import {
  addSignedPrizeClaim,
  isReplayStateError,
  recoverReplayedAttemptResponse,
  voucherTokenConfigResponse,
} from './submit-answer-helpers';

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
      return recoverReplayedAttemptResponse(
        auth.supabase,
        params.data.attemptId,
        auth.user.id
      );
    }

    const clientErrorResponse = quizRpcClientErrorResponse(error);
    if (clientErrorResponse) return clientErrorResponse;

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

  try {
    return NextResponse.json(addSignedPrizeClaim(data, auth.user.id));
  } catch (error) {
    if (error instanceof QuizVoucherTokenConfigError) {
      return voucherTokenConfigResponse();
    }
    throw error;
  }
}
