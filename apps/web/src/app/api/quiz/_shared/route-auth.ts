import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getBearerTokenFromRequest,
  hasBearerAuthScheme,
} from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { mapQuizRpcClientError } from './quiz-rpc-client-errors';
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

export function quizRpcClientErrorResponse(error: unknown) {
  const mapped = mapQuizRpcClientError(error);
  if (!mapped) return null;

  return NextResponse.json(
    { code: mapped.code, error: mapped.error },
    { status: mapped.status }
  );
}
