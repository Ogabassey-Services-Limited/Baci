import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { QuizProductionNotApprovedError } from '@/lib/quiz-compliance-gate';
import {
  createQuizRpcServerProof,
  QuizRpcServerConfigError,
} from '@/lib/quiz-proof';
import { createClient } from '@/lib/supabase/server';
import type { ServerSupabaseClient } from './route-helpers-guards';

export {
  enforceCashAwardPrizeGuard,
  enforceEventPrizeGuard,
} from './route-helpers-guards';

type RequireQuizUserResult =
  | {
      response: null;
      supabase: ServerSupabaseClient;
      user: User;
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

export async function requireQuizUser(
  request?: NextRequest
): Promise<RequireQuizUserResult> {
  const authHeader = request?.headers?.get('Authorization');
  if (request && authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiRequest(request);
    if (auth.user && auth.supabase) {
      return {
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
    logger.error({
      message: 'Quiz auth lookup failed',
      ...getSafeAuthErrorFields(error),
    });
  }

  if (error || !user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase: null,
      user: null,
    };
  }

  return { response: null, supabase, user };
}

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

export function invalidInputResponse(details: unknown) {
  return NextResponse.json(
    { details, error: 'Invalid input' },
    { status: 400 }
  );
}

export function rpcErrorResponse() {
  return NextResponse.json({ error: 'Quiz request failed' }, { status: 500 });
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
            error: 'quiz_route_proof_unavailable',
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
