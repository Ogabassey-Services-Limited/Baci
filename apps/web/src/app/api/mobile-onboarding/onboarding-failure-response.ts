import { NextResponse } from 'next/server';

/**
 * Builds the failure response for POST /api/mobile-onboarding.
 *
 * Two problems this exists to solve, both found during the 2026-07-22..07-25
 * mobile signup outage:
 *
 *  1. OBSERVABILITY. The route used to collapse every unexpected throw into
 *     `{ error: 'Internal Server Error' }` and log only name/message/stack. A
 *     PostgrestError carries its Postgres `code` on the object, not in the
 *     stack, so the single most diagnostic field (42501 — the RLS policy
 *     rejecting the merchant INSERT) was dropped. A total outage looked like
 *     generic 500 noise for three days.
 *
 *  2. RECOVERY. Signup is not atomic: the auth user is created first, then the
 *     merchant row. When step two fails, the caller is left with an account and
 *     no store, and a bare "Internal Server Error" is a dead end — retrying
 *     re-runs the same failing path. The response has to say the account
 *     exists so the client can route to sign-in instead.
 */

/**
 * Postgres codes that mean the DEPLOYMENT is wrong — a policy, grant, or schema
 * mismatch — not anything about this particular request. They fail every caller
 * identically, so they deserve to be alertable on the first occurrence rather
 * than blending into ordinary 500s.
 */
const DEPLOYMENT_FAULT_CODES = new Set([
  '42501', // insufficient_privilege — RLS policy or missing grant
  '42P17', // invalid_object_definition — infinite recursion in a policy
  '42P01', // undefined_table
  '42703', // undefined_column
  '42883', // undefined_function — a missing RPC
]);

const ACCOUNT_CREATED_MESSAGE =
  'Your account was created, but we could not finish setting up your store. Please sign in to finish setup.';

interface PostgresErrorShape {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

function readPostgresErrorShape(error: unknown): PostgresErrorShape {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  // PostgrestError extends Error but carries code/details/hint as own
  // properties, so `instanceof Error` alone would discard all of them.
  const candidate = error as Record<string, unknown>;
  const read = (key: string): string | undefined =>
    typeof candidate[key] === 'string' ? (candidate[key] as string) : undefined;

  return {
    code: read('code'),
    details: read('details'),
    hint: read('hint'),
    message: read('message'),
  };
}

export interface OnboardingFailureContext {
  /**
   * True when THIS request created the auth user (the signUp path ran and
   * succeeded). Determines whether the caller can recover by signing in.
   */
  accountCreated: boolean;
  /**
   * Specific message for the non-recoverable case (no account was created).
   * Ignored when `accountCreated` — an existing account always gets the
   * recovery copy, which is the actionable thing to say.
   */
  message?: string;
}

/**
 * Logs the failure with its Postgres code intact and returns the client
 * response. Never puts a database message, detail, or hint in the response —
 * those are for the server log only.
 */
export function buildOnboardingFailureResponse(
  error: unknown,
  { accountCreated, message }: OnboardingFailureContext
): NextResponse {
  const pg = readPostgresErrorShape(error);
  const isDeploymentFault = pg.code
    ? DEPLOYMENT_FAULT_CODES.has(pg.code)
    : false;

  // Stable, greppable prefixes so a log drain can alert on
  // `mobile-onboarding deployment_fault` without parsing the payload.
  const kind = isDeploymentFault ? 'deployment_fault' : 'unexpected_error';

  console.error(
    `mobile-onboarding ${kind}`,
    JSON.stringify({
      accountCreated,
      name: error instanceof Error ? error.name : typeof error,
      message:
        pg.message ?? (error instanceof Error ? error.message : String(error)),
      pgCode: pg.code,
      // pg.details is deliberately NOT logged. Postgres puts the offending row
      // in DETAIL for not-null/check/unique violations ("Failing row contains
      // (...)"), which on this route would write the signing-up user's email
      // and profile values into the log. `code` carries the diagnosis anyway.
      pgHint: pg.hint,
      stack:
        error instanceof Error
          ? error.stack?.split('\n').slice(0, 3).join(' | ')
          : undefined,
    })
  );

  if (accountCreated) {
    return NextResponse.json(
      {
        error: ACCOUNT_CREATED_MESSAGE,
        code: 'account_created_store_setup_failed',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: message ?? 'Internal Server Error', code: 'onboarding_failed' },
    { status: 500 }
  );
}
