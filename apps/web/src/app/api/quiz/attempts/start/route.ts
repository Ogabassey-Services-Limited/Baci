import {
  QUIZ_DEVICE_START_RPC_ACTION,
  QUIZ_FREE_ENTRY_RPC_ACTION,
} from '@baci/shared/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { interpretQuizDeviceStartOutcome } from '@/app/api/quiz/_shared/quiz-device-start-outcome';
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
  rejectQuizIdentityMismatch,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-helpers';
import { readStalePaidStartCharge } from '@/app/api/quiz/_shared/stale-paid-start-charge';
import { getQuizPhaseEnv } from '@/env';
import { logger } from '@/lib/logger';
import {
  QUIZ_DEVICE_COOKIE,
  resolveQuizDevice,
} from '@/lib/quiz/quiz-device-hash';
import { buildQuizDeviceProofSubject } from '@/lib/quiz/quiz-device-proof-subject';
import { startQuizAttemptSchema } from '@/schemas/quiz';

const QUIZ_UNAVAILABLE_RESPONSE = {
  code: 'QUIZ_TEMPORARILY_UNAVAILABLE',
  error: 'Super Quiz is temporarily unavailable. Please try again soon.',
} as const;

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

  // Bind the start to the shopper the caller intended, before the start RPC
  // mutates anything — an account switch mid-request must not consume the new
  // shopper's attempt.
  const identityMismatch = rejectQuizIdentityMismatch(
    parsed.data.expectedUserId,
    auth.user.id
  );
  if (identityMismatch) return identityMismatch;

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
      if (auth.authMethod === 'bearer') {
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

  // This marker is created in the same migration transaction as the free-entry
  // start RPC. If code deploys before the database migration, the probe fails
  // before the stale paid-entry RPC can charge or create an attempt.
  const { data: freeEntryReady, error: freeEntryReadyError } =
    await auth.supabase.rpc('quiz_free_entry_ready');
  if (freeEntryReadyError || freeEntryReady !== true) {
    logger.error({
      error: freeEntryReadyError,
      event: 'quiz_free_entry_readiness',
      eventId: parsed.data.eventId,
      message:
        'Free-entry database marker is unavailable. Refusing to call start_quiz_attempt.',
      userId: auth.user.id,
    });
    return NextResponse.json(QUIZ_UNAVAILABLE_RESPONSE, { status: 503 });
  }

  // Resolve the device before starting so the database can create the attempt
  // and enforce the cross-account device cap in one transaction. No attempt is
  // visible to answer routes before this decision commits.
  let device: ReturnType<typeof resolveQuizDevice> = { deviceHash: null };
  try {
    const hasExistingWebDevice = Boolean(
      request.cookies?.get(QUIZ_DEVICE_COOKIE)?.value?.trim()
    );
    if (
      auth.authMethod !== 'bearer' ||
      parsed.data.deviceFingerprint ||
      hasExistingWebDevice
    ) {
      device = resolveQuizDevice(
        request,
        auth.authMethod === 'bearer' ? parsed.data.deviceFingerprint : undefined
      );
    }
  } catch (error) {
    logger.error({
      error,
      event: 'quiz_device_resolution',
      eventId: parsed.data.eventId,
      message:
        'Device identification failed; continuing without device binding',
      userId: auth.user.id,
    });
  }

  const withDeviceCookie = (response: NextResponse): NextResponse => {
    if (device.cookieToSet) {
      response.cookies.set(device.cookieToSet);
    }
    return response;
  };

  const { data: deviceCapReady, error: deviceCapReadyError } =
    await auth.supabase.rpc('quiz_device_cap_ready');
  if (deviceCapReadyError || deviceCapReady !== true) {
    logger.error({
      error: deviceCapReadyError,
      event: 'quiz_device_cap_readiness',
      eventId: parsed.data.eventId,
      message: 'Device-cap database marker is unavailable',
      userId: auth.user.id,
    });
    return withDeviceCookie(
      NextResponse.json(QUIZ_UNAVAILABLE_RESPONSE, { status: 503 })
    );
  }

  const { proof, response: proofResponse } = createRouteProof({
    action: QUIZ_FREE_ENTRY_RPC_ACTION,
    payload: {
      event_id: parsed.data.eventId,
      integrity_tier: parsed.data.integrityTier,
      user_id: auth.user.id,
    },
    subjectId: parsed.data.eventId,
    userId: auth.user.id,
  });
  if (proofResponse) return withDeviceCookie(proofResponse);

  let deviceProof: unknown;
  if (device.deviceHash) {
    const proofResult = createRouteProof({
      action: QUIZ_DEVICE_START_RPC_ACTION,
      payload: {
        device_hash: device.deviceHash,
        event_id: parsed.data.eventId,
        user_id: auth.user.id,
      },
      subjectId: buildQuizDeviceProofSubject(
        parsed.data.eventId,
        device.deviceHash
      ),
      userId: auth.user.id,
    });
    if (proofResult.response) {
      return withDeviceCookie(proofResult.response);
    }
    deviceProof = proofResult.proof;
  }

  const { data, error } = device.deviceHash
    ? await auth.supabase.rpc('start_quiz_attempt_with_device', {
        p_device_hash: device.deviceHash,
        p_device_route_proof: deviceProof,
        p_event_id: parsed.data.eventId,
        p_integrity_tier: parsed.data.integrityTier,
        p_start_route_proof: proof,
        p_user_id: auth.user.id,
      })
    : await auth.supabase.rpc('start_quiz_attempt', {
        p_event_id: parsed.data.eventId,
        p_integrity_tier: parsed.data.integrityTier,
        p_route_proof: proof,
        p_user_id: auth.user.id,
      });

  if (error) {
    // Entry is free, so start_quiz_attempt can no longer raise QZ011. If it
    // DOES, this build is talking to a database that has not applied
    // 20260714102000_quiz_free_entry.sql yet — i.e. the PAID entry RPC is still
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
      return withDeviceCookie(
        NextResponse.json(QUIZ_UNAVAILABLE_RESPONSE, { status: 503 })
      );
    }

    const clientErrorResponse = quizRpcClientErrorResponse(error);
    if (clientErrorResponse) return withDeviceCookie(clientErrorResponse);

    logger.error({
      error,
      event: 'start_quiz_attempt',
      eventId: parsed.data.eventId,
      message: 'start_quiz_attempt RPC failed',
      userId: auth.user.id,
    });
    return withDeviceCookie(rpcErrorResponse());
  }

  const { deviceAllowed, deviceBindingFailed, startData } =
    interpretQuizDeviceStartOutcome(data, Boolean(device.deviceHash));

  if (deviceBindingFailed === true) {
    logger.error({
      event: 'start_quiz_attempt_with_device',
      eventId: parsed.data.eventId,
      message: 'Device-cap binding failed inside quiz start; continuing',
      userId: auth.user.id,
    });
  }

  if (deviceAllowed === false) {
    const deviceLimitResponse = quizRpcClientErrorResponse({
      code: 'QZ041',
      message: 'quiz_device_attempt_limit',
    });
    if (deviceLimitResponse) return withDeviceCookie(deviceLimitResponse);
    logger.error({
      event: 'start_quiz_attempt_with_device',
      eventId: parsed.data.eventId,
      message:
        'Device cap rejected an attempt without a mapped client response',
      userId: auth.user.id,
    });
    return withDeviceCookie(rpcErrorResponse());
  }

  // Defense in depth: the readiness marker and free-entry function are installed
  // atomically, so this should be unreachable. The RPC mutation has committed,
  // therefore report the real receipt instead of returning a retryable failure
  // that would hide the consumed attempt and any unexpected charge.
  const staleCharge = readStalePaidStartCharge(startData);
  if (staleCharge) {
    logger.error({
      attemptId: staleCharge.attemptId,
      event: 'start_quiz_attempt',
      eventId: parsed.data.eventId,
      message:
        'start_quiz_attempt returned a nonzero examPassPointsSpent despite the free-entry readiness marker. Refusing the drifted response.',
      pointsSpent: staleCharge.pointsSpent,
      userId: auth.user.id,
    });
  }

  const deadlineResult = await attachQuizQuestionDeadline(
    auth.supabase,
    startData
  );
  if (deadlineResult.response) {
    return withDeviceCookie(deadlineResult.response);
  }

  return withDeviceCookie(NextResponse.json(deadlineResult.data));
}
