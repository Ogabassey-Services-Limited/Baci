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
import { readStalePaidStartCharge } from '@/app/api/quiz/_shared/stale-paid-start-charge';
import { voidStalePaidQuizStart } from '@/app/api/quiz/_shared/void-stale-paid-quiz-start';
import { getQuizPhaseEnv } from '@/env';
import { getBearerTokenFromRequest } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { startQuizAttemptSchema } from '@/schemas/quiz';

const QUIZ_UNAVAILABLE_RESPONSE = {
  code: 'QUIZ_TEMPORARILY_UNAVAILABLE',
  error: 'Super Quiz is temporarily unavailable. Please try again soon.',
} as const;

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
    // Entry is free, so start_quiz_attempt can no longer raise QZ011. If it
    // DOES, this build is talking to a database that has not applied
    // 20260713180000_quiz_free_entry.sql yet — i.e. the PAID entry RPC is still
    // live and would charge a loyalty point.
    //
    // Fail closed. Do not fall through and do not tell the player to go and get
    // loyalty points: points are only earned by purchasing, so that message
    // re-sells the exact purchase gate this feature removed, and any attempt
    // started here would be charged. Refuse until the migration has landed.
    if (isExamPassRequiredError(error)) {
      logger.error({
        error,
        event: 'start_quiz_attempt',
        eventId: parsed.data.eventId,
        message:
          'QZ011 from start_quiz_attempt: the paid-entry RPC is still live (free-entry migration not applied). Refusing to start a charged attempt.',
        userId: auth.user.id,
      });
      return NextResponse.json(QUIZ_UNAVAILABLE_RESPONSE, { status: 503 });
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

  // A QZ011 guard alone does NOT cover a stale paid RPC. The old
  // start_quiz_attempt raised QZ011 only when the player held fewer points than
  // the cost — players who DID hold a point were charged and the call
  // SUCCEEDED. So a *successful* start that reports a nonzero
  // examPassPointsSpent is the paid RPC silently debiting exactly the players
  // free entry is meant to protect. Undo the charge and fail closed.
  const staleCharge = readStalePaidStartCharge(data);
  if (staleCharge) {
    const compensation = await voidStalePaidQuizStart(staleCharge);

    logger.error({
      attemptId: staleCharge.attemptId,
      event: 'start_quiz_attempt',
      eventId: parsed.data.eventId,
      message:
        'start_quiz_attempt returned a nonzero examPassPointsSpent: the paid-entry RPC is still live (free-entry migration not applied). Charge refunded and attempt voided; refusing to serve a charged attempt.',
      pointsSpent: staleCharge.pointsSpent,
      refunded: compensation.refunded,
      userId: auth.user.id,
      voided: compensation.voided,
    });

    return NextResponse.json(QUIZ_UNAVAILABLE_RESPONSE, { status: 503 });
  }

  const deadlineResult = await attachQuizQuestionDeadline(auth.supabase, data);
  if (deadlineResult.response) return deadlineResult.response;

  return NextResponse.json(deadlineResult.data);
}
