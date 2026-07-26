import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { QuizProductionNotApprovedError } from '@/lib/quiz-compliance-gate';
import {
  createQuizRpcServerProof,
  QuizRpcServerConfigError,
} from '@/lib/quiz-proof';
import { QUIZ_AGE_RESTRICTED_MESSAGE } from '@/schemas/quiz-age-gate-message';
import {
  QuizAgeGateError,
  QuizUsernameRequiredError,
} from './route-helpers-guards';

// Read-path auth and error-shape helpers live in route-auth.ts so that
// read-only routes can import them without dragging the write-path proof and
// compliance modules (which reach the env.ts credential authority) into their
// import graph. Re-exported here for the write routes that already depend on
// this module.
export {
  invalidInputResponse,
  quizRpcClientErrorResponse,
  requireQuizUser,
  rpcErrorResponse,
} from './route-auth';
export {
  enforceCashAwardPrizeGuard,
  enforceEventPrizeGuard,
  enforceQuizAgeGate,
  enforceQuizUsernameGate,
} from './route-helpers-guards';

export async function requireQuizCsrf(request: NextRequest) {
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  return null;
}

/**
 * Binds a quiz mutation to the shopper the caller intended. Cookies are ambient
 * (and a CSRF re-init/retry can pause the request), so an account switch could
 * otherwise act under the new shopper's session. Returns a 409 when the pinned
 * `expectedUserId` no longer matches the authenticated user, else null.
 */
export function rejectQuizIdentityMismatch(
  expectedUserId: string | undefined,
  userId: string
) {
  if (expectedUserId !== undefined && expectedUserId !== userId) {
    return NextResponse.json(
      {
        code: 'session_changed',
        error: 'Your session changed. Please try again.',
      },
      { status: 409 }
    );
  }

  return null;
}

type ParseJsonBodyResult =
  | { body: unknown; response: null }
  | { body: null; response: NextResponse };

export async function parseJsonBody(
  request: Request
): Promise<ParseJsonBodyResult> {
  try {
    const body: unknown = await request.json();
    return { body, response: null };
  } catch {
    return {
      body: null,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}

export function prizeGuardErrorResponse(error: unknown) {
  if (error instanceof QuizProductionNotApprovedError) {
    return NextResponse.json(
      {
        code: error.code,
        error: 'Quiz prizes are not approved for production use',
      },
      { status: error.status }
    );
  }

  throw error;
}

export function isQuizAgeGateError(error: unknown): error is QuizAgeGateError {
  return error instanceof QuizAgeGateError;
}

export function quizAgeGateErrorResponse(error: unknown) {
  if (isQuizAgeGateError(error)) {
    return NextResponse.json(
      {
        code: error.code,
        error: QUIZ_AGE_RESTRICTED_MESSAGE,
      },
      { status: error.status }
    );
  }

  throw error;
}

export function isQuizUsernameRequiredError(
  error: unknown
): error is QuizUsernameRequiredError {
  return error instanceof QuizUsernameRequiredError;
}

export function quizUsernameGateErrorResponse(error: unknown) {
  if (isQuizUsernameRequiredError(error)) {
    return NextResponse.json(
      {
        code: error.code,
        error: 'Choose a username before starting the quiz',
      },
      { status: error.status }
    );
  }

  throw error;
}

type CreateRouteProofResult =
  | {
      proof: ReturnType<typeof createQuizRpcServerProof>;
      response: null;
    }
  | {
      proof: null;
      response: NextResponse;
    };

export function createRouteProof({
  action,
  payload,
  subjectId,
  userId,
}: {
  action: string;
  payload: Record<string, unknown>;
  subjectId: string;
  userId: string;
}): CreateRouteProofResult {
  try {
    const proof = createQuizRpcServerProof({
      action,
      payload,
      subjectId,
      userId,
    });
    return {
      proof,
      response: null,
    };
  } catch (error) {
    if (error instanceof QuizRpcServerConfigError) {
      logger.error({ message: 'Quiz route proof configuration failed', error });
      return {
        proof: null,
        response: NextResponse.json(
          {
            code: 'quiz_route_proof_unavailable',
            error: 'Quiz is temporarily unavailable. Please try again later.',
          },
          { status: 500 }
        ),
      };
    }

    if (process.env.NODE_ENV === 'development') {
      throw error;
    }

    // Production fails closed for malformed proof payloads without exposing
    // proof-generation internals to the client.
    logger.warn({ message: 'Quiz route proof validation failed', error });

    return {
      proof: null,
      response: NextResponse.json(
        {
          code: 'invalid_quiz_rpc_request',
          error: 'invalid_quiz_rpc_request',
        },
        { status: 403 }
      ),
    };
  }
}
