import { NextResponse } from 'next/server';
import { logOnboardingFailure } from './onboarding-failure-log';

/**
 * Builds the failure response for POST /api/mobile-onboarding.
 *
 * Signup is not atomic: the auth user is created first, then the merchant row.
 * When a step fails after the account exists, a bare "Internal Server Error" is
 * a dead end — retrying re-runs the same failing path, and once the signup
 * session is cached the server skips signUp entirely so the caller never even
 * reaches the "account exists" 409. The response has to say the account exists
 * so the client can route to sign-in instead.
 *
 * Logging lives in ./onboarding-failure-log so failures that are repaired in
 * the background can share the same format without returning a response.
 */

const ACCOUNT_CREATED_MESSAGE =
  'Your account was created, but we could not finish setting up your store. Please sign in to finish setup.';

export interface OnboardingFailureContext {
  /**
   * True when the caller owns an auth account but the client holds no
   * session — either this request created it, or a cached signup cookie
   * authenticated a retry. Determines whether signing in is the recovery.
   */
  accountExists: boolean;
  /**
   * Specific message for the non-recoverable case (no account was created).
   * Ignored when `accountExists` — an existing account always gets the
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
  { accountExists, message }: OnboardingFailureContext
): NextResponse {
  logOnboardingFailure(error, { accountExists });

  if (accountExists) {
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
