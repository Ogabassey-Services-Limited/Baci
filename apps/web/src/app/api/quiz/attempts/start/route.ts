import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { attachQuizQuestionDeadline } from '@/app/api/quiz/_shared/quiz-question-deadline';
import {
  createRouteProof,
  enforceEventPrizeGuard,
  enforceQuizAgeGate,
  enforceQuizUsernameGate,
  invalidInputResponse,
  isQuizAgeGateError,
  isQuizUsernameRequiredError,
  parseJsonBody,
  prizeGuardErrorResponse,
  quizAgeGateErrorResponse,
  quizRpcClientErrorResponse,
  quizUsernameGateErrorResponse,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-helpers';
import { getQuizPhaseEnv } from '@/env';
import { getBearerTokenFromRequest } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { startQuizAttemptSchema } from '@/schemas/quiz';

function isBearerAuthenticated(request: NextRequest): boolean {
  // Use the SAME bearer detection as the auth (getBearerTokenFromRequest) and
  // CSRF (checkCsrfProtection) paths — both accept the scheme case-insensitively
  // and tolerate leading whitespace. A stricter `startsWith('Bearer ')` check
  // here would let a request that authenticated as bearer (e.g. lowercase
  // `authorization: bearer <token>`) slip past the username gate and create a
  // leaderboard-bound attempt without a username, defeating the invariant.
  return getBearerTokenFromRequest(request) !== null;
}

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
      // The username is required for the leaderboard, but only the mobile
      // storefront (which authenticates with a Bearer token) has a
      // username-collection UI today. Web storefront customers have no way to
      // set one yet, so enforcing here would hard-block them with no
      // remediation. Scope the gate to the clients that can actually satisfy
      // it — bearer-authenticated mobile requests — until a web username flow
      // exists. Mobile has no cookie session, so it cannot skip the gate by
      // dropping the Bearer token (that path is unauthenticated → 401).
      if (isBearerAuthenticated(request)) {
        await enforceQuizUsernameGate(auth.supabase, merchantId, auth.user.id);
      }
    } catch (error) {
      if (isQuizAgeGateError(error)) {
        return quizAgeGateErrorResponse(error);
      }
      if (isQuizUsernameRequiredError(error)) {
        return quizUsernameGateErrorResponse(error);
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

    const clientErrorResponse = quizRpcClientErrorResponse(error);
    if (clientErrorResponse) return clientErrorResponse;

    logger.error({
      error,
      event: 'start_quiz_attempt',
      eventId: parsed.data.eventId,
      message: 'start_quiz_attempt RPC failed',
      userId: auth.user.id,
    });
    return rpcErrorResponse();
  }

  const deadlineResult = await attachQuizQuestionDeadline(auth.supabase, data);
  if (deadlineResult.response) return deadlineResult.response;

  return NextResponse.json(deadlineResult.data);
}
