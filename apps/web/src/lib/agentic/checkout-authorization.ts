import { createHmac } from 'node:crypto';
import { constantTimeEqual } from '@/lib/constant-time-equal';

const HUMAN_CONFIRMATION_MAX_AGE_MS = 5 * 60 * 1000;
const CENTS_PER_UNIT = 100;

export type HumanCheckoutConfirmation = {
  amount: number;
  confirmed_at: string;
  currency: string;
  session_id: string;
  signature: string;
  type: 'human_confirmation';
};

export type CheckoutPaymentMandate = {
  currency: string;
  expires_at: string;
  mandate_id: string;
  max_amount: number;
  session_id?: string;
  signature: string;
  type: 'payment_mandate';
};

export type CheckoutCompletionAuthorization =
  | CheckoutPaymentMandate
  | HumanCheckoutConfirmation;

export type CheckoutAuthorizationResult =
  | { mode: CheckoutCompletionAuthorization['type']; ok: true }
  | {
      code:
        | 'AUTHORIZATION_EXPIRED'
        | 'AUTHORIZATION_INVALID'
        | 'CONFIRMATION_MISMATCH'
        | 'CONFIRMATION_REQUIRED'
        | 'SERVER_CONFIGURATION_ERROR';
      ok: false;
    };

export function verifyCheckoutCompletionAuthorization({
  amount,
  authorization,
  currency,
  now = new Date(),
  secrets,
  sessionId,
}: {
  amount: number;
  authorization: CheckoutCompletionAuthorization | null | undefined;
  currency: string;
  now?: Date;
  secrets: string[];
  sessionId: string;
}): CheckoutAuthorizationResult {
  if (secrets.length === 0) {
    return { ok: false, code: 'SERVER_CONFIGURATION_ERROR' };
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  if (typeof currency !== 'string' || currency.trim().length === 0) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  if (!authorization) {
    return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  }

  const normalizedCurrency = currency.trim().toUpperCase();

  if (authorization.type === 'human_confirmation') {
    return verifyHumanConfirmation({
      amount,
      authorization,
      currency: normalizedCurrency,
      now,
      secrets,
      sessionId,
    });
  }

  return verifyPaymentMandate({
    amount,
    authorization,
    currency: normalizedCurrency,
    now,
    secrets,
    sessionId,
  });
}

function verifyHumanConfirmation({
  amount,
  authorization,
  currency,
  now,
  secrets,
  sessionId,
}: {
  amount: number;
  authorization: HumanCheckoutConfirmation;
  currency: string;
  now: Date;
  secrets: string[];
  sessionId: string;
}): CheckoutAuthorizationResult {
  const confirmedAt = Date.parse(authorization.confirmed_at);
  if (!Number.isFinite(confirmedAt)) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  const ageMs = now.getTime() - confirmedAt;
  if (ageMs < 0 || ageMs > HUMAN_CONFIRMATION_MAX_AGE_MS) {
    return { ok: false, code: 'AUTHORIZATION_EXPIRED' };
  }

  if (
    authorization.session_id !== sessionId ||
    !amountsEqual(authorization.amount, amount) ||
    authorization.currency.toUpperCase() !== currency
  ) {
    return { ok: false, code: 'CONFIRMATION_MISMATCH' };
  }

  if (
    !hasValidSignature(
      signedHumanPayload(authorization),
      authorization.signature,
      secrets
    )
  ) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  return { ok: true, mode: 'human_confirmation' };
}

function verifyPaymentMandate({
  amount,
  authorization,
  currency,
  now,
  secrets,
  sessionId,
}: {
  amount: number;
  authorization: CheckoutPaymentMandate;
  currency: string;
  now: Date;
  secrets: string[];
  sessionId: string;
}): CheckoutAuthorizationResult {
  const expiresAt = Date.parse(authorization.expires_at);
  if (!Number.isFinite(expiresAt)) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  if (expiresAt <= now.getTime()) {
    return { ok: false, code: 'AUTHORIZATION_EXPIRED' };
  }

  if (
    (authorization.session_id && authorization.session_id !== sessionId) ||
    isAmountLessThan(authorization.max_amount, amount) ||
    authorization.currency.toUpperCase() !== currency
  ) {
    return { ok: false, code: 'CONFIRMATION_MISMATCH' };
  }

  if (
    !hasValidSignature(
      signedMandatePayload(authorization),
      authorization.signature,
      secrets
    )
  ) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  return { ok: true, mode: 'payment_mandate' };
}

function amountsEqual(left: number, right: number): boolean {
  return (
    normalizeAmountForComparison(left) === normalizeAmountForComparison(right)
  );
}

function isAmountLessThan(left: number, right: number): boolean {
  return (
    normalizeAmountForComparison(left) < normalizeAmountForComparison(right)
  );
}

function normalizeAmountForComparison(value: number): number {
  return Math.round(value * CENTS_PER_UNIT);
}

function signedHumanPayload(value: HumanCheckoutConfirmation) {
  return JSON.stringify({
    amount: value.amount,
    confirmed_at: value.confirmed_at,
    currency: value.currency.toUpperCase(),
    session_id: value.session_id,
    type: value.type,
  });
}

function signedMandatePayload(value: CheckoutPaymentMandate) {
  return JSON.stringify({
    currency: value.currency.toUpperCase(),
    expires_at: value.expires_at,
    mandate_id: value.mandate_id,
    max_amount: value.max_amount,
    session_id: value.session_id ?? '*',
    type: value.type,
  });
}

function hasValidSignature(
  payload: string,
  signature: string,
  secrets: string[]
) {
  let valid = false;
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    valid = constantTimeEqual(signature, expected) || valid;
  }

  return valid;
}
