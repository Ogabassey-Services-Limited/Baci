import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  quizAttemptParamsSchema,
  submitQuizAnswerSchema,
} from '@/schemas/quiz';
import {
  createRouteProof,
  invalidInputResponse,
  parseJsonBody,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '../../../_shared/route-helpers';

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
