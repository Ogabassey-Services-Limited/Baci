import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createRouteProof,
  enforceEventPrizeGuard,
  enforceQuizAgeGate,
  invalidInputResponse,
  isQuizAgeGateError,
  parseJsonBody,
  prizeGuardErrorResponse,
  quizAgeGateErrorResponse,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-helpers';
import { getQuizPhaseEnv } from '@/env';
import { logger } from '@/lib/logger';
import { startQuizAttemptSchema } from '@/schemas/quiz';

function isExamPassRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : null;
  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : null;

  return code === 'QZ011' || message === 'quiz_exam_pass_required';
}

function formatLoyaltyPointCount(points: number): string {
  return `${points} loyalty ${points === 1 ? 'point' : 'points'}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireQuizUser(request);
  if (auth.response) return auth.response;

  const csrfResponse = await requireQuizCsrf(request);
  if (csrfResponse) return csrfResponse;

  const { body, response } = await parseJsonBody(request);
  if (response) return response;

  const parsed = startQuizAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return invalidInputResponse(parsed.error.flatten().fieldErrors);
  }

  if (getQuizPhaseEnv() === 'production') {
    try {
      const { merchantId } = await enforceEventPrizeGuard(
        auth.supabase,
        parsed.data.eventId
      );
      await enforceQuizAgeGate(auth.supabase, merchantId, auth.user.id);
    } catch (error) {
      if (isQuizAgeGateError(error)) {
        return quizAgeGateErrorResponse(error);
      }
      return prizeGuardErrorResponse(error);
    }
  }

  const { proof, response: proofResponse } = createRouteProof({
    action: 'start_quiz_attempt',
    payload: {
      event_id: parsed.data.eventId,
      integrity_tier: parsed.data.integrityTier,
      user_id: auth.user.id,
    },
    subjectId: parsed.data.eventId,
    userId: auth.user.id,
  });
  if (proofResponse) return proofResponse;

  const { data, error } = await auth.supabase.rpc('start_quiz_attempt', {
    p_event_id: parsed.data.eventId,
    p_integrity_tier: parsed.data.integrityTier,
    p_route_proof: proof,
    p_user_id: auth.user.id,
  });

  if (error) {
    if (isExamPassRequiredError(error)) {
      return NextResponse.json(
        {
          code: 'QUIZ_EXAM_PASS_REQUIRED',
          error: `You need ${formatLoyaltyPointCount(EXAM_PASS_POINTS_COST)} to start this exam`,
        },
        { status: 409 }
      );
    }

    logger.error({
      error,
      event: 'start_quiz_attempt',
      eventId: parsed.data.eventId,
      message: 'start_quiz_attempt RPC failed',
      userId: auth.user.id,
    });
    return rpcErrorResponse();
  }

  return NextResponse.json(data);
}
