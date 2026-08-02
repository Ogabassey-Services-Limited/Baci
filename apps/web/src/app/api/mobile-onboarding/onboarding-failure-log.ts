/**
 * Structured logging for mobile-onboarding failures.
 *
 * Split from the response builder because some failures are logged WITHOUT
 * failing the request (domain provisioning is repaired in the background), so
 * the log format and the alert label must not be tied to returning a response.
 *
 * A PostgrestError extends Error but carries `code`/`details`/`hint` as own
 * properties, so `instanceof Error` handling alone silently drops the Postgres
 * code — which is exactly what made the 2026-07-22 signup outage look like
 * generic 500 noise for three days.
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

/**
 * Error messages are developer-authored text and are the point of this log, so
 * they are kept — but bounded, so a pathological message cannot flood the
 * drain. This is deliberately NOT the same treatment as Postgres DETAIL, which
 * is dropped entirely because it mechanically embeds the offending ROW.
 */
const MAX_LOGGED_MESSAGE_LENGTH = 300;

function boundMessage(message: string): string {
  return message.length > MAX_LOGGED_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_LOGGED_MESSAGE_LENGTH)}…[truncated]`
    : message;
}

interface PostgresErrorShape {
  code?: string;
  hint?: string;
  message?: string;
}

function readPostgresErrorShape(error: unknown): PostgresErrorShape {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  const candidate = error as Record<string, unknown>;
  const read = (key: string): string | undefined =>
    typeof candidate[key] === 'string' ? (candidate[key] as string) : undefined;

  // `details` is deliberately NOT read. Postgres puts the offending row in
  // DETAIL for not-null/check/unique violations ("Failing row contains (...)"),
  // which on this route would write the signing-up user's email and profile
  // values into the log. `code` carries the diagnosis anyway.
  return {
    code: read('code'),
    hint: read('hint'),
    message: read('message'),
  };
}

export interface OnboardingFailureLogContext {
  /** True when the caller owns an account but the client holds no session. */
  accountExists?: boolean;
  /** Which provisioning step failed, when it is not the generic catch-all. */
  stage?: string;
  /** Versioned route contract only; never user, merchant, or business data. */
  contract?: 'v1_legacy' | 'v2_authenticated';
}

/**
 * Emits one greppable line per failure. The label is stable so a log drain can
 * alert on `mobile-onboarding deployment_fault` without parsing the payload.
 */
export function logOnboardingFailure(
  error: unknown,
  context: OnboardingFailureLogContext = {}
): void {
  const pg = readPostgresErrorShape(error);
  const kind =
    pg.code && DEPLOYMENT_FAULT_CODES.has(pg.code)
      ? 'deployment_fault'
      : 'unexpected_error';

  console.error(
    'mobile-onboarding %s',
    kind,
    JSON.stringify({
      ...context,
      name: error instanceof Error ? error.name : typeof error,
      message: boundMessage(
        pg.message ?? (error instanceof Error ? error.message : String(error))
      ),
      pgCode: pg.code,
      pgHint: pg.hint,
      stack:
        error instanceof Error && error.stack
          ? boundMessage(error.stack.split('\n').slice(0, 3).join(' | '))
          : undefined,
    })
  );
}
