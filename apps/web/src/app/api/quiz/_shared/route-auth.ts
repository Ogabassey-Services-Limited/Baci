import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getBearerTokenFromRequest,
  hasBearerAuthScheme,
} from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import type { ServerSupabaseClient } from './route-helpers-guards';

// Read-path auth and response helpers. Kept apart from route-helpers.ts so that
// read-only endpoints (e.g. the leaderboard GET) do not statically import the
// write-path proof/compliance machinery — which reaches the credential
// authority in env.ts. The event-pipeline boundary verifier fails any API route
// whose import graph reaches that credential authority, so this split is load-
// bearing, not cosmetic.

type RequireQuizUserResult =
  | {
      response: null;
      supabase: ServerSupabaseClient;
      user: User;
      authMethod: 'bearer' | 'cookie';
    }
  | {
      response: NextResponse;
      supabase: null;
      user: null;
    };

function getSafeAuthErrorFields(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { errorMessage: String(error) };
  }

  const fields: {
    errorCode?: string;
    errorMessage?: string;
    errorStatus?: number;
  } = {};
  if (
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    fields.errorMessage = (error as { message: string }).message;
  }
  if (
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    fields.errorCode = (error as { code: string }).code;
  }
  if (
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    fields.errorStatus = (error as { status: number }).status;
  }

  return fields;
}

function isMissingAuthSession(error: unknown) {
  const fields = getSafeAuthErrorFields(error);
  const errorMessage = fields.errorMessage?.toLowerCase() ?? '';
  const errorCode = fields.errorCode?.toLowerCase() ?? '';

  return (
    errorMessage.includes('auth session missing') ||
    errorMessage.includes('session missing') ||
    errorCode === 'session_not_found' ||
    errorCode === 'auth_session_missing' ||
    errorCode === 'no_authorization' ||
    (fields.errorStatus === 400 && errorMessage.includes('session'))
  );
}

export async function requireQuizUser(
  request?: NextRequest
): Promise<RequireQuizUserResult> {
  const hasBearerScheme = request ? hasBearerAuthScheme(request) : false;
  const bearerToken = request ? getBearerTokenFromRequest(request) : null;
  if (request && hasBearerScheme) {
    if (!bearerToken) {
      return {
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        supabase: null,
        user: null,
      };
    }

    const auth = await authenticateApiRequest(request);
    if (auth.user && auth.supabase) {
      return {
        authMethod: 'bearer',
        response: null,
        // authenticateApiRequest returns the real Supabase client; this local
        // structural type only narrows the quiz routes to the methods they use.
        supabase: auth.supabase as unknown as ServerSupabaseClient,
        user: auth.user,
      };
    }

    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase: null,
      user: null,
    };
  }

  const supabase = (await createClient()) as unknown as ServerSupabaseClient;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (isMissingAuthSession(error)) {
      return {
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        supabase: null,
        user: null,
      };
    }

    logger.error({
      message: 'Quiz auth lookup failed',
      ...getSafeAuthErrorFields(error),
    });
    return {
      // Supabase auth lookup errors are service failures, not bad credentials.
      response: NextResponse.json(
        { code: 'auth_unavailable', error: 'Authentication lookup failed' },
        { status: 503 }
      ),
      supabase: null,
      user: null,
    };
  }

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase: null,
      user: null,
    };
  }

  return { authMethod: 'cookie', response: null, supabase, user };
}

export function invalidInputResponse(details: unknown) {
  return NextResponse.json(
    { details, error: 'Invalid input' },
    { status: 400 }
  );
}

export function rpcErrorResponse() {
  return NextResponse.json({ error: 'Quiz request failed' }, { status: 500 });
}

function getQuizRpcErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  return 'code' in error && typeof error.code === 'string' ? error.code : null;
}

const QUIZ_RPC_CLIENT_ERRORS: Record<
  string,
  { code: string; error: string; status: number }
> = {
  QZ001: {
    code: 'QUIZ_CUSTOMER_NOT_FOUND',
    error: 'Quiz customer profile not found',
    status: 404,
  },
  QZ002: {
    code: 'QUIZ_EVENT_NOT_OPEN',
    error: 'Quiz event is not open',
    status: 409,
  },
  QZ003: {
    code: 'QUIZ_QUESTION_NOT_FOUND',
    error: 'Quiz has no available questions',
    status: 409,
  },
  QZ004: {
    code: 'QUIZ_ATTEMPT_NOT_READY',
    error: 'Quiz attempt is not ready for this action',
    status: 409,
  },
  QZ010: {
    code: 'QUIZ_ROUTE_PROOF_REQUIRED',
    error: 'Quiz request is not authorized',
    status: 403,
  },
  QZ020: {
    code: 'QUIZ_PRIZE_FINALIZATION_NOT_APPROVED',
    error: 'Quiz prize finalization is not approved',
    status: 403,
  },
  QZ021: {
    code: 'QUIZ_GRAND_PRIZE_CLAIM_NOT_APPROVED',
    error: 'Grand prize claim is not approved',
    status: 403,
  },
  QZ022: {
    code: 'QUIZ_CASH_AWARD_CLAIM_NOT_APPROVED',
    error: 'Cash award claim is not approved',
    status: 403,
  },
  QZ023: {
    code: 'QUIZ_GRAND_AWARD_NOT_CLAIMABLE',
    error: 'No approved grand prize is available to claim',
    status: 409,
  },
  QZ024: {
    code: 'QUIZ_CASH_AWARD_NOT_CLAIMABLE',
    error: 'No approved cash award is available to claim',
    status: 409,
  },
  QZ027: {
    code: 'QUIZ_QUESTION_NOT_ISSUED',
    error: 'Quiz question is not ready for answers',
    status: 409,
  },
  QZ028: {
    code: 'QUIZ_ANSWER_TOO_FAST',
    error: 'Quiz answer was submitted too quickly',
    status: 409,
  },
  QZ029: {
    code: 'QUIZ_ANSWER_TOO_LATE',
    error: 'Quiz answer was submitted after the question window',
    status: 409,
  },
  QZ030: {
    code: 'QUIZ_ATTEMPT_LIMIT_REACHED',
    error: "You've reached the maximum number of attempts for this quiz.",
    status: 409,
  },
  // Anti multi-accounting. Both caps count across ACCOUNTS, so the message must
  // not imply the player can simply sign up again — that is exactly what these
  // prevent. Deliberately vague about WHICH signal matched: naming it would tell
  // an abuser precisely what to rotate next.
  QZ040: {
    code: 'QUIZ_ATTEMPT_LIMIT_REACHED',
    error: "You've reached the maximum number of attempts for this quiz.",
    status: 409,
  },
  QZ041: {
    code: 'QUIZ_ATTEMPT_LIMIT_REACHED',
    error: "You've reached the maximum number of attempts for this quiz.",
    status: 409,
  },
  QZ031: {
    code: 'QUIZ_LEADERBOARD_NOT_AUTHORIZED',
    error: 'You are not authorized to view this leaderboard',
    status: 403,
  },
};

export function quizRpcClientErrorResponse(error: unknown) {
  const code = getQuizRpcErrorCode(error);
  if (!code) return null;

  const mapped = QUIZ_RPC_CLIENT_ERRORS[code];
  if (!mapped) return null;

  return NextResponse.json(
    { code: mapped.code, error: mapped.error },
    { status: mapped.status }
  );
}
