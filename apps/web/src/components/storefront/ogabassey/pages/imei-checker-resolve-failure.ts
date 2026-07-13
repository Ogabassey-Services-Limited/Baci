/**
 * Translates an IMEI-check API failure (HTTP status + JSON payload) into
 * user-facing outcome flags. Ported verbatim from the mobile checker
 * (apps/mobile-storefront/components/imei-check/resolve-imei-check-failure.ts)
 * — same backend contract, same status/code pairs. `errorMessage: null` on the
 * 401/402 branches mirrors mobile (which renders dedicated login/wallet UI for
 * those cases); the web caller supplies its own copy for those two branches
 * since the storefront has no wallet top-up route today.
 */

const UNRESOLVED_IMEI_RESPONSE_CODES = new Set([
  'DEBIT_FAILURE_STATE_SAVE_FAILED',
  'IDEMPOTENT_REQUEST_IN_FLIGHT',
  'LOOKUP_RESULT_SAVE_FAILED',
  'REFUND_PENDING',
  'REFUND_STATE_SAVE_FAILED',
  'REFUNDED_STATE_SAVE_FAILED',
]);

export const DEFAULT_IMEI_CHECK_ERROR_MESSAGE =
  'Unable to check IMEI. Please try again.';

export interface ResolveImeiCheckFailureInput {
  currentTierPrice: number;
  payload: unknown;
  responseStatus: number;
  walletBalance: number;
}

export interface ResolveImeiCheckFailureOutcome {
  errorMessage: string | null;
  shouldClearIdempotencyKey: boolean;
  shouldPreserveIdempotencyKey: boolean;
  shouldRefetchWallet: boolean;
  shouldRedirectToLogin: boolean;
  topUpAmount: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, unknown>;
}

function getNumericFallback(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCode(payload: Record<string, unknown>): string | null {
  return typeof payload.code === 'string' ? payload.code : null;
}

function getErrorMessage(payload: Record<string, unknown>): string | null {
  return typeof payload.error === 'string' ? payload.error : null;
}

function shouldClearImeiIdempotencyKey(
  responseStatus: number,
  code: string | null,
  shouldPreserveIdempotencyKey: boolean
): boolean {
  if (shouldPreserveIdempotencyKey) {
    return false;
  }

  return (
    [200, 402, 404].includes(responseStatus) ||
    (responseStatus === 502 && code !== 'REFUND_PENDING')
  );
}

export function resolveImeiCheckFailure(
  input: ResolveImeiCheckFailureInput
): ResolveImeiCheckFailureOutcome {
  const payload = asRecord(input.payload);
  const code = getCode(payload);
  const errorMessage = getErrorMessage(payload);
  const shouldPreserveIdempotencyKey =
    code !== null && UNRESOLVED_IMEI_RESPONSE_CODES.has(code);
  const shouldClearIdempotencyKey = shouldClearImeiIdempotencyKey(
    input.responseStatus,
    code,
    shouldPreserveIdempotencyKey
  );

  if (input.responseStatus === 401) {
    return {
      errorMessage: null,
      shouldClearIdempotencyKey: true,
      shouldPreserveIdempotencyKey: false,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: true,
      topUpAmount: null,
    };
  }

  if (input.responseStatus === 402) {
    const required = getNumericFallback(
      payload.required,
      input.currentTierPrice
    );
    const balance = getNumericFallback(payload.balance, input.walletBalance);
    const topUpAmount = Math.max(0, required - balance);

    return {
      errorMessage: null,
      shouldClearIdempotencyKey,
      shouldPreserveIdempotencyKey,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: false,
      topUpAmount,
    };
  }

  if (input.responseStatus === 404 && code === 'CUSTOMER_NOT_FOUND') {
    return {
      errorMessage:
        'Your customer profile is not ready for this store. Please sign in again.',
      shouldClearIdempotencyKey,
      shouldPreserveIdempotencyKey,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    };
  }

  if (input.responseStatus === 502 && code === 'REFUND_PENDING') {
    return {
      errorMessage:
        'Lookup failed; your refund is pending. We will credit you within 24h.',
      shouldClearIdempotencyKey,
      shouldPreserveIdempotencyKey,
      shouldRefetchWallet: true,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    };
  }

  if (
    (input.responseStatus === 404 && code === 'SICKW_NOT_FOUND') ||
    (input.responseStatus === 502 && code === 'SICKW_UNAVAILABLE')
  ) {
    return {
      errorMessage: 'Lookup failed; your wallet was refunded.',
      shouldClearIdempotencyKey,
      shouldPreserveIdempotencyKey,
      shouldRefetchWallet: true,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    };
  }

  return {
    errorMessage: errorMessage ?? DEFAULT_IMEI_CHECK_ERROR_MESSAGE,
    shouldClearIdempotencyKey: !shouldPreserveIdempotencyKey,
    shouldPreserveIdempotencyKey,
    shouldRefetchWallet: false,
    shouldRedirectToLogin: false,
    topUpAmount: null,
  };
}
